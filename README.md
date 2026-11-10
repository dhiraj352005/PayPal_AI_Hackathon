# PayFlow AI

> **Autonomous Procurement, AI Contract-to-Invoice & Financial Command Center**  
> *Built for the PayPal AI Hackathon: "Build What's Next with PayPal and AI"*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![PayPal REST API](https://img.shields.io/badge/PayPal-v2%20Checkout%20%26%20Invoicing-0070ba.svg)](https://developer.paypal.com/)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini%202.5-indigo.svg)](https://ai.google.dev/)
[![AG Grid](https://img.shields.io/badge/Table-AG%20Grid%20Community%20v32-emerald.svg)](https://www.ag-grid.com/)

---

## 1. Executive Summary & Product Overview

**PayFlow AI** bridges the gap between unstructured business intent and verified payment execution. Modern enterprises and agencies face friction in two core financial operations:
1. **Procurement**: Sourcing multi-station equipment bundles that satisfy complex constraints while strictly honoring budget caps.
2. **Billing**: Parsing agreements, scopes of work, and meeting transcripts into itemized, audit-compliant invoices.

PayFlow AI unifies these workflows under an autonomous, AI-driven financial operating system powered by **PayPal Sandbox REST APIs** and **Google Gemini 2.5 Flash**, with **deterministic fallback engines** and **strict simulation isolation**.

---

## 2. Core Functional Modules

### 🛒 Module A: Agentic Procurement (Buyer Workflow)
- **Natural-Language Intent Understanding**: Enter freeform requests like *"Equip a 5-person remote engineering team with 4K monitors, mechanical keyboards, and noise-canceling headsets under $3,500."*
- **Trusted 32-Item B2B Catalog**: Products, specifications, supplier information, and inventory levels are validated against `catalog.json`. Prices are strictly verified on the backend—preventing AI hallucinations or client-side tampering.
- **Budget-Constraint Optimization**: An optimization algorithm ensures selected items remain strictly within the budget ceiling, reporting surplus and savings percentages.
- **Editable AG Grid Cart**: Double-click quantity cells to adjust units; subtotals and budgets recompute instantly.
- **PayPal Checkout & Capture**: Creates an official PayPal Sandbox Order (`intent: CAPTURE`), provides the official approval link, and executes backend capture with immediate ledger recording.

### 📄 Module B: Autonomous Contract-to-Invoice (Merchant Workflow)
- **Document & Meeting Notes Extraction**: Paste client agreements, scopes of work, or hourly billing notes.
- **Structured Field Parsing**: Automatically extracts line items, quantities, hourly rates, flat fees, tax percentages, due dates, payment terms, and recipient billing emails.
- **Ambiguity Detection**: Highlights missing or ambiguous contractual terms instead of inventing values.
- **Editable AG Grid Workspace**: Review and edit deliverable descriptions, quantities, unit prices, and tax rates in real time.
- **PayPal Invoicing API Dispatch**: Generates a sequential invoice number, registers the invoice on PayPal Sandbox, and optionally dispatches it to the recipient with explicit merchant authorization.

### 📊 Module C: Financial Command Center & AI Dispute Resolver
- **Unified Transaction Ledger**: Real-time persistent tracking of Orders, Captures, Invoices, and Refunds in `ledger.json`.
- **Search, Filter & Sorting**: Quick search across transaction IDs, descriptions, and customer information; filter by transaction type or mode.
- **One-Click CSV Export**: Instant audit export via `gridApi.exportDataAsCsv()`.
- **AI Dispute Resolver**:
  - Compares customer claims (e.g. duplicate charges, damaged goods, non-delivery) against recorded transaction proof.
  - Classifies claims, computes a confidence score, provides an evidence audit trail, and calculates the maximum eligible refundable amount.
  - Executes authorized refunds through the PayPal Capture Refund API or the simulation ledger with user confirmation.

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | React 18, Vite | High-performance SPA with fast HMR |
| **Grid & Data Tables** | AG Grid Community v32 (`ag-grid-react`) | Interactive, editable data tables & CSV export |
| **Styling & UI** | Tailwind CSS, Lucide React, Google Fonts | Enterprise dark fintech aesthetics |
| **Payment SDK** | `@paypal/react-paypal-js` & PayPal REST APIs | Order creation, buyer approval, capture, invoicing, refunds |
| **AI Orchestration** | `@google/genai` (Gemini 2.5 Flash) | Natural language parsing, bundling, and dispute triage |
| **Backend API** | Node.js (ES modules), Express.js | Secure REST API server with rate limiting |
| **Data Validation** | Zod | Strict schema validation for all endpoints |
| **Security** | Helmet, CORS, Express-Rate-Limit | Header hardening, origin protection, DDoS mitigation |
| **Testing** | Node.js Native Test Runner (`node --test`) | Automated unit and integration tests |

---

## 4. Architecture & Monorepo Structure

```
PayPal_AI_Hackathon/
├── backend/
│   ├── src/
│   │   ├── config/            # System configuration & environment checks
│   │   ├── controllers/       # HTTP controllers (agent, paypal, ledger, catalog, config)
│   │   ├── data/
│   │   │   ├── catalog.json   # 32-item B2B catalog across 9 enterprise categories
│   │   │   └── ledger.json    # Persistent transaction ledger with atomic writes
│   │   ├── middleware/        # Security headers, rate limiting, error handlers
│   │   ├── routes/            # Express routers
│   │   ├── services/
│   │   │   ├── aiAgentService.js     # Contract parser and dispute triage agents
│   │   │   ├── catalogService.js    # Catalog lookup and cart price validation
│   │   │   ├── configService.js     # Credential management and health diagnostics
│   │   │   ├── geminiService.js     # Gemini 2.5 Flash SDK integration
│   │   │   ├── ledgerService.js     # Atomic ledger persistence & queries
│   │   │   ├── paypalService.js     # PayPal OAuth, Orders, Invoicing, Refunds
│   │   │   └── procurementService.js# AI & deterministic budget optimization
│   │   ├── validators/        # Zod request validation schemas
│   │   └── server.js          # Express app entrypoint
│   ├── tests/
│   │   └── payflow.test.js    # Automated test suite (8 tests)
│   ├── .env.example           # Backend environment template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DemoBanner.jsx      # Collapsible judge demo banner
│   │   │   ├── Navbar.jsx          # Top navigation with live API status pills
│   │   │   └── SettingsModal.jsx   # In-app credential configuration modal
│   │   ├── pages/
│   │   │   ├── CommandCenterPage.jsx # Transaction ledger & AI dispute resolver
│   │   │   ├── InvoicingPage.jsx     # AI Contract-to-Invoice workspace
│   │   │   └── ProcurementPage.jsx   # Agentic procurement workspace
│   │   ├── services/
│   │   │   └── api.js              # Centralized backend HTTP client
│   │   ├── App.jsx                 # App routing & PayPal Script Provider
│   │   ├── index.css               # Tailwind & AG Grid Quartz Dark theme
│   │   └── main.jsx
│   ├── .env.example           # Frontend environment template
│   └── package.json
├── .gitignore
├── LICENSE                    # MIT License
├── package.json               # Root orchestration scripts
├── render.yaml                # Render Blueprint deployment config
└── README.md
```

---

## 5. Getting Started & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher (v24.x tested)
- **npm**: v9.0.0 or higher

### Step 1: Clone and Install Dependencies
From the workspace root:
```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Return to root
cd ..
```

Or run via the root script:
```bash
npm run install:all
```

### Step 2: Environment Setup
Backend configuration:
```bash
cp backend/.env.example backend/.env
```
Default `backend/.env` contents:
```ini
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
CATALOG_CURRENCY=USD
LOG_LEVEL=info
ADMIN_SECRET=payflow-dev-secret
```

Frontend configuration:
```bash
cp frontend/.env.example frontend/.env
```

> **Note**: Even if you do **not** provide PayPal or Gemini credentials immediately, PayFlow AI will run seamlessly in **Simulation & Deterministic Fallback Mode**. You can also enter and test credentials at any time directly through the UI via **Configure Keys** in the top navigation.

---

## 6. Running the Application

### Option A: Run Both Services Concurrently
From the root directory:
```bash
npm run dev
```

### Option B: Run Services Individually
Terminal 1 (Backend):
```bash
cd backend
npm run dev
# Server starts at http://localhost:5000
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
# Vite dev server starts at http://localhost:5173
```

Open your browser at **`http://localhost:5173`**.

---

## 7. Automated Testing

PayFlow AI includes an automated test suite verifying:
- Catalog lookup and SKU resolution
- Cart price validation against trusted catalog data
- Budget-constraint enforcement and deterministic optimization
- Extreme low-budget trade-off handling
- Contract-to-invoice parsing and tax calculations
- Ledger queries, search, and persistence
- Zod request schema validation
- Unauthorized credential update rejection

Run tests from the backend directory:
```bash
cd backend
npm test
```
Result:
```
✔ 1. Catalog: Load items and lookup by SKU
✔ 2. Cart Validation: Validates trusted prices and quantities
✔ 3. Procurement: Deterministic optimization respects budget constraint
✔ 4. Procurement: Extreme low budget handles unmet constraints gracefully
✔ 5. Contract-to-Invoice: Extracts line items, rates, and 8% tax correctly
✔ 6. Ledger: Reads records, supports search and isolation
✔ 7. Validation: Zod schemas block invalid requests
✔ 8. Security: Credential update rejects unauthorized attempts
ℹ tests 8 | pass 8 | fail 0
```

---

## 8. Simulation Mode vs. Live Sandbox Mode

PayFlow AI adheres strictly to the hackathon's truth-in-advertising guidelines:

| Feature | Simulation Mode (DEMO) | Live PayPal Sandbox Mode |
|---|---|---|
| **Activation** | Automatic when credentials absent, or toggleable | When valid Client ID & Secret configured |
| **Transaction IDs** | Prefixed with `DEMO-ORD-`, `DEMO-CAP-`, `DEMO-INV-` | Genuine PayPal Sandbox IDs |
| **UI Banner** | Prominent amber **SIMULATION** banner displayed | Green **PayPal: Sandbox** status pill |
| **External Calls** | Never sends simulated IDs to PayPal endpoints | Genuine calls to `https://api-m.sandbox.paypal.com` |
| **Ledger Isolation** | Recorded with `mode: "simulation"` | Recorded with `mode: "real"` |

---

## 9. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check & safe connection status diagnostic |
| `GET` | `/api/catalog` | List B2B catalog products with optional category/search filters |
| `GET` | `/api/ledger` | Query transaction records with search, filter, and pagination |
| `POST` | `/api/agent/procure` | Run procurement agent (Gemini or deterministic optimizer) |
| `POST` | `/api/agent/contract-to-invoice` | Parse contract text into structured invoice draft |
| `POST` | `/api/agent/dispute-triage` | Analyze customer complaint against ledger evidence |
| `POST` | `/api/paypal/create-order` | Create PayPal order (with catalog price verification) |
| `POST` | `/api/paypal/capture-order/:orderId` | Capture approved PayPal order |
| `POST` | `/api/paypal/create-invoice` | Create and optionally dispatch PayPal invoice |
| `POST` | `/api/paypal/refund/:captureId` | Execute authorized refund on eligible capture |
| `POST` | `/api/config/credentials` | Secure administrative credential update and test |

---

## 10. Deployment (Render)

A [`render.yaml`](render.yaml) blueprint is included for deploying to [Render](https://render.com):
1. Connect your repository to Render.
2. Select **Blueprints** and choose `render.yaml`.
3. Set your secret environment variables in the Render dashboard:
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
   - `GEMINI_API_KEY`
4. Deploy the unified web service.

---

## 11. License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
