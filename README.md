# ⭐ StellarRead

**Pay-Per-Read News · x402 on Stellar · Stellar Agents Hackathon 2026**

---

## How it works (x402 on Stellar)

```
User reads articles → when read ratio reaches threshold (>=80%), app requests next batch

x402 flow for POST /api/articles:
  1) Client sends unpaid request
  2) Server returns HTTP 402 + PAYMENT-REQUIRED
  3) Client builds payment payload (stellar exact scheme)
  4) Freighter signs auth entry (user approval)
  5) Client retries with PAYMENT-SIGNATURE
  6) Server verifies + facilitator settles on Soroban
  7) Server returns articles + PAYMENT-RESPONSE
```

This implementation uses x402 v2 headers (`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`,
`PAYMENT-RESPONSE`) and Soroban USDC exact payments on Stellar testnet.

### Facilitator (verify + settle)

The server can use either:

- **Hosted facilitator (recommended)** — `HTTPFacilitatorClient` from `@x402/core/server` talking to [OpenZeppelin Channels](https://channels.openzeppelin.com) (`FACILITATOR_URL` + `FACILITATOR_API_KEY`), same idea as the [1-shot-stellar Guide](https://github.com/oceans404/1-shot-stellar/blob/main/x402-app/Guide.md). Generate a testnet key with `curl https://channels.openzeppelin.com/testnet/gen`.
- **In-process facilitator** — `FACILITATOR_STELLAR_PRIVATE_KEY` only (no `FACILITATOR_URL`); your key sponsors fees locally.

Set `X402_FACILITATOR_MODE=local` if you need to force in-process when both URL and a local key exist.

---

## Setup

### 1. Install Freighter wallet
- Download from https://freighter.app
- Switch network to **Testnet** in Freighter settings
- Copy your public key (starts with G...) for the app user
- Fund with testnet USDC for payer tests (for x402 payments)

### 2. Backend

```bash
cd server
cp .env.example .env
# Edit .env:
#  - set PUBLISHER_ADDRESS (news provider receiving USDC)
#  - set FACILITATOR_URL + FACILITATOR_API_KEY (hosted facilitator), OR
#    FACILITATOR_STELLAR_PRIVATE_KEY (in-process facilitator only)
#  - ensure publisher has a trustline for testnet USDC issuer:
#    GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
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
    ├── routes/articles.js        # x402-gated POST /api/articles
    ├── routes/facilitator.js     # facilitator inspection/debug endpoints
    └── services/
        ├── x402.js               # x402 resource server + in-process facilitator
        └── newsApi.js            # CryptoCompare fetch
```

---

## Hackathon submission checklist

- [x] Open source repo
- [ ] 2–3 min demo video
- [x] Stellar testnet interaction (Soroban settlement via facilitator)
- [x] x402 protocol (HTTP 402 challenge + payment headers + settlement)
- [x] Agent orchestration (auto-triggering payment flow based on read progress)

---

**⭐ Stellar · x402 · Freighter · CryptoCompare · React + Express**
