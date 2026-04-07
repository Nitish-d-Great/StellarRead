# ⭐ StellarRead

**Autonomous AI Agent · Pay-Per-Read News · x402 Micropayments on Stellar**

> An intelligent news-reading platform where an autonomous AI agent manages content acquisition, article summarization and Web3 sector impact analysis — all gated by the x402 HTTP payment protocol and settled on the Stellar network.

**🌐 Live Demo:** [stellarread.vercel.app](https://stellarread.vercel.app)  
**🔗 Backend API:** [stellarread.onrender.com](https://stellarread.onrender.com/health)  
**🏆 Built for:** Stellar Agents x402 Hackathon 2026

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [How x402 Works](#how-x402-works-on-stellar)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Pricing Model](#pricing-model)
- [Screenshots](#screenshots)
- [License](#license)

---

## Overview

StellarRead demonstrates how autonomous AI agents can transact independently using the **x402 HTTP payment protocol** on the **Stellar blockchain**. The platform delivers a real-time crypto news feed where every interaction — fetching articles, generating AI summaries and performing sector impact analysis — is metered and settled through micro-USDC payments on Stellar's Soroban smart contracts.

When a user connects their Freighter wallet and funds a session, the app deploys an **ephemeral agent wallet** that autonomously handles all payments. The user only needs to approve wallet signatures — the agent decides when to pay and how much, based on reading behavior.

---

## Key Features

### 🤖 Autonomous Agent
- Monitors reading progress in real-time
- Automatically triggers x402 payment requests when ≥80% of articles are read
- Manages an ephemeral session wallet funded by the user at session start
- Tracks cumulative spend against a user-defined budget cap

### ⚡ x402 Protocol Integration
- Full HTTP 402 challenge-response flow for every paid resource
- Three distinct x402-gated endpoints with independent pricing
- Soroban USDC settlement on Stellar Testnet via OpenZeppelin Channels facilitator
- Payment proof headers (`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`)

### 🧠 AI-Powered Compute (Groq LLM)
- **Article Summarization** — Concise 50–80 word summaries via Llama 3.1 8B Instant ($0.05/summary)
- **Sector Impact Analysis** — Structural and financial impact assessment for the Web3/blockchain sector ($0.02/analysis)
- Both AI services are individually x402-gated — pay only when you use them

### 📰 Live Crypto News Feed
- Real-time articles from CryptoCompare, CoinDesk RSS, or Financial Modeling Prep
- Category detection (Bitcoin, Ethereum, Stellar, DeFi, NFT, Regulation, etc.)
- 4-column responsive layout: Billing Sidebar → Article Grid → Reading Digest → Impact Analysis

### � Tip the Author
- Direct micropayments to article authors (0.01 USDC per tip)
- One-click tipping with no input required — simply click "Tip The Author" button
- All tips are x402-gated and settled on Stellar via Soroban
- Transparent transaction history showing tip recipients and amounts

### 💳 Session Billing & Transparency
- Real-time session billing dashboard showing articles read, batches purchased, summaries, impacts, tips, and total spend
- Budget progress bar with automatic exhaustion detection
- Full transaction log with Stellar Explorer links for every payment
- End-of-session summary with complete transaction history

---

## How x402 Works on Stellar

```
User reads articles → Agent detects ≥80% read → Triggers x402 payment

x402 Flow (for every paid request):

  1. Client sends an unpaid HTTP request to the server
  2. Server returns HTTP 402 + PAYMENT-REQUIRED header
     (contains price, asset, recipient, network details)
  3. Client's agent wallet builds & signs a Soroban payment
  4. User approves the wallet signature in Freighter
  5. Client retries the request with PAYMENT-SIGNATURE header
  6. Server forwards to OpenZeppelin facilitator for verification
  7. Facilitator settles the USDC payment on Soroban
  8. Server returns the resource + PAYMENT-RESPONSE header
```

This implementation uses **x402 v2 headers** and **Soroban USDC exact payments** on Stellar Testnet. The facilitator (OpenZeppelin Channels) handles on-chain settlement so the server never touches user funds directly.

---

## Architecture

```
┌──────────────────────────────────────────────────────────-┐
│                     FRONTEND (React/Vite)                 │
│                                                           │
│  LandingPage ──→ NewsFeedPage ──→ ConfirmationPage        │
│       │                │                                  │
│  useFreighter     StellarX402Service                      │
│  (wallet hook)    (x402 client + Soroban signer)          │
└──────────────┬───────────────────────────────────────────-┘
               │  HTTP + x402 Headers
               ▼
┌──────────────────────────────────────────────────────────-┐
│                   BACKEND (Express/Node.js)               │
│                                                           │
│  POST /api/articles       → x402-gated news batches       │
│  POST /api/chat/summarize → x402-gated AI summaries       │
│  POST /api/chat/impact    → x402-gated impact analysis    │
│  GET  /api/articles/free  → free initial batch            │
│  GET  /health             → server health check           │
│       │                                                   │
│  x402 Resource Server ──→ OpenZeppelin Channels           │
│  News API Service     ──→ CryptoCompare / CoinDesk        │
│  Groq LLM Client     ──→ Groq Cloud (Llama 3.1)           │
└─────────────────────────────────────────────────────────-─┘
               │
               ▼
┌───────────────────────────────────────────────────────-───┐
│              STELLAR TESTNET (Soroban)                    │
│                                                           │
│  USDC Token (SEP-41) ──→ Publisher Address                │
│  Facilitator settles payments on-chain                    │
│  All transactions visible on Stellar Expert Explorer      │
└────────────────────────────────────────────────────────-──┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Frontend** | React 18, Vite 5 | UI framework and build tool |
| **Styling** | Vanilla CSS | Premium dark theme with glassmorphism, particles, gradients |
| **Wallet** | Freighter API | Stellar wallet connection and transaction signing |
| **Blockchain** | Stellar SDK, Soroban | On-chain USDC payments and smart contract interaction |
| **Payments** | x402 Protocol (`@x402/stellar`, `@x402/core`) | HTTP-native micropayment protocol |
| **Backend** | Express.js, Node.js | API server with x402 resource gating |
| **AI/LLM** | Groq SDK (Llama 3.1 8B Instant) | Article summarization and sector impact analysis |
| **News Data** | CryptoCompare API, CoinDesk RSS, FMP API | Real-time crypto/Web3 news sourcing |
| **Facilitator** | OpenZeppelin Channels | x402 payment verification and on-chain settlement |
| **Hosting** | Vercel (frontend), Render (backend) | Production deployment |

---

## Project Structure

```
stellarread/
├── index.html                         # Vite entry HTML
├── vite.config.js                     # Vite config with Node polyfills
├── package.json                       # Frontend dependencies
├── .env.example                       # Frontend env template
│
├── src/                               # React Frontend
│   ├── main.jsx                       # App entry point
│   ├── App.jsx                        # Router + session state management
│   │
│   ├── pages/
│   │   ├── LandingPage.jsx            # Wallet connection, budget setup, agent deployment
│   │   ├── LandingPage.css            # Futuristic dark theme with floating particles
│   │   ├── NewsFeedPage.jsx           # 4-column news feed with AI features
│   │   ├── NewsFeedPage.css           # Responsive grid layout
│   │   ├── ConfirmationPage.jsx       # End-of-session summary with tx history
│   │   └── ConfirmationPage.css
│   │
│   ├── components/
│   │   ├── Header.jsx / .css          # Top bar with wallet address + spend counter
│   │   ├── ArticleCard.jsx / .css     # Individual article card with read state
│   │   ├── BillingCounter.jsx / .css  # Session billing HUD (batches, summaries, impacts)
│   │   └── AgentLog.jsx / .css        # Live transaction log with status indicators
│   │
│   ├── services/
│   │   ├── stellarX402.js             # x402 payment client (payForBatch, payForSummary, payForImpact)
│   │   ├── newsApi.js                 # Frontend news API helpers
│   │   └── agentBrain.js              # Agent decision logic (interest matching)
│   │
│   ├── hooks/
│   │   └── useFreighter.js            # React hook for Freighter wallet connection
│   │
│   ├── styles/
│   │   └── global.css                 # Design system tokens (light/dark theme variables)
│   │
│   └── data/
│       └── articles.js                # Demo fallback articles
│
└── server/                            # Express Backend
    ├── index.js                       # Server entry, CORS, middleware, route mounting
    ├── package.json                   # Backend dependencies
    ├── .env.example                   # Backend env template
    │
    ├── routes/
    │   ├── articles.js                # x402-gated POST /api/articles + free batch endpoint
    │   ├── chat.js                    # x402-gated POST /api/chat/summarize & /api/chat/impact
    │   └── facilitator.js             # Facilitator debug/inspection endpoints
    │
    ├── services/
    │   ├── x402.js                    # x402 resource server setup + route pricing config
    │   ├── newsApi.js                 # Multi-source news fetcher (CryptoCompare, CoinDesk, FMP)
    │   ├── stellarVerify.js           # Stellar payment signature verification
    │   └── replayProtection.js        # Prevents double-spending of payment proofs
    │
    └── middleware/                     # Express middleware utilities
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18.0.0
- **Freighter Wallet** browser extension ([freighter.app](https://freighter.app))
- **Stellar Testnet** account funded via [Friendbot](https://friendbot.stellar.org)
- **Testnet USDC** — the app handles USDC trustlines automatically during session setup
- **API Keys** — Groq (AI), CryptoCompare or FMP (news)

### 1. Clone the Repository

```bash
git clone https://github.com/Nitish-d-Great/StellarRead.git
cd StellarRead
```

### 2. Setup the Backend

```bash
cd server
cp .env.example .env
```

Edit `server/.env` with your credentials:

```env
# Stellar
STELLAR_NETWORK=TESTNET
PUBLISHER_ADDRESS=G...          # Your Stellar address (receives USDC payments)

# Facilitator (OpenZeppelin Channels)
FACILITATOR_STELLAR_PRIVATE_KEY=S...   # Funded testnet secret key
FACILITATOR_URL=https://channels.openzeppelin.com/x402/testnet
FACILITATOR_API_KEY=your-api-key

# News Source
NEWS_SOURCE=cryptocompare
CRYPTOCOMPARE_API_KEY=your-key

# AI
GROQ_API_KEY=gsk_your-groq-key

# Server
PORT=3001
FRONTEND_URL=http://localhost:5173
```

Install and run:

```bash
npm install
npm run dev    # Starts on http://localhost:3001
```

### 3. Setup the Frontend

```bash
# From the repository root
cp .env.example .env
```

Edit `.env`:

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_STELLAR_NETWORK=TESTNET
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
```

Install and run:

```bash
npm install
npm run dev    # Starts on http://localhost:5173
```

### 4. Configure Freighter

1. Open the Freighter browser extension
2. Switch to **Testnet** in Settings → Network
3. Ensure your account has testnet XLM (use [Friendbot](https://friendbot.stellar.org/?addr=YOUR_ADDRESS))
4. The app will automatically set up USDC trustlines during session initialization

---

## Environment Variables

### Frontend (`.env` in root)

| Variable | Required | Description |
|:---------|:---------|:------------|
| `VITE_BACKEND_URL` | Yes | Backend API base URL |
| `VITE_STELLAR_NETWORK` | Yes | `TESTNET` or `PUBLIC` |
| `VITE_HORIZON_URL` | Yes | Stellar Horizon server URL |
| `VITE_STELLAR_NETWORK_CAIP2` | No | CAIP-2 identifier for Stellar network |

### Backend (`server/.env`)

| Variable | Required | Description |
|:---------|:---------|:------------|
| `STELLAR_NETWORK` | Yes | `TESTNET` or `PUBLIC` |
| `PUBLISHER_ADDRESS` | Yes | Stellar address that receives USDC payments for articles & AI services |
| `AUTHOR_WALLET_ADDRESS` | Yes | Stellar address that receives tips (article author address) |
| `FACILITATOR_STELLAR_PRIVATE_KEY` | Yes | Funded Stellar secret key for facilitator |
| `FACILITATOR_URL` | Yes | OpenZeppelin Channels endpoint |
| `FACILITATOR_API_KEY` | Yes | API key for the facilitator service |
| `NEWS_SOURCE` | Yes | `cryptocompare`, `coindesk_rss`, or `fmp` |
| `CRYPTOCOMPARE_API_KEY` | Conditional | Required when `NEWS_SOURCE=cryptocompare` |
| `FMP_API_KEY` | Conditional | Required when `NEWS_SOURCE=fmp` |
| `GROQ_API_KEY` | Yes | Groq Cloud API key for LLM inference |
| `PRICE_PER_BATCH` | No | USDC per batch (default: `0.10`) |
| `ARTICLES_PER_BATCH` | No | Articles per batch (default: `10`) |
| `PORT` | No | Server port (default: `3001`) |
| `FRONTEND_URL` | Yes | Allowed CORS origin for the frontend |

---

## Deployment

### Frontend → Vercel

1. Import the GitHub repository on [vercel.com](https://vercel.com)
2. Set **Framework Preset** to `Vite`
3. Set **Root Directory** to `./` (repository root)
4. Add environment variables (`VITE_BACKEND_URL`, `VITE_STELLAR_NETWORK`, etc.)
5. Deploy

### Backend → Render

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect the GitHub repository
3. Set **Root Directory** to `server`
4. Set **Build Command** to `npm install`
5. Set **Start Command** to `npm start`
6. Add all `server/.env` variables in the Environment tab
7. After deploying, update `FRONTEND_URL` to your Vercel domain (no trailing slash)

### Linking the Two Services

After both are deployed, ensure:
- The frontend's `VITE_BACKEND_URL` points to the Render URL
- The backend's `FRONTEND_URL` points to the Vercel URL (exact match, no trailing slash)

---

## Pricing Model

All prices are denominated in **USDC** and settled on **Stellar Testnet** via Soroban.

| Service | Price | x402 Endpoint | Description |
|:--------|:------|:--------------|:------------|
| Article Batch | $0.10 | `POST /api/articles` | 10 crypto news articles per batch |
| AI Summary | $0.05 | `POST /api/chat/summarize` | 50–80 word article summary via Groq |
| Impact Analysis | $0.02 | `POST /api/chat/impact` | 40–50 word Web3 sector impact assessment || Tip the Author | $0.01 | `POST /api/chat/tip` | Direct micropayment to article author (fixed amount) |
### Session Budget Options

| Budget | Approximate Capacity |
|:-------|:---------------------|
| $0.50 | ~50 articles + several AI queries |
| $1.00 | ~100 articles + AI queries (recommended) |
| $2.00 | ~200 articles + extensive AI usage |

---

## User Flow

1. **Connect Wallet** — User connects Freighter on Stellar Testnet
2. **Configure Session** — Select reading interests, choose a budget ($0.50 / $1.00 / $2.00)
3. **Fund Agent** — Approve a one-time USDC transfer to the ephemeral agent wallet via Freighter
4. **Read Articles** — Browse the initial free batch of crypto news
5. **Auto Top-Up** — When ≥80% of articles are read, the agent autonomously triggers a paid x402 request for the next batch
6. **AI Features** — Click any article to summarize it or analyze its sector impact (each is an independent x402 payment)
7. **End Session** — View the complete session summary with all transactions and Stellar Explorer links

---

## Facilitator Modes

The x402 server supports two facilitator modes:

### Hosted Facilitator (Recommended)
Uses `HTTPFacilitatorClient` from `@x402/core/server` connected to [OpenZeppelin Channels](https://channels.openzeppelin.com). The facilitator verifies payment signatures and settles transactions on Soroban. Configure with `FACILITATOR_URL` + `FACILITATOR_API_KEY`.

### In-Process Facilitator
Uses `FACILITATOR_STELLAR_PRIVATE_KEY` only (no `FACILITATOR_URL`). Your key sponsors fees locally. Set `X402_FACILITATOR_MODE=local` to force this mode when both URL and local key exist.

Generate a testnet facilitator key:
```bash
curl https://channels.openzeppelin.com/testnet/gen
```

---

## License

MIT

---

**⭐ Stellar · x402 Protocol · Freighter · Groq AI · Soroban · CryptoCompare · React + Express**
