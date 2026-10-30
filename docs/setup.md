# Medrynx (MediVault AI) — Project Setup & Deployment Guide

Welcome to **Medrynx** (MediVault AI), a blockchain-anchored, anomaly-aware electronic health records (EHR) exchange platform with dynamic scope-bound consent and tiered break-glass emergency access control.

---

## 🏗️ System Architecture Overview

Medrynx consists of three main decoupled components:

1. **Frontend (`Medrynx/`)**:
   - Modern Single Page Application (SPA) built with **React 19**, **TypeScript**, **Vite**, and **Tailwind CSS**.
   - Charts powered by **Recharts**, interactive modals, role-based dashboards (Patient, Doctor, Admin).
   - Time-based dynamic greeting engine and fully dynamic data-driven forms.
   - Default Port: `http://localhost:5173` (with `/api/v1` reverse proxy to backend).

2. **Backend (`backend/`)**:
   - High-performance RESTful API built with **Node.js v22**, **Express**, and **TypeScript**.
   - Cryptographic payload encryption (**AES-256-GCM**) with **SHA-256** hash anchoring.
   - AI/ML Anomaly Scoring engine evaluating clinician specialty, purpose, and access time windows.
   - Dual-mode data persistence: Resilient high-speed in-memory store + optional PostgreSQL/Prisma ORM.
   - Default Port: `http://localhost:5000`.

3. **Smart Contracts (`contracts/`)**:
   - **Solidity 0.8.24** contracts compiled and tested using **Hardhat**:
     - `MedrynxAccessRegistry.sol`: Scope-bound consent, purpose enforcement, temporal duration locks.
     - `MedrynxEmergencyVault.sol`: Tier 1 (Partial 15m) and Tier 2 (Full 30m) break-glass access control.
     - `MedrynxAuditLogger.sol`: Immutable event anchoring on Ethereum/Ganache.
   - Network: Ganache Local Testnet (`http://127.0.0.1:7545`, Chain ID: `1337`).

---

## 📋 Prerequisites

Ensure the following tools are installed on your machine:
- **Node.js**: `v18.x`, `v20.x`, or `v22.x` (Recommended: `v20+`)
- **npm**: `v9.x` or `v10+`
- **Git**: For version control
- *(Optional)* **Ganache**: For running a local Ethereum blockchain node (`http://127.0.0.1:7545`)
- *(Optional)* **PostgreSQL**: If running connected database mode instead of the built-in resilient in-memory store

---

## 🚀 Quick Start Guide

### Step 1: Clone or Unzip the Project
Ensure you are in the root directory:
```bash
cd "Medrynx (2)"
```

---

### Step 2: Backend Setup & Launch

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. *(Optional)* Configure Environment Variables:
   Create or verify `.env` in `backend/`:
   ```env
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=medrynx_super_secret_jwt_encryption_key_2026_secure
   JWT_EXPIRES_IN=24h
   GANACHE_RPC_URL=http://127.0.0.1:7545
   IPFS_GATEWAY=https://ipfs.io/ipfs/
   ```

4. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The backend will boot up at `http://localhost:5000` with the health check available at `http://localhost:5000/api/v1/health`.*

5. To run the automated backend test suite (29 tests):
   ```bash
   npm run test
   ```

6. To compile the production build:
   ```bash
   npm run build
   ```

---

### Step 3: Frontend Setup & Launch

1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd Medrynx
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend application will be live at `http://localhost:5173`.*

4. To compile the frontend production bundle:
   ```bash
   npm run build
   ```

---

### Step 4: Smart Contracts (Optional / Verification)

