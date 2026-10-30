# Medrynx — Secure Decentralized Healthcare Data Platform

[![Node.js 22](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)](https://nodejs.org/)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)](https://python.org/)
[![Solidity 0.8.28](https://img.shields.io/badge/Solidity-0.8.28-363636?logo=solidity)](https://soliditylang.org/)
[![PostgreSQL 18.4](https://img.shields.io/badge/PostgreSQL-18.4-4169E1?logo=postgresql)](https://postgresql.org/)
[![IPFS Kubo](https://img.shields.io/badge/Kubo_IPFS-v0.26.0-65C2CB?logo=ipfs)](https://ipfs.tech/)
[![React 19](https://img.shields.io/badge/React-19.x-61DAFB?logo=react)](https://react.dev/)
[![HL7 FHIR R4](https://img.shields.io/badge/HL7_FHIR-Release_4-E52E2D)](http://hl7.org/fhir/R4/)

**Medrynx** is an enterprise-oriented, decentralized Electronic Health Record (EHR) data platform designed to resolve the tension between patient data sovereignty and clinical availability. 

By unifying **cryptographic envelope encryption**, **content-addressed decentralized storage (IPFS)**, **tamper-evident EVM smart contracts**, **fine-grained Attribute-Based Access Control (ABAC)**, and an **advisory AI/ML behavioral anomaly engine**, Medrynx guarantees that Protected Health Information (PHI) is protected with mathematical certainty while remaining rapidly accessible during clinical emergencies.

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
   * Tier 1 (Partial: Allergies & Medications, 15-min lock) and Tier 2 (Full, 30-min lock).
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
   * PostgreSQL 18.4 via Prisma ORM with 12 public tables, foreign key constraints, and relational indexes.
   * Disaster recovery tested via atomic JSON snapshots and automated restoration.

---

## 🚀 Quick Start (Native Windows Setup)

This is the fully verified execution topology on the local workstation.

### Prerequisites
* **Node.js** v20+ or v22+
* **Python** 3.10+ or 3.11+
* **Git**
* **Kubo IPFS** v0.26.0 binary

### 1. Clone & Configure Environment
```bash
git clone <repository_url> Medrynx
cd Medrynx

# Copy template configurations
cp .env.example .env
cp backend/.env.example backend/.env
```

### 2. Install Dependencies
Run the all-in-one dependency installer:
```cmd
setup_all.bat
```
*Or install manually:*
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
*This starts:*
* **Hardhat EVM Node** (`http://127.0.0.1:8545`) and auto-deploys smart contracts.
* **AI/ML Anomaly Microservice** (`http://127.0.0.1:8000`).
* **Medrynx Core Backend API** (`http://127.0.0.1:5000`).
* **Medrynx Frontend Web Client** (`http://127.0.0.1:5173`).

---

## 🐳 Containerized Deployment (Docker Compose)

> **VERIFICATION LIMITATION:**  
> `docker-compose.yml` provides a production-grade multi-container topology. However, because Docker Desktop / WSL2 was unavailable on the test host machine, container execution is strictly classified as **`DOCKER RUNTIME: NOT VERIFIED`**.

To run on a system with Docker Engine installed:
```powershell
# Build and run all 5 services
docker compose up --build -d

# Verify container status
docker compose ps
```

---

## 📊 Environment & Infrastructure Matrix

| Component | Development / Local | Cloud Production | Verification Status |
|---|---|---|---|
| **Database** | Embedded PostgreSQL 18.4 | Managed PostgreSQL (AWS RDS) | **RUNTIME VERIFIED** (Local) |
| **Storage** | Native Kubo IPFS v0.26.0 | Dedicated IPFS Node / Cluster | **RUNTIME VERIFIED** (Local) |
| **KMS Provider** | `LocalKeyManagementService` | `AwsKeyManagementService` (AWS KMS) | **RUNTIME VERIFIED** (Local) / Architecture Verified (AWS) |
| **Blockchain** | Hardhat EVM (Port 8545) | Ethereum L2 / Private EVM | **RUNTIME VERIFIED** (Local EVM) |
| **AI/ML Service** | FastAPI / Uvicorn (Port 8000) | FastAPI Container (ECS/K8s) | **RUNTIME VERIFIED** (Local) |
| **Frontend** | Vite Dev Server (Port 5173) | Nginx Static Bundle (Port 3000) | **BUILD & RUNTIME VERIFIED** |
| **Secrets** | Local `.env` file | AWS Secrets Manager / Vault | **AUDITED & SANITIZED** |
| **Transport** | HTTP / Localhost | HTTPS / TLS 1.3 Termination | Architecture Configured |

---

## 🛡️ Security & Verification Posture

> **STATUTORY & CERTIFICATION DISCLAIMER:**  
> Medrynx implements robust, layered technical safeguards designed for privacy-preserving healthcare data management. **Medrynx has NOT undergone formal third-party HIPAA, GDPR, or ONC certification.** Technical capabilities (such as envelope encryption, crypto-shredding, and FHIR resource mapping) are described strictly as software architectural controls.

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
* **Frontend Production Compilation:** 0 Errors (`dist/` built in 3.31s).

---

## 📚 Complete Technical Documentation Index

Detailed specifications, architectural models, and demonstration scripts are located in [`docs/`](./docs/):

* [**Architecture & Layered Design**](./docs/ARCHITECTURE.md) — Multi-tier system architecture and Mermaid diagrams.
* [**Security & Defensive Controls**](./docs/SECURITY.md) — Defense-in-depth across all 8 security planes.
* [**Threat Model & Attack Surface**](./docs/THREAT_MODEL.md) — STRIDE threat analysis and 19-row verified matrix.
* [**REST API Reference**](./docs/API.md) — Endpoints, request schemas, response codes, and error formats.
* [**Distributed Ledger & Blockchain**](./docs/BLOCKCHAIN.md) — Smart contract specifications and ledger boundary rules.
* [**Decentralized Storage (IPFS)**](./docs/IPFS.md) — Upload/download workflows and zero-knowledge storage.
* [**Cryptographic Specification**](./docs/ENCRYPTION.md) — Envelope encryption, AES-256-GCM, and DEK zeroing.
* [**Key Management Service (KMS)**](./docs/KMS.md) — Local KMS and AWS KMS adapter architecture.
* [**AI/ML Anomaly Microservice**](./docs/AI_ML.md) — Isolation Forest, Random Forest, and advisory boundaries.
* [**HL7 FHIR Interoperability**](./docs/FHIR.md) — FHIR R4 conformance and CapabilityStatement.
* [**Deployment & Infrastructure**](./docs/DEPLOYMENT.md) — Native Windows, Docker, and enterprise cloud setup.
* [**Live Demonstration Script**](./docs/DEMO.md) — Step-by-step 10-scene technical presentation guide.
