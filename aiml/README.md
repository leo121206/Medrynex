# MediVault AI — Access Anomaly Detection

A standalone, unsupervised anomaly-detection module for clinician **medical-record
access behaviour**. It accepts access metadata and returns a risk assessment.

This module is intentionally independent. It does not import, read or contact the
MediVault React frontend, Node.js backend, Solidity contracts, Ganache, IPFS or
PostgreSQL. It runs, trains, tests and serves entirely on its own.

---

## 1. What this is, and what it is not

**It analyses:** request counts, request timing, specialty, record type, stated
purpose, hospital affiliation, emergency flag.

**It never analyses:** patient disease, diagnoses, symptoms, report contents or
medical images. None of those fields exist anywhere in the schema.

**It is decision support, not an accusation engine.** The output describes how
unusual an access pattern looks relative to learned behaviour. It does not — and
the code deliberately never says it does — establish intent, authorisation status
or wrongdoing. All explanation strings are phrased as observations about the
request, never as claims about the clinician.

**Nothing here is clinically validated.** All data is synthetic, all thresholds
are operational defaults, and all reported metrics measure recovery of
*synthetically injected* deviations.

---

## 2. Why Isolation Forest

There is no large, trustworthy, human-adjudicated dataset labelling real record
accesses as legitimate or illegitimate, so supervised classification is not
available honestly. The problem is therefore unsupervised: learn what normal
access looks like and rank how far a new request sits from it.

Isolation Forest fits this well:

- **No labels required.** It isolates points by random partitioning; points that
  isolate in few splits are unusual.
- **Efficient and low-variance at scale.** Linear time, small memory, fast enough
  to serve per-request behind an HTTP call.
- **Mixed-scale tolerant.** Splits are invariant to monotone rescaling, so count
  features and rate features coexist without careful normalisation.
- **A tunable operating point.** `contamination` fixes the inlier/outlier
  boundary explicitly, which is exactly the knob a reviewer wants when deciding
  how many requests they can afford to inspect.

Alternatives were rejected for specific reasons: One-Class SVM scales poorly and
is sensitive to kernel choice; Local Outlier Factor needs the reference set at
prediction time; autoencoders need far more data and give a less inspectable
score.

---

## 3. Architecture

```
access metadata (JSON)
        |
   Pydantic validation            api/main.py
        |
   schema + type coercion         src/preprocessing.py
        |
   derived features               DerivedFeatures
   contextual frequencies         ContextualFrequencyEncoder
        |
   Isolation Forest               src/train.py (fitted), joblib artifact
        |
   decision_function -> normalised score -> risk level -> reasons
                                  src/anomaly_score.py
        |
   JSON result
```

The preprocessor and the model are persisted as **one** `sklearn.Pipeline`
object. Training and prediction therefore cannot drift apart: there is exactly
one definition of the transformation, in `src/preprocessing.py`.

---

## 4. Dataset and features

### Contract features (the ten fields callers send)

| Field | Type | Notes |
|---|---|---|
| `doctor_specialty` | categorical | e.g. Cardiology, Neurology |
| `record_type` | categorical | e.g. ECG, MRI_Scan_Report |
| `purpose` | categorical | e.g. Diagnosis, Treatment, Emergency |
| `hospital_affiliation` | categorical | e.g. HOSP001 |
| `requests_last_24h` | numeric | rolling count |
| `requests_last_7d` | numeric | rolling count |
| `requests_for_record_type` | numeric | count for this record type |
| `average_daily_requests` | numeric | the clinician's own baseline |
| `request_hour` | numeric | 0–23 |
| `emergency_flag` | numeric | 0 or 1 |

### Derived features (computed inside the pipeline, not sent by callers)

Absolute counts are not comparable across clinicians — a busy emergency
physician and a quiet dermatologist have very different normal volumes. The
pipeline therefore derives:

- `burst_ratio` — 24h requests relative to the clinician's own daily average
- `weekly_ratio` — 7d requests relative to 7× that average
- `record_concentration` — share of the week's requests aimed at one record type
- `off_hours` — outside 07:00–21:00 with no emergency flag
- `hour_sin`, `hour_cos` — cyclic hour encoding, so 23:00 and 00:00 are adjacent
- contextual frequencies — marginal frequency of each category, plus
  `P(record_type | specialty)`, `P(purpose | specialty)`,
  `P(hospital | specialty)` learned from training data