1. Open a new terminal window and navigate to `contracts/`:
   ```bash
   cd contracts
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile Solidity smart contracts:
   ```bash
   npx hardhat compile
   ```

4. Run smart contract automated test suite:
   ```bash
   npx hardhat test
   ```

---

## 👥 Demo User Accounts

You can log in to any of the three Medrynx portals using the preconfigured accounts:

| Portal Role | Email Address | Password | Capabilities |
| :--- | :--- | :--- | :--- |
| **Patient (Owner)** | `patient@medrynx.org` | `Password123!` | View encrypted medical records, grant/revoke scope-bound consents, 1-click batch approvals, dispute break-glass incidents. |
| **Alternative Patient** | `karna.sharma@example.com` | `Password@123` | Patient profile with full record vault and consent logs. |
| **Doctor / Clinician** | `doctor@medrynx.org` | `Password123!` | Submit scoped access requests, trigger AI anomaly scoring, multi-medication prescriptions, trigger Break-Glass emergency overrides. |
| **Alternative Doctor** | `ananya.sharma@abchospital.org` | `Password@123` | Clinician profile associated with ABC Hospital. |
| **Hospital Admin** | `admin@medrynx.org` | `Password123!` | Real-time platform analytics, doctor credential verification, AI anomaly alerts, IPFS cluster and blockchain node monitoring. |

---

## 🧪 Key Workflows to Test

1. **Dynamic Time-Based Greetings**:
   - Notice the greeting at the top of the Patient and Doctor Dashboards (`"Good morning"`, `"Good afternoon"`, `"Good evening"`, or `"Good night"`) changes dynamically according to your computer's local time.
2. **Clean Dynamic Forms**:
   - The login page and clinical request forms start completely clean without any prefilled passwords, default emails, or hardcoded IDs.
3. **AI Anomaly & Risk Scoring**:
   - Log in as Doctor, go to **Doctor Requests**, select a patient, and submit an access request. The AI microservice calculates a real-time 0–100 risk score based on medical specialty, requested purpose, and duration.
4. **Care-Team Consent Batching**:
   - Log in as Patient, navigate to **Consent Management**, and approve care-team requests with a single click (reducing notification fatigue by $\ge 65\%$).
5. **Break-Glass Emergency Access**:
   - Log in as Doctor, go to **Emergency Access / Break-Glass**, and select Tier 1 (Partial 15m) or Tier 2 (Full 30m). A live cryptographic session timer is activated.
6. **Immutable Dispute Filing**:
   - Log in as Patient, navigate to **Disputes**, and file an on-chain dispute against an emergency access event.
7. **Encrypted Record Decryption**:
   - Download any encrypted medical record. The backend streams decrypted plaintext verified against its SHA-256 hash.

---

## 📁 Repository Structure

```
Medrynx (2)/
├── setup.md                 # This project setup and configuration document
├── prd.md                   # Full comprehensive Product Requirement Document
├── backend/                 # Node.js + Express + TypeScript Backend
│   ├── src/
│   │   ├── controllers/     # REST controllers (auth, record, consent, emergency, admin, audit)
│   │   ├── middleware/      # JWT auth, roleGuard, Zod validation, error handling
│   │   ├── models/          # Resilient in-memory store & fallback models
│   │   ├── routes/          # Express API route declarations
│   │   ├── services/        # AES-256 IPFS storage, anomaly scoring, blockchain bridges
│   │   ├── tests/           # Vitest integration test suites (100% pass rate)
│   │   └── server.ts        # Server entry point (port 5000)
│   ├── prisma/              # Prisma schema & migration definitions
│   └── package.json
├── Medrynx/                 # React 19 + TypeScript + Vite Frontend
│   ├── src/
│   │   ├── components/      # UI components (Buttons, Cards, Badges, Modals, Navbar, Sidebar)
│   │   ├── context/         # AuthContext and NotificationContext
│   │   ├── pages/           # Patient, Doctor, Admin, and Auth pages
│   │   ├── services/        # Axios API client & backend service connectors
│   │   └── utils/           # Time-based greeting helper (greeting.ts)
│   └── package.json
└── contracts/               # Solidity Smart Contracts (Hardhat)
    ├── contracts/           # MedrynxAccessRegistry, MedrynxEmergencyVault, MedrynxAuditLogger
    ├── test/                # Hardhat Chai test suites
    └── hardhat.config.cjs
```

---

## 🛠️ Troubleshooting & Support

- **Port Conflict (`EADDRINUSE`)**: If port `5000` or `5173` is in use, terminate existing processes or change `PORT` in `backend/.env` and `Medrynx/vite.config.ts`.
  - Windows command to check: `netstat -ano | findstr :5000`
  - Terminate: `taskkill /F /PID <PID>`
- **Database Offline**: Medrynx backend automatically detects if PostgreSQL is not running and transparently switches to its **Resilient High-Speed In-Memory Store**, allowing the complete application to run smoothly without database setup.
