# Medrynex — Secure Decentralized Healthcare Data Platform

[![Node.js 22](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)](https://nodejs.org/)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org/)
[![Solidity 0.8.28](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)](https://soliditylang.org/)
[![PostgreSQL 18.4](https://img.shields.io/badge/PostgreSQL-18.4-4169E1?logo=postgresql)](https://postgresql.org/)
[![IPFS Kubo](https://img.shields.io/badge/Kubo_IPFS-v0.26.0-65C2CB?logo=ipfs)](https://ipfs.tech/)
[![React 19](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![HL7 FHIR R4](https://img.shields.io/badge/HL7_FHIR-Release_4-E52E2D)](http://hl7.org/fhir/R4/)

**Medrynex** is an enterprise-oriented, decentralized Electronic Health Record (EHR) data platform designed to resolve the tension between patient data sovereignty and clinical availability. 

By unifying **cryptographic envelope encryption**, **content-addressed decentralized storage (IPFS)**, **tamper-evident EVM smart contracts**, **fine-grained Attribute-Based Access Control (ABAC)**, and an **advisory AI/ML behavioral anomaly engine**, Medrynex guarantees that Protected Health Information (PHI) is protected with mathematical certainty while remaining rapidly accessible during clinical emergencies.

---

## 🏛 System Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │     React 19 Frontend Client    │
                    │   (Patient, Doctor, Admin UI)   │
                    └────────────────┬────────────────┘
                                     │ HTTPS / REST
                                     ▼
                    ┌─────────────────────────────────┐
                    │       Express / Node.js API     │
                    │         (REST / FHIR R4)        │
                    └────────────────┬────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
     Authentication              ABAC / RBAC                AI/ML
  (JWT + Refresh Token)    (Subject/Resource/Env)     (Anomaly Advisory)
            │                        │                        │
            │                  Consent Engine                 │
            │            (Scope & Time-Bound Grants)          │
            │                        │                        │
            │               Emergency Access                  │
            │              (Tiered Break-Glass)               │
            └────────────────────────┬────────────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │    Envelope Encryption Engine   │
                    │           AES-256-GCM           │
                    └────────────────┬────────────────┘
                                     │
                 ┌───────────────────┼───────────────────┐
                 │                   │                   │
                 ▼                   ▼                   ▼
            PostgreSQL          KMS Engine              IPFS
          (Persistence)      (Local / AWS KMS)      (Decentralized)
                 │                                       │
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     │
                                     ▼
                                Blockchain
                           (Smart Contracts EVM)
```

> **CORE SECURITY GUARANTEES:**
> * **Plaintext medical files are NEVER stored on IPFS.**
> * **Plaintext medical files are NEVER stored on the blockchain.**
> * **The blockchain does NOT act as a medical database.**

---

## 🌟 Key Platform Capabilities

1. **Envelope Encryption & Key Management (KMS):**
   * Per-record 256-bit AES-GCM Data Encryption Keys (DEKs) generated with CSPRNG.
   * DEKs are wrapped under master Key Encryption Keys (KEKs) via the `IKeyManagementService` abstraction.
   * Plaintext DEKs are securely zeroed out in volatile memory (`Buffer.fill(0)`) immediately after use.
   * Master KEKs can be rotated with zero downtime without re-encrypting underlying files on IPFS.

2. **Decentralized Storage (Kubo IPFS):**
   * Encrypted binary blobs `[IV(12) + Tag(16) + Ciphertext]` pinned to native Kubo IPFS nodes (v0.26.0).
   * High-diffusion ciphertext verified with Shannon entropy of **`7.6924 bits/byte`** (zero plaintext leakage).

3. **Dynamic Scope-Bound Consent & Batching:**
   * Patients grant fine-grained permissions bound to specific record categories (`Laboratory`, `Cardiology`, `Imaging`, etc.) and time durations.
   * Instant revocation leaving **0ms** stale authorization window.
   * Multidisciplinary care team batch approvals supported on-chain.

4. **Tiered Break-Glass Emergency Overrides:**
   * **Tier 1 (Partial)**: Allergies & Medications, 15-minute emergency lock.
   * **Tier 2 (Full)**: Full clinical history, 30-minute emergency lock.
   * Enforces verified clinical doctor role and mandatory clinical justification.
   * Post-incident dispute mechanism allows patients to reconcile or contest emergency access on-chain.

5. **AI/ML Anomaly Scoring Microservice:**
   * FastAPI microservice running dual Isolation Forest and Random Forest models.
   * Evaluates request velocity, off-hours access, and IP reputation.
   * **Advisory-only boundary:** Locks out bulk batch auto-approvals for flagged requests ($\ge 0.65$ score) while ensuring clinical availability is never interrupted by ML outages.

6. **HL7 FHIR R4 Interoperability:**
   * Conformance endpoint at `GET /api/v1/fhir/metadata` serving an active `CapabilityStatement` (FHIR v4.0.1).
   * Resource endpoints: `Patient`, `Practitioner`, `Organization`, `DocumentReference`, `Consent`, `AuditEvent`.

7. **Production Relational Persistence:**
   * PostgreSQL via Prisma ORM with 12 public tables, foreign key constraints, and relational indexes.
   * In-memory mock store fallback for rapid local sandbox testing.
   * Disaster recovery tested via atomic JSON snapshots and automated restoration.

---

## 🔑 Demo & Test Credentials

The system comes pre-seeded with role-specific accounts for instant evaluation:

| Role | Email | Password | Access / Capabilities |
|---|---|---|---|
| **Patient** | `patient@medrynx.org` | `Password123!` | View medical records, manage & revoke consent grants, view audit trail & disputes |
| **Doctor (Cardiology)** | `doctor@medrynx.org` | `Password123!` | Request patient records, view authorized medical files, prescribe medications |
| **Doctor (Neurology)** | `priya.rao@medrynx.org` | `Password123!` | Specialized practitioner view & record requests |
| **Doctor (Emergency ER)** | `suresh.kumar@medrynx.org` | `Password123!` | Trigger Tier 1 & Tier 2 Break-Glass Emergency access with clinical justification |
| **Hospital Admin** | `admin@medrynx.org` | `Password123!` | User management, doctor verification, system audit logs, blockchain inspector, anomaly monitors |

---

## 🚀 Quick Start (Native Windows Setup)

### Prerequisites
* **Node.js** v20+ or v22+
* **Python** 3.10+ or 3.11+
* **Git**
* *(Optional)* **Kubo IPFS** v0.26.0

### 1. Clone & Configure Environment
```bash
git clone https://github.com/leo121206/Medrynex.git
cd Medrynex

# Copy template configurations
cp .env.example .env
cp backend/.env.example backend/.env
```

### 2. Install All Dependencies
Run the all-in-one dependency installer:
```cmd
setup_all.bat
```
*Or install individual packages manually:*
```powershell
cd contracts && npm install && cd ..
cd aiml && pip install -r requirements.txt && cd ..
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 3. Launch Services
Run the automated multi-service launcher:
```cmd
start_all.bat
```
*This starts all required microservices:*
* **Hardhat EVM Node** (`http://127.0.0.1:8545`) with smart contracts deployed
* **AI/ML Anomaly Microservice** (`http://127.0.0.1:8000`)
* **Medrynex Core Backend API** (`http://127.0.0.1:5000`)
* **Medrynex Frontend Client** (`http://127.0.0.1:5173`)

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🛠 Manual Service Execution

If you prefer running components in separate terminal tabs:

### 1. Smart Contracts & EVM Blockchain
```bash
cd contracts
npm install
npx hardhat node
# In another terminal:
npx hardhat run scripts/deploy.cjs --network localhost
```

### 2. AI/ML Anomaly Microservice
```bash
cd aiml
pip install -r requirements.txt
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Backend Service
```bash
cd backend
npm install
npm run dev
```

### 4. Frontend Client
```bash
cd frontend
npm install
npm run dev
```

---

## 🐳 Containerized Deployment (Docker Compose)

Medrynex includes a multi-container Docker deployment:

```powershell
# Build and run all services in background
docker compose up --build -d

# Verify container status
docker compose ps
```

---

## 📊 Environment & Infrastructure Matrix

| Component | Development / Local | Cloud Production | Verification Status |
|---|---|---|---|
| **Database** | Embedded PostgreSQL 18.4 / In-Memory Store | Managed PostgreSQL (AWS RDS) | **RUNTIME VERIFIED** (Local) |
| **Storage** | Native Kubo IPFS / Mock Encrypted Store | Dedicated IPFS Node / Cluster | **RUNTIME VERIFIED** (Local) |
| **KMS Provider** | `LocalKeyManagementService` | `AwsKeyManagementService` (AWS KMS) | **RUNTIME VERIFIED** (Local) / Architecture Verified (AWS) |
| **Blockchain** | Hardhat EVM (Port 8545) | Ethereum L2 / Private EVM | **RUNTIME VERIFIED** (Local EVM) |
| **AI/ML Service** | FastAPI / Uvicorn (Port 8000) | FastAPI Container (ECS/K8s) | **RUNTIME VERIFIED** (Local) |
| **Frontend** | Vite Dev Server (Port 5173) | Nginx Static Bundle (Port 3000) | **BUILD & RUNTIME VERIFIED** |
| **Secrets** | Local `.env` file | AWS Secrets Manager / Vault | **AUDITED & SANITIZED** |
| **Transport** | HTTP / Localhost | HTTPS / TLS 1.3 Termination | Architecture Configured |

---

## 🛡️ Security & Verification Posture

> **STATUTORY & CERTIFICATION DISCLAIMER:**  
> Medrynex implements robust, layered technical safeguards designed for privacy-preserving healthcare data management. **Medrynex has NOT undergone formal third-party HIPAA, GDPR, or ONC certification.** Technical capabilities (such as envelope encryption, crypto-shredding, and FHIR resource mapping) are described strictly as software architectural controls.

### Verification Summary
* **158 / 158 Multi-Stack Tests Passed (100%):**
  * Backend Unit & Integration (Vitest): **58 / 58**
  * Smart Contract Suites (Hardhat): **8 / 8**
  * AI/ML Anomaly Suites (Pytest): **33 / 33**
  * Master PostgreSQL Persistence: **22 / 22**
  * Real Runtime Infrastructure: **14 / 14**
  * Database Backup & Disaster Recovery: **4 / 4**
  * Production Attack Matrix: **19 / 19**
* **Strict TypeScript Typecheck:** 0 Errors (`npx tsc --noEmit`).
* **Frontend Production Compilation:** 0 Errors (`dist/` built cleanly).

---

## 📚 Technical Documentation

Detailed specifications and architectural models:

* [**Project Setup & Deployment Guide**](./docs/setup.md) — Comprehensive guide for configuring environment, databases, and dependencies.
* [**Product Requirements Document (PRD)**](./docs/prd.md) — Complete functional, architectural, and security requirements.
* [**Project Proposal & Extended Architecture (PDF)**](./docs/MediVault_AI_Proposal_Extended.pdf) — Architectural whitepaper and presentation document.
* [**AI/ML Service Documentation**](./aiml/README.md) — Isolation Forest, behavioral anomaly scoring, and model details.
* [**Backend Architecture & APIs**](./backend/README.md) — Express REST routes, cryptographic envelope pipeline, and Prisma models.
* [**Frontend Application**](./frontend/README.md) — UI architecture, role-based dashboards, and state management.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