The contextual frequencies matter: one-hot encoding cannot express "an MRI
report is routine for a neurologist but unusual for a dermatologist", because
the two facts sit in separate columns. Encoding conditional rarity as a numeric
axis lets the forest isolate mismatched pairs directly. Unseen values map to
frequency 0.0 rather than raising.

Raw one-hot columns and raw counts are deliberately **excluded** from the model
input. Isolation Forest picks its split feature uniformly at random, so
uninformative columns dilute informative ones. Measured on a held-out synthetic
set, removing them raised ROC-AUC from 0.91 to 0.96.

### Synthetic data generation

`src/data_generator.py` builds a roster of synthetic clinicians (default: 6
specialties × 5 clinicians). Each has a stable hospital and daily baseline, so
"normal" differs per clinician. Normal requests are drawn from the specialty's
record-type and purpose distributions with Poisson volumes and specialty-typical
hours. Anomalies are injected in six flavours: `high_frequency`,
`unusual_record_type`, `unusual_purpose`, `off_hours_access`,
`specialty_record_mismatch`, `behavioural_drift`.

**This is invented data.** It contains no real clinician, patient or hospital
information and is not claimed to reproduce any real hospital's statistics. The
`is_anomaly` / `anomaly_type` columns are used only by `src/evaluate.py`; the
model never sees them.

---

## 5. Anomaly scoring

Two distinct numbers, never conflated:

**`decision_score`** — the raw `IsolationForest.decision_function` output.
Positive is inlier, negative is outlier, and the zero point is set by
`contamination`. Model-internal, unbounded.

**`anomaly_score`** — a normalised 0.0–1.0 value, higher meaning more unusual,
computed by a piecewise-linear rescaling anchored at the model's own boundary:

```
decision >= 0:  score = 0.5 * (1 - decision / s_hi)     -> [0.0, 0.5]
decision <  0:  score = 0.5 + 0.5 * (decision / s_lo)   -> [0.5, 1.0]
```

`s_lo` and `s_hi` are the 1st and 99th percentile training decision scores,
stored in `models/metadata.json`. A score ≥ 0.5 means the forest itself calls
the request an outlier; the distance beyond 0.5 shows how far into the outlier
region it sits.

The normalised score is **not** a probability and **not** a calibrated
likelihood of misuse. It is a monotone rescaling for downstream convenience.

**Thresholds** (all in `src/config.py`, all overridable by environment variable):

| Setting | Default | Meaning |
|---|---|---|
| `ANOMALY_THRESHOLD` | 0.50 | `anomaly_flag` turns true at or above this |
| `RISK_MEDIUM_THRESHOLD` | 0.45 | MEDIUM band starts here |
| `RISK_HIGH_THRESHOLD` | 0.65 | HIGH band starts here |

These are operational defaults for a demonstration system, chosen so the flag
agrees with the model's own contamination boundary. They are not clinically
validated and carry no regulatory meaning.

### Explanations

When a request is flagged, `src/anomaly_score.py` compares it against the
training distribution stored in the metadata and emits plain-language
observations — unusual volume, volume above the clinician's own average,
uncommon category value, record type uncommon for that specialty, access
outside typical hours without an emergency flag.

These are descriptive statistics for a human reviewer, deliberately worded as
"unusual access pattern detected", never "unauthorised access" or "malicious
clinician". A test asserts that accusatory vocabulary never appears in output.

---

## 6. Project structure

```
medivault-aiml/
├── data/
│   ├── raw/access_patterns.csv          generated synthetic dataset
│   └── processed/evaluation_report.json  evaluation output
├── models/
│   ├── isolation_forest.joblib          fitted preprocessing + model pipeline
│   └── metadata.json                    version, hyperparameters, calibration, profile
├── src/
│   ├── config.py                        all paths, hyperparameters, thresholds
│   ├── data_generator.py                synthetic access-pattern generator
│   ├── preprocessing.py                 schema, validation, the single pipeline
│   ├── train.py                         fit, calibrate, persist artifacts
│   ├── predict.py                       predict_access_anomaly(), predict_batch()
│   ├── anomaly_score.py                 normalisation, risk levels, explanations
│   └── evaluate.py                      precision / recall / F1 / confusion matrix
├── api/main.py                          FastAPI service (health, predict, model-info)
├── tests/                               33 tests across preprocessing, prediction, API
├── requirements.txt
├── README.md
└── .gitignore
```

