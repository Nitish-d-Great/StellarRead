# StellarRead — How It Works

> **A deep dive into the architecture, user flow, and payment mechanics behind StellarRead — the world's first AI-agent-powered, pay-per-read news platform built on the x402 protocol and the Stellar blockchain.**

---

## Table of Contents

1. [Introduction](#introduction)
2. [The Problem We're Solving](#the-problem-were-solving)
3. [High-Level Architecture](#high-level-architecture)
4. [The Three Actors](#the-three-actors)
5. [Complete User Journey — Step by Step](#complete-user-journey--step-by-step)
   - [Phase 1: Wallet Connection](#phase-1-wallet-connection)
   - [Phase 2: Agent Deployment & Funding](#phase-2-agent-deployment--funding)
   - [Phase 3: Reading & Autonomous Payment](#phase-3-reading--autonomous-payment)
   - [Phase 4: AI-Powered Analysis (Paid Compute)](#phase-4-ai-powered-analysis-paid-compute)
   - [Phase 5: Session Summary & On-Chain Proof](#phase-5-session-summary--on-chain-proof)
6. [The x402 Payment Protocol — In Detail](#the-x402-payment-protocol--in-detail)
   - [What is x402?](#what-is-x402)
   - [The Three-Step x402 Handshake](#the-three-step-x402-handshake)
   - [How StellarRead Implements x402](#how-stellarread-implements-x402)
7. [The Autonomous Agent — Architecture](#the-autonomous-agent--architecture)
   - [Ephemeral Agent Wallet](#ephemeral-agent-wallet)
   - [Reading Progress Monitoring](#reading-progress-monitoring)
   - [Budget Management](#budget-management)
8. [Facilitator Architecture](#facilitator-architecture)
   - [HTTP Facilitator (OpenZeppelin Channels)](#http-facilitator-openzeppelin-channels)
   - [Local In-Process Facilitator](#local-in-process-facilitator)
9. [Server-Side Architecture](#server-side-architecture)
   - [x402 Resource Server](#x402-resource-server)
   - [Route Registration & Pricing](#route-registration--pricing)
   - [News Aggregation Pipeline](#news-aggregation-pipeline)
   - [Replay Protection](#replay-protection)
10. [Frontend Architecture](#frontend-architecture)
    - [Component Hierarchy](#component-hierarchy)
    - [State Management](#state-management)
    - [Real-Time Agent Feedback](#real-time-agent-feedback)
11. [Data Flow Diagrams](#data-flow-diagrams)
12. [Security Model](#security-model)
13. [Session Lifecycle — Complete Timeline](#session-lifecycle--complete-timeline)

---

## Introduction

**StellarRead** is a pay-per-read Web3 news platform where an autonomous AI agent manages micropayments on your behalf. Instead of monthly subscriptions or ad-supported models, StellarRead introduces a fundamentally new content monetization paradigm: **HTTP-native micropayments via the x402 protocol, settled in USDC on the Stellar blockchain.**

Every time you need more articles, your AI agent detects this, negotiates an x402 payment with the server, signs a Soroban token transfer authorization, and has the facilitator settle the transaction on-chain — all in under 2 seconds. You read; the agent pays.

This article explains exactly how every component works, from the moment you connect your wallet to the final on-chain settlement receipt.

---

## The Problem We're Solving

Traditional content monetization is broken:

| Model | Problem |
|-------|---------|
| **Subscriptions** | Users pay $10–30/month for content they may barely use. One-size-fits-all pricing excludes casual readers. |
| **Advertising** | Degrades user experience, creates perverse incentives for clickbait, and enables surveillance capitalism. |
| **Paywalls** | Hard paywalls lock out discovery; soft paywalls train users to circumvent them. |
| **Tips / Donations** | Unpredictable revenue, relies on goodwill, not sustainable for publishers. |

**StellarRead's answer:** Pay exactly for what you consume. $0.10 unlocks 10 articles. $0.05 gets you an AI summary. $0.02 buys a sector impact analysis. Every payment is a real, auditable transaction on the Stellar blockchain. No subscriptions. No ads. No tracking. Just content and cryptographic proof of payment.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                              │
│                                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────────────┐    │
│  │ Freighter │   │  React App   │   │  StellarX402 Service     │    │
│  │  Wallet   │◄──│  (Vite/JSX)  │──►│  (x402 Client + Signer) │    │
│  └──────────┘   └──────────────┘   └───────────┬──────────────┘    │
│                                                 │                   │
└─────────────────────────────────────────────────┼───────────────────┘
                                                  │
                        HTTP (x402 headers)       │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       EXPRESS BACKEND                                │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────────────┐   │
│  │ x402 HTTP    │   │ News API     │   │ Groq AI Service       │   │
│  │ Resource     │   │ Aggregator   │   │ (Llama 3.1 8B)        │   │
│  │ Server       │   │ (Multi-src)  │   │                       │   │
│  └──────┬───────┘   └──────────────┘   └───────────────────────┘   │
│         │                                                           │
└─────────┼───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    FACILITATOR LAYER                                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  OpenZeppelin Channels (HTTP Facilitator)                   │    │
│  │  OR                                                         │    │
│  │  In-Process Facilitator (local key)                         │    │
│  │                                                             │    │
│  │  • Verifies Soroban auth entries                            │    │
│  │  • Sponsors transaction fees                                │    │
│  │  • Submits to Stellar network                               │    │
│  │  • Returns settlement proof                                 │    │
│  └─────────────────────────────────┬───────────────────────────┘    │
│                                    │                                │
└────────────────────────────────────┼────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  STELLAR BLOCKCHAIN (Testnet)                       │
│                                                                     │
│  ┌─────────────┐   ┌──────────────────┐   ┌──────────────────┐    │
│  │  Soroban    │   │  USDC Token      │   │  Horizon API     │    │
│  │  Runtime    │   │  (SEP-41)        │   │  (Query/Submit)  │    │
│  └─────────────┘   └──────────────────┘   └──────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The Three Actors

StellarRead's architecture revolves around three distinct actors:

### 1. The Human User 🧑

- Connects their **Freighter** wallet (Stellar browser extension)
- Selects a session budget ($0.50 / $1.00 / $2.00)
- Approves the initial USDC funding transaction to the agent wallet
- Reads articles and requests AI analyses
- **Does NOT manually trigger payments** — the agent handles this

### 2. The Autonomous AI Agent 🤖

- Lives entirely in the browser (client-side JavaScript)
- Has its own **ephemeral Stellar keypair** (generated fresh each session)
- Monitors the user's reading progress in real-time
- When ≥80% of articles are read, autonomously initiates an x402 payment
- Signs Soroban token transfer authorizations using Ed25519
- Manages budget caps and prevents overspending
- Logs all decisions transparently in the Agent Log panel

### 3. The x402 Resource Server 🖥️

- Express.js backend that gates premium content behind x402
- Returns `HTTP 402 Payment Required` for unpaid requests
- Delegates payment verification and settlement to the **Facilitator**
- Only releases content after on-chain settlement confirmation
- Also serves as the Groq AI inference gateway for summaries and impact analyses

---

## Complete User Journey — Step by Step

### Phase 1: Wallet Connection

```
User clicks "Connect Freighter"
        │
        ▼
┌─────────────────────────────┐
│  useFreighter Hook          │
│                             │
│  1. isConnected() → check   │
│     if extension installed  │
│  2. requestAccess() → open  │
│     Freighter popup         │
│  3. getAddress() → retrieve │
│     public key (G...)       │
│  4. getNetworkDetails() →   │
│     verify TESTNET          │
└─────────────────────────────┘
        │
        ▼
  Address stored in React state
  UI transitions to Setup step
```

The `useFreighter` hook wraps the `@stellar/freighter-api` v5 SDK. It handles:
- **Auto-reconnection** on page load (if the site was previously approved)
- **Error handling** for declined connections, missing extensions, and network mismatches
- **Network detection** to ensure the user is on Stellar Testnet

**Why Freighter?** Freighter is Stellar's official browser wallet extension. It acts as a secure keystore and transaction signer — the user's private key never leaves the extension. StellarRead only ever receives the user's *public key*.

---

### Phase 2: Agent Deployment & Funding

This is the most technically sophisticated part of the onboarding flow. When the user clicks "Start Session", a precise sequence of 5 on-chain operations executes:

```
User clicks "Start Session ($1.00)"
        │
        ▼
Step 1: Generate Ephemeral Agent Keypair
        │   StellarSdk.Keypair.random()
        │   → Agent gets a fresh G.../S... keypair
        │   → Secret key stored ONLY in browser memory
        │
        ▼
Step 2: Fund Agent with XLM (Friendbot)
        │   POST https://friendbot.stellar.org?addr={agentPubKey}
        │   → Agent receives 10,000 XLM (testnet)
        │   → This covers Stellar account reserves + fees
        │
        ▼
Step 3: Add USDC Trustline to Agent
        │   agent signs ChangeTrust operation
        │   Asset: USDC / GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
        │   → Agent can now hold USDC on Stellar
        │
        ▼
Step 4: Transfer USDC from User → Agent
        │   Freighter popup appears
        │   User approves Payment operation
        │   Amount: $1.00 USDC (or selected budget)
        │   → USDC moves from user's Freighter wallet to agent wallet
        │
        ▼
Step 5: Initialize x402 Service
        │   stellarService.initialize(address, budget, agentSecret)
        │   → Agent secret stored in StellarX402Service singleton
        │   → Session is now fully autonomous
        │
        ▼
  Navigate to /feed
```

**Why an Ephemeral Wallet?**

The ephemeral agent wallet is a critical security design decision:

1. **Isolation**: The agent only has access to the session budget, not the user's full wallet
2. **Autonomy**: The agent can sign x402 payments without prompting the user each time
3. **Disposability**: After the session ends, the keypair is discarded — no lingering access
4. **Transparency**: Every transaction from this wallet is visible on Stellar Explorer

The user's Freighter wallet only signs ONE transaction — the initial funding. After that, the agent operates independently within the budget cap.

---

### Phase 3: Reading & Autonomous Payment

This is where the x402 magic happens. The flow is entirely event-driven:

```
┌────────────────────────────────────────────────────────────────┐
│                    READING LOOP                                 │
│                                                                 │
│  1. Load free batch (10 articles, no payment)                   │
│  2. User reads articles (clicks to expand)                      │
│  3. readIds Set tracks which articles are read                  │
│  4. React useEffect monitors readRatio = read / total           │
│                                                                 │
│  ┌───────────────────────────────────────┐                      │
│  │  readRatio >= 0.80 ?                  │                      │
│  │  (80% of current articles read)       │                      │
│  │                                       │                      │
│  │  YES → agentFetchBatch()              │                      │
│  │    │                                  │                      │
│  │    ├─ Check hasBudget()               │                      │
│  │    ├─ stellarService.payForBatch()    │                      │
│  │    │   ├─ POST /api/articles (no pay) │                      │
│  │    │   │   └─ Server: 402 + headers   │                      │
│  │    │   ├─ Parse PAYMENT-REQUIRED      │                      │
│  │    │   ├─ Build Soroban auth entry    │                      │
│  │    │   │   └─ Agent signs with Ed25519│                      │
│  │    │   ├─ POST /api/articles (paid)   │                      │
│  │    │   │   └─ PAYMENT-SIGNATURE hdr   │                      │
│  │    │   ├─ Facilitator settles on-chain│                      │
│  │    │   ├─ Read PAYMENT-RESPONSE       │                      │
│  │    │   └─ Return articles + txRecord  │                      │
│  │    ├─ Append new articles to feed     │                      │
│  │    ├─ Update transactions list        │                      │
│  │    └─ Log decision in Agent Log       │                      │
│  │                                       │                      │
│  │  NO → Wait for more reads            │                      │
│  └───────────────────────────────────────┘                      │
│                                                                 │
│  5. Repeat until budget exhausted                               │
└────────────────────────────────────────────────────────────────┘
```

**The 80% Threshold Logic:**

The agent uses a simple but effective heuristic: when the user has read at least 80% of their current article buffer, it's time to fetch more. This is implemented as a React `useEffect` that fires whenever `readIds` or `articles.length` changes:

```javascript
const readRatio = total > 0 ? (read / total) : 0;
const shouldTopUp = readRatio >= 0.80 || (unread / total) <= 0.20;
```

A **5-second debounce** prevents double-firing on rapid state updates. The agent also checks `hasBudget()` before every payment attempt, ensuring it never exceeds the session cap.

---

### Phase 4: AI-Powered Analysis (Paid Compute)

Beyond article access, StellarRead offers two AI-powered services, each gated behind its own x402 paywall:

#### Article Summarization ($0.05 USDC)

```
User clicks "Ask Agent to Summarize"
        │
        ▼
stellarService.payForSummary(title, content)
        │
        ├─ POST /api/chat/summarize (no payment)
        │   └─ Server: 402 + PAYMENT-REQUIRED
        │
        ├─ Build payment payload (0.05 USDC)
        │   └─ Agent signs Soroban auth entry
        │
        ├─ POST /api/chat/summarize (with PAYMENT-SIGNATURE)
        │   ├─ Facilitator settles 0.05 USDC on Stellar
        │   ├─ Server calls Groq API (Llama 3.1 8B)
        │   │   System: "Summarize into 20-30 word bulleted digest"
        │   └─ Returns summary + payment proof
        │
        └─ Summary appears in Reading Digest panel
```

#### Sector Impact Analysis ($0.02 USDC)

```
User clicks "Analyze Sector Impact"
        │
        ▼
stellarService.payForImpact(title, content)
        │
        ├─ Same x402 handshake as above
        ├─ Price: 0.02 USDC
        ├─ Groq prompt: "How does this impact Web3/crypto sector?"
        │   System: "Limit response to 40-50 words"
        └─ Impact appears in Impact Analysis panel
```

**Key insight:** These AI services are not free APIs with a payment bolt-on. The x402 payment is a *prerequisite* — the server literally will not call the Groq API until it has cryptographic proof of on-chain settlement. The payment and the compute are atomically linked through the x402 protocol.

---

### Phase 5: Session Summary & On-Chain Proof

When the user clicks "End Session", the app navigates to the Confirmation page with a complete audit trail:

```
┌──────────────────────────────────────────────────┐
│               SESSION COMPLETE ✓                  │
│                                                   │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐        │
│  │  8   │  │  1   │  │ 0.17 │  │ 0.33 │        │
│  │ARTICLES│ │BATCHES│ │ SPENT │  │REMAIN│        │
│  │ READ │  │ PAID │  │(USD) │  │(USD) │         │
│  └──────┘  └──────┘  └──────┘  └──────┘        │
│                                                   │
│  Stellar Transactions:                            │
│  ┌─────────────────────────────────────────┐     │
│  │ Batch #1  0.10 USDC  ✓ Confirmed       │     │
│  │ Tx: c9ea0...5b72  → Stellar Explorer ↗ │     │
│  │ 05/04/2026, 14:18:29                   │     │
│  ├─────────────────────────────────────────┤     │
│  │ Batch #2  0.05 USDC  ✓ Confirmed       │     │
│  │ Tx: d0b4b...aba9  → Stellar Explorer ↗ │     │
│  │ 05/04/2026, 14:18:43                   │     │
│  ├─────────────────────────────────────────┤     │
│  │ Batch #3  0.02 USDC  ✓ Confirmed       │     │
│  │ Tx: f3270...4baa  → Stellar Explorer ↗ │     │
│  └─────────────────────────────────────────┘     │
│                                                   │
│  Every transaction is independently verifiable    │
│  on the Stellar public ledger.                    │
└──────────────────────────────────────────────────┘
```

Every transaction hash is a clickable link to [Stellar Expert](https://stellar.expert/explorer/testnet), where anyone can independently verify:
- The exact USDC amount transferred
- The sender (agent wallet) and receiver (publisher)
- The precise timestamp and ledger number
- The Soroban smart contract invocation details

---

## The x402 Payment Protocol — In Detail

### What is x402?

**x402** repurposes the long-dormant [HTTP 402 Payment Required](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402) status code — originally reserved in the HTTP/1.1 spec for "future use" — into a fully functional, machine-readable payment protocol.

The core idea is brilliantly simple: **any HTTP endpoint can request payment before delivering a resource.** Instead of API keys, OAuth tokens, or subscription checks, the server simply says "pay me" using standard HTTP headers, and the client pays using on-chain tokens.

```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: {"accepts":[{"scheme":"exact","network":"stellar:testnet",
  "payTo":"GABC...","asset":"stellar:testnet/...","amount":"1000000"}]}
```

### The Three-Step x402 Handshake

Every x402 payment in StellarRead follows this precise sequence:

#### Step 1: Unpaid Request → 402 Challenge

```http
POST /api/articles HTTP/1.1
Content-Type: application/json

(no PAYMENT-SIGNATURE header)
```

```http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64-encoded payment requirements>
Content-Type: application/json

{
  "accepts": [{
    "scheme": "exact",
    "network": "stellar:testnet",
    "payTo": "GABC...",
    "asset": "stellar:testnet/sep41:CBIO...GBBD4...",
    "amount": "1000000"
  }],
  "description": "Unlock the next batch of StellarRead news articles"
}
```

The server declares: "I accept exactly `1000000` stroops of USDC (= $0.10) on Stellar testnet, paid to address `GABC...`."

#### Step 2: Client Signs Payment Payload

The x402 client library (`@x402/core/client` + `@x402/stellar`) processes the `PAYMENT-REQUIRED` response:

1. **Parses** the payment requirements (scheme, network, amount, asset, payTo)
2. **Builds** a Soroban `transfer` authorization entry — this is a SEP-41 token transfer from the agent wallet to the publisher
3. **Agent signs** the auth entry using its Ed25519 keypair (stored in memory from the funding phase)
4. **Encodes** the signed payload into the `PAYMENT-SIGNATURE` header

```javascript
const signer = createEd25519Signer(agentSecret, 'stellar:testnet');
const core = new x402Client().register('stellar:*', new ExactStellarScheme(signer));
const httpClient = new x402HTTPClient(core);
const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
```

#### Step 3: Paid Request → Settlement → Content

```http
POST /api/articles HTTP/1.1
Content-Type: application/json
PAYMENT-SIGNATURE: <base64-encoded signed payment payload>
```

The server receives the signed payload and:

1. **Verifies** the payment signature and requirements match
2. **Delegates** to the Facilitator for on-chain settlement
3. The Facilitator **sponsors transaction fees**, **submits** the Soroban transaction to Stellar, and **returns** the settlement result
4. The server **attaches** `PAYMENT-RESPONSE` headers with the settlement proof (transaction hash, payer, network)
5. Only then does the server **fetch and return** the articles

```http
HTTP/1.1 200 OK
PAYMENT-RESPONSE: <base64-encoded settlement result>
Content-Type: application/json

{
  "success": true,
  "articles": [...],
  "paymentProof": {
    "transaction": "c9ea089943ae254b872edb5a54f3c00f1063a6e847e437a12d0f43f541c5b72",
    "payer": "GDEF...",
    "network": "stellar:testnet"
  }
}
```

### How StellarRead Implements x402

StellarRead uses the **"exact" scheme** on Stellar, which means:

- **Exact amounts**: The client pays precisely the requested amount (not minimum/maximum ranges)
- **Soroban SEP-41**: Payments use Soroban smart contract token transfers, not classic Stellar payments
- **Authorization entries**: Instead of submitting a full transaction, the client signs an authorization entry that the facilitator wraps into a complete transaction
- **Fee sponsorship**: The facilitator pays Stellar network fees, so the agent only needs USDC (not XLM for fees)

---

## The Autonomous Agent — Architecture

### Ephemeral Agent Wallet

The agent wallet is the cornerstone of StellarRead's autonomy model:

```
┌─────────────────────────────────────────┐
│        AGENT WALLET LIFECYCLE           │
│                                         │
│  Session Start:                         │
│    Keypair.random() → G.../S...         │
│    Friendbot funds XLM reserves         │
│    ChangeTrust adds USDC trustline      │
│    User funds USDC from Freighter       │
│                                         │
│  During Session:                        │
│    Agent signs x402 payments            │
│    Each payment: Soroban auth entry     │
│    Budget tracked in-memory             │
│                                         │
│  Session End:                           │
│    Secret key discarded                 │
│    Wallet becomes inaccessible          │
│    Remaining USDC stays on-chain        │
│    (user can recover via secret backup) │
└─────────────────────────────────────────┘
```

**Important**: The agent's secret key (`S...`) is stored **only** in JavaScript memory (`StellarX402Service.agentSecret`). It is never written to localStorage, cookies, or any persistent storage. When the browser tab closes, the key is gone forever.

### Reading Progress Monitoring

The agent's decision logic is implemented as a React `useEffect` that watches two signals:

| Signal | Source | Purpose |
|--------|--------|---------|
| `readIds` | `Set<string>` in React state | Tracks which article IDs the user has clicked/read |
| `articles.length` | Array length | Total articles currently in the feed |

The decision function:

```
readRatio = readIds.size / articles.length

IF readRatio >= 0.80 AND hasBudget() AND !agentRunning AND read > 0:
    → Trigger agentFetchBatch()
    → Execute x402 payment handshake
    → Append new articles to feed
```

Key safeguards:
- **`read > 0`**: Prevents paying immediately after load (user hasn't read anything yet)
- **`!agentRunning`**: Prevents concurrent payment attempts (ref-based lock)
- **5-second debounce**: Prevents rapid-fire triggers from React re-renders
- **`hasBudget()`**: Checks `totalSpent + cost <= sessionBudget + 0.0001` (float tolerance)

### Budget Management

The budget system operates at three layers:

1. **On-chain reality**: The agent wallet holds actual USDC tokens on Stellar
2. **In-memory tracking**: `StellarX402Service.totalSpent` accumulates costs client-side
3. **Display layer**: `BillingCounter` component shows spent/remaining in real-time

```
Budget: $1.00 USDC
├── Batch #1 (10 articles):  -$0.10  →  Remaining: $0.90
├── Summary (article A):     -$0.05  →  Remaining: $0.85
├── Impact (article B):      -$0.02  →  Remaining: $0.83
├── Batch #2 (10 articles):  -$0.10  →  Remaining: $0.73
└── ...continues until exhausted
```

---

## Facilitator Architecture

The **Facilitator** is a critical x402 concept. It's the entity that bridges between signed payment payloads and actual on-chain settlement.

### HTTP Facilitator (OpenZeppelin Channels)

In production mode, StellarRead uses **OpenZeppelin Channels** as the facilitator:

```
Client signs auth entry
        │
        ▼
Server receives PAYMENT-SIGNATURE
        │
        ▼
HTTPFacilitatorClient.verify(payload, requirements)
        │   POST https://channels.openzeppelin.com/x402/testnet/verify
        │   → Validates signature, checks payer balance
        │
        ▼
HTTPFacilitatorClient.settle(payload, requirements)
        │   POST https://channels.openzeppelin.com/x402/testnet/settle
        │   → Facilitator constructs Soroban transaction
        │   → Wraps client's auth entry into full tx envelope
        │   → Sponsors fees (client pays NO gas/fees)
        │   → Submits to Stellar network
        │   → Returns { transaction, payer, network, success }
        │
        ▼
Server receives settlement proof
Server serves content + PAYMENT-RESPONSE headers
```

**Why a facilitator?** Two reasons:
1. **Fee sponsorship**: The agent only needs USDC, not XLM for transaction fees
2. **Transaction construction**: Building a complete Soroban transaction from an auth entry requires RPC access and fee bumping — the facilitator handles this complexity

### Local In-Process Facilitator

For development or self-hosted deployments, StellarRead supports an in-process facilitator:

```javascript
// server/.env
X402_FACILITATOR_MODE=local
FACILITATOR_STELLAR_PRIVATE_KEY=S...
```

In this mode, the server's own Stellar keypair sponsors fees and submits transactions directly to the Stellar network. This eliminates the dependency on OpenZeppelin but requires the server operator to maintain XLM reserves for fee payment.

---

## Server-Side Architecture

### x402 Resource Server

The backend uses the `@x402/core/server` library to create an x402-compliant resource server:

```javascript
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(network, new ExactStellarServer());

const httpServer = new x402HTTPResourceServer(resourceServer, routes);
```

This provides:
- **Automatic 402 responses** for unpaid requests
- **Signature verification** against payment requirements
- **Settlement orchestration** via the facilitator
- **Header management** for PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE

### Route Registration & Pricing

Three x402-protected routes are registered, each with its own price:

| Route | Price | Description |
|-------|-------|-------------|
| `POST /api/articles` | $0.10 USDC | Unlock 10 news articles |
| `POST /api/chat/summarize` | $0.05 USDC | AI article summarization (Groq) |
| `POST /api/chat/impact` | $0.02 USDC | AI sector impact analysis (Groq) |

Plus free routes that don't require payment:

| Route | Description |
|-------|-------------|
| `GET /api/articles/free` | First 10 articles (free, no x402) |
| `GET /api/articles/preview` | Article titles + summaries only |
| `GET /api/articles/instructions` | x402 payment instructions |
| `GET /health` | Server status and configuration |

### News Aggregation Pipeline

The server supports three news sources, configurable via `NEWS_SOURCE` in the environment:

```
                    ┌─── CoinDesk RSS (default, no API key needed)
                    │    RSS XML → parse <item> tags → normalize
NEWS_SOURCE ────────┤
                    ├─── CryptoCompare API (needs API key)
                    │    JSON API → shuffle → normalize
                    │
                    └─── Financial Modeling Prep (needs API key)
                         JSON API → paginate → normalize
```

All sources normalize articles into a common schema:

```json
{
  "id": "unique-identifier",
  "title": "Article Title",
  "summary": "First 200 chars...",
  "content": "Full article body",
  "category": "DeFi | Bitcoin | Ethereum | Stellar | ...",
  "author": "Source Name",
  "readTime": "3 min",
  "publishedAt": "2h ago",
  "image": "https://...",
  "url": "https://original-article-url",
  "source": "CoinDesk"
}
```

Articles are shuffled on each request to provide variety across paid batches.

### Replay Protection

A server-side in-memory `Set` prevents the same x402 payment proof from being used twice:

```
Payment hash submitted
        │
        ▼
isAlreadyUsed(hash) ?
├── YES → 402 "Payment already used"
└── NO  → markAsUsed(hash)
          └── Auto-expires after 10 minutes
              └── Serve content
```

This ensures each on-chain settlement unlocks exactly one batch of content.

---

## Frontend Architecture

### Component Hierarchy

```
App.jsx
├── LandingPage.jsx
│   ├── useFreighter Hook (wallet connection)
│   ├── Interest Selector (tag chips + text input)
│   ├── Budget Selector ($0.50 / $1.00 / $2.00)
│   └── Funding Flow (agent wallet creation)
│
├── NewsFeedPage.jsx
│   ├── Header (wallet address, batch count, spent)
│   ├── BillingCounter (session billing stats)
│   ├── AgentLog (decision history + tx list)
│   ├── ArticleCard[] (news feed grid)
│   ├── Article Modal (full article + AI actions)
│   ├── Reading Digest (summaries panel)
│   └── Impact Sidebar (impact analyses panel)
│
└── ConfirmationPage.jsx
    ├── Session Stats (articles, batches, spent, remaining)
    ├── Transaction List (hashes + explorer links)
    └── x402 Explainer (how the session worked)
```

### State Management

StellarRead uses React's built-in state management (useState + useRef) — no Redux or external stores. State flows unidirectionally:

```
App.jsx (global session state)
  │
  ├── walletAddress     → passed to all pages
  ├── sessionBudget     → passed to NewsFeedPage
  ├── userInterests     → passed to NewsFeedPage
  ├── sessionSummary    → passed to ConfirmationPage
  │
  └── StellarX402Service (singleton)
      ├── agentSecret    → in-memory only
      ├── totalSpent     → drives budget checks
      ├── transactions[] → drives Agent Log + Confirmation
      └── batchCount     → drives UI counters
```

### Real-Time Agent Feedback

The Agent Log panel provides real-time visibility into what the autonomous agent is doing:

| Event | Display |
|-------|---------|
| Reading threshold met | `⏳ Next batch` — "≥80% of articles read — fetching next batch" |
| x402 payment in progress | `⚡ Working...` spinner |
| Settlement confirmed | `✓ Settled` — "x402 batch #N · M articles" |
| Budget exhausted | `🛑 Budget exhausted` banner |
| Error | `⚠️ Error: <message>` |

Each Stellar transaction gets its own card with:
- Batch number
- Transaction hash (linked to Stellar Explorer)
- Timestamp
- "Confirmed on Stellar Testnet" badge

---

## Data Flow Diagrams

### Complete x402 Payment Flow (Articles)

```
   BROWSER                    SERVER                FACILITATOR         STELLAR
     │                          │                       │                  │
     │  POST /api/articles      │                       │                  │
     │  (no PAYMENT-SIGNATURE)  │                       │                  │
     │─────────────────────────>│                       │                  │
     │                          │                       │                  │
     │  402 + PAYMENT-REQUIRED  │                       │                  │
     │<─────────────────────────│                       │                  │
     │                          │                       │                  │
     │  Parse requirements      │                       │                  │
     │  Build Soroban auth      │                       │                  │
     │  Agent signs (Ed25519)   │                       │                  │
     │                          │                       │                  │
     │  POST /api/articles      │                       │                  │
     │  + PAYMENT-SIGNATURE     │                       │                  │
     │─────────────────────────>│                       │                  │
     │                          │  verify(payload)      │                  │
     │                          │──────────────────────>│                  │
     │                          │  { valid: true }      │                  │
     │                          │<──────────────────────│                  │
     │                          │                       │                  │
     │                          │  settle(payload)      │                  │
     │                          │──────────────────────>│                  │
     │                          │                       │  Submit tx       │
     │                          │                       │─────────────────>│
     │                          │                       │  Confirmed       │
     │                          │                       │<─────────────────│
     │                          │  { tx, success }      │                  │
     │                          │<──────────────────────│                  │
     │                          │                       │                  │
     │                          │  Fetch articles       │                  │
     │                          │  from news API        │                  │
     │                          │                       │                  │
     │  200 + PAYMENT-RESPONSE  │                       │                  │
     │  + articles JSON         │                       │                  │
     │<─────────────────────────│                       │                  │
     │                          │                       │                  │
```

---

## Security Model

StellarRead's security is designed around the principle of **minimal trust**:

| Threat | Mitigation |
|--------|------------|
| **Agent overspending** | Client-side budget cap + on-chain USDC balance limit |
| **Stolen agent key** | Ephemeral keypair with limited USDC; discarded after session |
| **Replay attacks** | Server-side in-memory set with 10-minute expiry |
| **Fake payment proofs** | Facilitator verifies Soroban auth entries cryptographically |
| **Man-in-the-middle** | HTTPS + signed payment headers (tamper-evident) |
| **Server-side key leak** | Publisher address is public; facilitator key sponsors fees only |
| **Cross-session tracking** | New agent wallet per session; no cookies or persistent IDs |

---

## Session Lifecycle — Complete Timeline

```
T+0s     User visits stellarread.vercel.app
T+2s     Freighter auto-connects (if previously approved)
T+5s     User selects budget ($1.00) and interests
T+8s     User clicks "Start Session"
T+9s     Agent keypair generated (Keypair.random())
T+11s    Friendbot funds agent XLM
T+14s    Agent adds USDC trustline
T+16s    Freighter popup: approve $1.00 USDC transfer
T+18s    USDC transferred to agent wallet
T+19s    Navigate to /feed
T+20s    Free batch loaded (10 articles, no payment)
T+30s    User reads first article
T+90s    User has read 8/10 articles (80% threshold)
T+91s    Agent: "Reading threshold met — requesting next batch"
T+91s    POST /api/articles → 402 PAYMENT-REQUIRED
T+92s    Agent signs Soroban auth entry (0.10 USDC)
T+92s    POST /api/articles + PAYMENT-SIGNATURE
T+93s    Facilitator verifies + settles on Stellar
T+94s    Server returns 10 new articles + PAYMENT-RESPONSE
T+94s    Agent Log: "Batch #1 settled — 10 articles added"
T+95s    User continues reading...
T+120s   User clicks "Ask Agent to Summarize" ($0.05)
T+121s   x402 handshake for /api/chat/summarize
T+123s   Facilitator settles 0.05 USDC
T+124s   Groq generates summary (Llama 3.1 8B)
T+125s   Summary appears in Reading Digest
...
T+300s   Budget exhausted
T+301s   Agent: "Budget exhausted" banner
T+305s   User clicks "End Session"
T+306s   Confirmation page: full audit trail + Stellar Explorer links
```

---

## Summary

StellarRead demonstrates that a new economic model for content is not only possible but practical today. By combining:

- **x402** for HTTP-native payment negotiation
- **Stellar** for sub-second, sub-cent settlement
- **Soroban** for programmable USDC transfers
- **Autonomous agents** for seamless UX
- **Groq AI** for value-added compute services

...we've built a platform where every piece of content has a fair, transparent, and cryptographically verifiable price — and where the user's AI agent handles the entire payment lifecycle autonomously.

**The future of content isn't subscriptions. It's micropayments. And that future runs on Stellar x402.**

---

*Built for the Stellar Agents x402 Hackathon 2026 · DoraHacks*
