# ⭐ StellarRead

**Pay-Per-Read News · x402 on Stellar · Stellar Agents Hackathon 2026**

---

## How it works

```
User reads articles → buffer drops to ≤ 2 unread → Agent triggers

Agent:
  1. Pays 0.10 XLM on Stellar (signed via Freighter)
  2. Sends tx hash to backend as x-payment-proof header
  3. Backend verifies tx on Stellar Horizon:
       ✓ tx confirmed on-chain
       ✓ destination = publisher address
       ✓ amount ≥ 0.10 XLM
       ✓ asset = XLM
       ✓ tx not already used (replay protection)
  4. Backend returns 10 fresh articles from CryptoCompare
```

The Stellar tx hash IS the access credential. No API keys. No subscriptions.

---

## Setup

### 1. Install Freighter wallet
- Download from https://freighter.app
- Switch network to **Testnet** in Freighter settings
- Copy your public key (starts with G...) — this is your PUBLISHER_ADDRESS
- Fund with free XLM: https://friendbot.stellar.org?addr=YOUR_ADDRESS

### 2. Backend

```bash
cd server
cp .env.example .env
# Edit .env — set PUBLISHER_ADDRESS to your Freighter address
npm install
npm run dev        # runs on http://localhost:3001
```

### 3. Frontend

```bash
# From root
cp .env.example .env
# VITE_BACKEND_URL=http://localhost:3001 (already set)
npm install
npm run dev        # runs on http://localhost:5173
```

---

## Project structure

```
stellarread/
├── src/                          # React frontend
│   ├── services/stellarX402.js   # x402 payment client
│   ├── hooks/useFreighter.js     # Freighter wallet hook
│   ├── pages/
│   │   ├── LandingPage.jsx       # Connect wallet + set budget
│   │   ├── NewsFeedPage.jsx      # Feed + agent buffer logic
│   │   └── ConfirmationPage.jsx  # Session summary + tx hashes
│   └── components/
│       ├── AgentLog.jsx          # Live tx feed in sidebar
│       ├── BillingCounter.jsx
│       ├── ArticleCard.jsx
│       └── Header.jsx
└── server/                       # Express backend
    ├── index.js                  # Server entry
    ├── routes/articles.js        # GET /instructions, POST /
    ├── middleware/x402Verify.js  # x402 enforcement
    └── services/
        ├── stellarVerify.js      # Horizon tx verification
        ├── replayProtection.js   # Prevent tx reuse
        └── newsApi.js            # CryptoCompare fetch
```

---

## Hackathon submission checklist

- [x] Open source repo
- [ ] 2–3 min demo video
- [x] Stellar testnet interaction (real XLM transactions via Freighter)
- [x] x402 protocol (real HTTP 402 → Horizon verify → HTTP 200)
- [x] AI agent (autonomous buffer management + payments)

---

**⭐ Stellar · x402 · Freighter · CryptoCompare · React + Express**