---

## 7. Commands

```bash
# 1. Virtual environment
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# 2. Dependencies
pip install -r requirements.txt

# 3. Generate the synthetic dataset
python src/data_generator.py --samples 10000

# 4. Train
python src/train.py

# 5. Evaluate (generates a fresh held-out synthetic set)
python src/evaluate.py --eval-samples 5000

# 6. Run the API
uvicorn api.main:app --reload --port 8000

# 7. Test the API
curl http://localhost:8000/health
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"doctor_specialty":"Cardiology","record_type":"ECG","purpose":"Diagnosis","hospital_affiliation":"HOSP001","requests_last_24h":6,"requests_last_7d":31,"requests_for_record_type":18,"average_daily_requests":5,"request_hour":14,"emergency_flag":0}'

# 8. Unit tests
python -m pytest -q
```

Interactive API docs: `http://localhost:8000/docs`

---

## 8. API contract

### `GET /health`
```json
{"status": "ok", "model_loaded": true, "model_version": "1.0", "detail": null}
```
Returns `status: "degraded"` and `model_loaded: false` if the model has not been
trained — the service stays up so orchestrators can distinguish "process down"
from "model missing".

### `POST /predict`

Request:
```json
{
  "doctor_specialty": "Cardiology",
  "record_type": "ECG",
  "purpose": "Diagnosis",
  "hospital_affiliation": "HOSP001",
  "requests_last_24h": 6,
  "requests_last_7d": 31,
  "requests_for_record_type": 18,
  "average_daily_requests": 5,
  "request_hour": 14,
  "emergency_flag": 0
}
```

Response:
```json
{
  "anomaly_score": 0.1315,
  "anomaly_flag": false,
  "risk_level": "LOW",
  "reasons": [],
  "decision_score": 0.112482,
  "model_version": "1.0"
}
```

Status codes: `200` success, `422` validation failure (missing field, wrong
type, out-of-range hour, unknown extra field), `503` model not trained.

Unknown fields are rejected (`extra: forbid`) so that clinical content cannot be
sent to this service by accident.

### `GET /model-info`
Returns model name, version, algorithm, training timestamp, training sample
count, the ten contract features, hyperparameters, risk thresholds, score
calibration and the data source. Every prediction carries `model_version`, so a
stored result can always be traced to the model that produced it.

---

## 9. Evaluation results

Measured on a freshly generated held-out synthetic set (5,000 requests, seed 43,
distinct from the training seed), against a model trained on 10,000 samples with
`n_estimators=200`, `contamination=0.05`, `random_state=42`:

```
total samples:         5000
normal samples:        4750
anomalous samples:     250
flagged samples:       294
percentage flagged:    5.88

precision:             0.568
recall:                0.668
f1 score:              0.614
roc auc:               0.959

Confusion matrix
                 predicted normal  predicted anomalous
actual normal    4623              127
actual anomalous 83                167

Recall by injected anomaly type
  behavioural_drift            42/42   1.00
  off_hours_access             38/38   1.00
  high_frequency               44/47   0.94
  specialty_record_mismatch    30/34   0.88
  unusual_purpose               5/39   0.13
  unusual_record_type           8/50   0.16
```

Reproduce with `python src/evaluate.py`. Numbers vary slightly with the seed.

**Reading these honestly.** ROC-AUC of 0.959 says the ranking is good: genuine
deviations mostly score above normal traffic. Precision of 0.57 at the default
operating point says roughly two in five flagged requests are ordinary
behaviour, which is why the output is a review signal and not an enforcement
decision. Volume, timing and drift anomalies are caught reliably. Single-field
category swaps with no volume change — an unusual stated purpose, or one
off-profile record type requested once — are largely missed at a 5% flag budget,
because more extreme deviations consume it first. Raising `contamination` trades
precision for recall on exactly that group.

---

## 10. Limitations

1. **Synthetic data only.** Every number above measures recovery of injected
   deviations in invented data. It is not evidence about real clinical systems.
2. **Not clinically or operationally validated.** No regulatory claim is made.
3. **Anomalous ≠ improper.** Unusual behaviour has many innocent causes: cover
   shifts, ward transfers, audits, research, unusual case mixes.
