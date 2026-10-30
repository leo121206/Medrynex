# Medrynex Frontend Client

A responsive Single Page Application (SPA) built for patients, medical practitioners, and hospital administrators.

## 🚀 Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS, Lucide React Icons
- **Data Visualization**: Recharts
- **State & Context**: React Context (AuthContext, NotificationContext, ModalContext)
- **Routing**: React Router DOM (v7)

## 📁 Portals & Roles

1. **Patient Portal**:
   - Medical record inspection with decrypted preview
   - Dynamic scope-bound consent management & instant revocation
   - Blockchain-anchored access log viewer
   - Emergency access reconciliation & dispute reporting

2. **Doctor Portal**:
   - Patient search & record access requests
   - Authorized records viewer & clinical document creation
   - Prescription issuance
   - Tier 1 & Tier 2 Break-Glass Emergency overrides

3. **Admin Portal**:
   - Hospital-wide EHR audit history & access analytics
   - AI/ML behavioral anomaly monitoring & risk assessment
   - Blockchain transactions inspector
   - Doctor verification and user directory management

## 🛠 Getting Started

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```
The app will run at `http://localhost:5173`. Requests to `/api/v1` are proxied to `http://localhost:5000`.

### Build for Production
```bash
npm run build
```