4. **Weak on single-field category anomalies** at the default operating point,
   as shown above.
5. **Stateless per request.** The caller supplies the rolling counts; the module
   keeps no history of its own and cannot detect slow drift across sessions
   unless the supplied baselines reflect it.
6. **Cold start.** A newly onboarded clinician has no established baseline, so
   early requests may score higher than they deserve.
7. **Contaminated training assumption.** The forest is trained on data believed
   to be mostly normal. If real logs contain systematic misuse, that misuse
   becomes part of "normal".
8. **No fairness audit.** Whether flag rates differ by specialty, hospital or
   shift pattern has not been measured. That review is required before any
   deployment affecting people.

---

## 11. Future integration with MediVault

The intended flow, once this module is integrated:

```
React frontend
      -> Node.js backend
      -> HTTP POST /predict   (this service)
      -> Isolation Forest
      -> JSON response
      -> Node.js backend
      -> patient consent workflow
      -> existing Solidity smart contract
```

The ML service stays at the far end of one HTTP hop. It never calls contracts,
never signs transactions, never touches Ganache, IPFS, PostgreSQL or patient
files. The Node.js backend owns all of that, and owns the decision about what a
risk level should trigger.

Node.js caller sketch:

```javascript
const response = await fetch("http://localhost:8000/predict", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    doctor_specialty: doctor.specialty,
    record_type: request.recordType,
    purpose: request.purpose,
    hospital_affiliation: doctor.hospitalId,
    requests_last_24h: counts.last24h,
    requests_last_7d: counts.last7d,
    requests_for_record_type: counts.forRecordType,
    average_daily_requests: doctor.averageDailyRequests,
    request_hour: new Date().getHours(),
    emergency_flag: request.isEmergency ? 1 : 0
  })
});

const ml = await response.json();
// Persist ml.anomaly_score, ml.risk_level, ml.reasons, ml.model_version
// alongside the access request, then let the consent workflow decide.
```

Integration notes worth deciding before wiring it up:

- **The backend computes the rolling counts.** That is the only real work on the
  Node side; the module cannot compute them because it has no database access.
- **Fail open or fail closed?** If the ML service is unreachable, the backend
  must have an explicit policy. Treating a timeout as HIGH risk will block
  legitimate emergency care; treating it as LOW silently disables the control.
  Log the outcome either way.
- **Store `model_version` with every stored score,** so results stay traceable
  after a retrain.
- **Keep the score off-chain.** A risk score is a mutable operational signal and
  a privacy-sensitive judgement about a named clinician; putting it on-chain
  makes it permanent and public.
- **Nothing should auto-deny on a score alone,** given the precision above. A
  HIGH result is a reason to require explicit consent confirmation or to queue a
  review, not to accuse anyone.
- **Bind the service to localhost or a private network** and add authentication
  before it is reachable from anywhere else; it currently has none.

---

## 12. Files that can be copied into MediVault as-is

The whole `medivault-aiml/` directory is intended to be dropped in as a sibling
service. If you want only the runtime pieces:

- `src/config.py`
- `src/preprocessing.py`
- `src/anomaly_score.py`
- `src/predict.py`
- `api/main.py`
- `models/isolation_forest.joblib`
- `models/metadata.json`
- `requirements.txt`

`data_generator.py`, `train.py` and `evaluate.py` are only needed to rebuild the
model, and the `tests/` directory only to verify it.

---

## 13. Assumptions made

1. The caller can supply accurate rolling counts and the clinician's baseline
   average; the module trusts them without verification.
2. `request_hour` is local hospital time, 0–23. Timezone normalisation is the
   caller's responsibility.
3. Historical access logs used for retraining are predominantly normal.
4. Specialty, record type and purpose come from controlled vocabularies. Free
   text would fragment the frequency estimates.
5. One model serves all specialties; per-specialty behaviour is captured through
   the conditional frequency features rather than separate models.
6. `contamination=0.05` reflects an assumed review budget, not a measured base
   rate of misuse.
7. `emergency_flag` is set by the calling system and is treated as trustworthy —
   the off-hours explanation suppresses itself when it is set.
8. Record types and specialties in the generator are plausible placeholders, not
   a validated clinical taxonomy.
