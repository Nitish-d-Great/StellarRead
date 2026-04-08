# StellarRead — Technology Deep Dive

> **A comprehensive exploration of every technology, protocol, chain feature, and AI capability that powers StellarRead — the autonomous agent news platform built on Stellar x402.**

---

## Table of Contents

1. [Technology Overview](#technology-overview)
2. [The x402 Protocol](#the-x402-protocol)
   - [Origin and Purpose](#origin-and-purpose)
   - [x402 vs Traditional Payment Models](#x402-vs-traditional-payment-models)
   - [The x402 Specification (v2)](#the-x402-specification-v2)
   - [x402 on Stellar — The Exact Scheme](#x402-on-stellar--the-exact-scheme)
   - [x402 SDK Architecture](#x402-sdk-architecture)
   - [x402 Header Protocol](#x402-header-protocol)
   - [Why x402 Matters for AI Agents](#why-x402-matters-for-ai-agents)
3. [Stellar Blockchain](#stellar-blockchain)
   - [Why Stellar?](#why-stellar)
   - [Stellar Consensus Protocol (SCP)](#stellar-consensus-protocol-scp)
   - [Sub-Second Finality](#sub-second-finality)
   - [USDC on Stellar — SEP-41 Tokens](#usdc-on-stellar--sep-41-tokens)
   - [Soroban Smart Contracts](#soroban-smart-contracts)
   - [Soroban Authorization Entries](#soroban-authorization-entries)
   - [Transaction Fee Structure](#transaction-fee-structure)
   - [Horizon API](#horizon-api)
   - [Stellar SDK Integration](#stellar-sdk-integration)
   - [Freighter Wallet](#freighter-wallet)
   - [Friendbot (Testnet Faucet)](#friendbot-testnet-faucet)
   - [Trustlines and Asset Management](#trustlines-and-asset-management)
4. [OpenZeppelin Channels — The Facilitator](#openzeppelin-channels--the-facilitator)
   - [What is a Facilitator?](#what-is-a-facilitator)
   - [Fee Sponsorship Model](#fee-sponsorship-model)
   - [Verify → Settle Flow](#verify--settle-flow)
   - [In-Process Alternative](#in-process-alternative)
5. [AI Agent Architecture](#ai-agent-architecture)
   - [Ephemeral Wallet Pattern](#ephemeral-wallet-pattern)
   - [Ed25519 Signing](#ed25519-signing)
   - [Reading Progress Heuristic](#reading-progress-heuristic)
   - [Budget Management Engine](#budget-management-engine)
   - [Agent Decision Logging](#agent-decision-logging)
   - [Autonomous Payment Flow](#autonomous-payment-flow)
6. [Groq AI Inference](#groq-ai-inference)
   - [Why Groq?](#why-groq)
   - [Llama 3.1 8B Instant](#llama-31-8b-instant)
   - [Article Summarization Pipeline](#article-summarization-pipeline)
   - [Sector Impact Analysis Pipeline](#sector-impact-analysis-pipeline)
   - [Prompt Engineering](#prompt-engineering)
   - [Paid Compute — x402 Gated AI](#paid-compute--x402-gated-ai)
7. [Frontend Technology Stack](#frontend-technology-stack)
   - [React 18](#react-18)
   - [Vite Build System](#vite-build-system)
   - [React Router v6](#react-router-v6)
   - [Node Polyfills for Stellar SDK](#node-polyfills-for-stellar-sdk)
   - [Component Architecture](#component-architecture)
   - [CSS Design System](#css-design-system)
   - [Dark Mode Implementation](#dark-mode-implementation)
8. [Backend Technology Stack](#backend-technology-stack)
   - [Express.js Server](#expressjs-server)
   - [Multi-Source News Aggregation](#multi-source-news-aggregation)
   - [CORS and Header Management](#cors-and-header-management)
   - [Replay Protection System](#replay-protection-system)
   - [Environment Configuration](#environment-configuration)
9. [Deployment Architecture](#deployment-architecture)
   - [Vercel (Frontend)](#vercel-frontend)
   - [Render / Railway (Backend)](#render--railway-backend)
   - [Environment Variables](#environment-variables)
10. [Security Technologies](#security-technologies)
11. [Technology Comparison Matrix](#technology-comparison-matrix)

---

## Technology Overview

StellarRead integrates 15+ technologies across 4 layers:

```
┌─────────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER                                                 │
│  React 18 · Vite 5 · React Router 6 · Vanilla CSS · Freighter API   │
├─────────────────────────────────────────────────────────────────────┤
│  APPLICATION LAYER                                                  │
│  Express.js · Groq SDK · Node Fetch · CORS · dotenv                 │
├─────────────────────────────────────────────────────────────────────┤
│  PROTOCOL LAYER                                                     │
│  x402 Protocol (v2) · @x402/core · @x402/stellar · HTTP Headers     │
├─────────────────────────────────────────────────────────────────────┤
│  SETTLEMENT LAYER                                                   │
│  Stellar Network · Soroban · USDC (SEP-41) · Horizon · SCP          │
│  OpenZeppelin Channels (Facilitator)                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The x402 Protocol

### Origin and Purpose

The **HTTP 402 Payment Required** status code was defined in RFC 2616 (1999) as:

> *"This code is reserved for future use."*

For 27 years, HTTP 402 sat dormant — a placeholder waiting for a payment infrastructure that didn't exist yet. x402 finally gives it life.

**x402** is an open protocol that enables any HTTP endpoint to request and receive payment before delivering a resource. It is:

- **HTTP-native**: Uses standard HTTP headers, no WebSockets or custom protocols
- **Machine-readable**: Designed for programmatic clients (AI agents, scripts, APIs), not just browsers
- **Chain-agnostic**: Supports multiple blockchains (Stellar, Ethereum, Base, etc.)
- **Scheme-flexible**: Supports "exact" (fixed price) and other payment schemes

### x402 vs Traditional Payment Models

| Feature | Stripe/PayPal | API Keys | x402 |
|---------|--------------|----------|------|
| **Setup** | Days (KYB, contracts) | Minutes (dashboard) | Zero (protocol-level) |
| **Minimum payment** | $0.50 + fees | N/A | $0.001 (sub-cent) |
| **Machine-native** | No (forms, redirects) | Partial | Yes (HTTP headers) |
| **Censorship-resistant** | No | No | Yes (on-chain) |
| **Settlement** | T+2 days | N/A | ~2 seconds |
| **Proof of payment** | Receipt email | None | Blockchain tx hash |
| **AI Agent friendly** | No | Yes | Yes (designed for agents) |
| **Cross-border** | Complex | N/A | Native |

### The x402 Specification (v2)

x402 v2 defines three HTTP headers:

#### `PAYMENT-REQUIRED` (Server → Client)

Sent with HTTP 402 responses. Contains a base64-encoded JSON payload describing what payment the server accepts:

```json
{
  "accepts": [
    {
      "scheme": "exact",
      "network": "stellar:testnet",
      "payTo": "GABC...",
      "asset": "stellar:testnet/sep41:CBIO...GBBD4...",
      "amount": "1000000",
      "description": "Unlock the next batch of StellarRead news articles",
      "mimeType": "application/json"
    }
  ]
}
```

**Fields:**
- `scheme`: Payment scheme (StellarRead uses "exact" — pay exactly this amount)
- `network`: CAIP-2 network identifier (`stellar:testnet` or `stellar:pubnet`)
- `payTo`: Publisher's Stellar address
- `asset`: Full CAIP-19 asset identifier (Soroban USDC contract + issuer)
- `amount`: Amount in smallest unit (stroops for Stellar: 1 USDC = 10,000,000 stroops)
- `description`: Human-readable description of what the payment unlocks
- `mimeType`: Content type of the gated resource

#### `PAYMENT-SIGNATURE` (Client → Server)

Sent with the retry request after the client has signed the payment:

```
PAYMENT-SIGNATURE: <base64-encoded signed payment payload>
```

Contains:
- The Soroban authorization entry (transfer from payer → payTo)
- The Ed25519 signature from the payer's keypair
- The scheme, network, and amount metadata

#### `PAYMENT-RESPONSE` (Server → Client)

Sent with the 200 OK response after successful settlement:

```
PAYMENT-RESPONSE: <base64-encoded settlement result>
```

Contains:
- `transaction`: Stellar transaction hash
- `payer`: Payer's Stellar address
- `network`: Network where settlement occurred
- `success`: Boolean settlement status

### x402 on Stellar — The Exact Scheme

StellarRead uses the **"exact" payment scheme**, which means:

1. The server specifies a precise payment amount
2. The client must pay exactly that amount (not more, not less)
3. Payment is a Soroban SEP-41 token transfer (not classic XLM)
4. The facilitator handles transaction construction and fee sponsorship

**Why "exact"?** It's the simplest and most predictable scheme:
- Server knows exactly how much to expect
- Client knows exactly how much they'll pay
- No complex negotiation or bidding

### x402 SDK Architecture

StellarRead uses the official x402 SDK packages:

#### Frontend (Client-Side)

```
@x402/core          → Core x402 client logic
  ├── x402Client    → Registers payment schemes per network
  └── x402HTTPClient → HTTP header encoding/decoding

@x402/stellar       → Stellar-specific x402 implementation
  ├── createEd25519Signer → Creates Stellar keypair signer
  └── ExactStellarScheme  → "exact" scheme for Stellar clients
```

**Client-side flow:**
```javascript
// 1. Create signer from agent's secret key
const signer = createEd25519Signer(agentSecret, 'stellar:testnet');

// 2. Register the Stellar exact scheme
const core = new x402Client().register(
  'stellar:*',                        // match all stellar networks
  new ExactStellarScheme(signer, rpcConfig)
);

// 3. Create HTTP client for header management
const httpClient = new x402HTTPClient(core);

// 4. Parse 402 response
const paymentRequired = httpClient.getPaymentRequiredResponse(
  (name) => response.headers.get(name),
  await response.json()
);

// 5. Build + sign payment payload
const paymentPayload = await httpClient.createPaymentPayload(paymentRequired);

// 6. Encode into PAYMENT-SIGNATURE header
const headers = httpClient.encodePaymentSignatureHeader(paymentPayload);

// 7. Read settlement result from response
const settlement = httpClient.getPaymentSettleResponse(
  (name) => response.headers.get(name)
);
```

#### Backend (Server-Side)

```
@x402/core                → Core server + facilitator logic
  ├── x402ResourceServer  → Manages payment verification per route
  ├── x402HTTPResourceServer → HTTP header processing
  ├── x402Facilitator     → In-process facilitator
  └── HTTPFacilitatorClient → Remote facilitator client

@x402/stellar             → Stellar-specific server logic
  ├── ExactStellarScheme (server) → Verifies exact scheme payloads
  └── ExactStellarScheme (facilitator) → Settles on Stellar
```

**Server-side flow:**
```javascript
// 1. Create facilitator client
const facilitatorClient = new HTTPFacilitatorClient({
  url: 'https://channels.openzeppelin.com/x402/testnet',
});

// 2. Create resource server
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register('stellar:testnet', new ExactStellarServer());

// 3. Register priced routes
const routes = {
  'POST /api/articles': {
    accepts: { scheme: 'exact', network, payTo, price: '0.10' },
    description: 'Unlock news articles',
  },
};

// 4. Create HTTP server
const httpServer = new x402HTTPResourceServer(resourceServer, routes);

// 5. Process requests
const result = await httpServer.processHTTPRequest(request);
// result.type: 'payment-error' | 'payment-verified' | 'no-payment-required'

// 6. Settle
const settled = await httpServer.processSettlement(
  result.paymentPayload,
  result.paymentRequirements,
  result.declaredExtensions,
  transportContext
);
```

### x402 Header Protocol

The complete header exchange for a single StellarRead payment:

```
─── REQUEST 1 (Unpaid) ──────────────────────────────────

→ POST /api/articles HTTP/1.1
→ Content-Type: application/json
→ (no PAYMENT-SIGNATURE)

← HTTP/1.1 402 Payment Required
← PAYMENT-REQUIRED: eyJ2ZXJzaW9uI...  (base64)
← Content-Type: application/json
← { "accepts": [...] }

─── CLIENT PROCESSING ───────────────────────────────────

  Parse PAYMENT-REQUIRED header
  Extract: scheme=exact, network=stellar:testnet,
           amount=1000000, payTo=GABC...
  Build Soroban transfer auth entry
  Sign with Ed25519 (agent keypair)
  Encode as PAYMENT-SIGNATURE

─── REQUEST 2 (Paid) ────────────────────────────────────

→ POST /api/articles HTTP/1.1
→ Content-Type: application/json
→ PAYMENT-SIGNATURE: eyJwYXltZW50...  (base64)

← HTTP/1.1 200 OK
← PAYMENT-RESPONSE: eyJ0cmFuc2Fj...  (base64)
← Content-Type: application/json
← { "success": true, "articles": [...] }
```

### Why x402 Matters for AI Agents

x402 is fundamentally designed for a world where AI agents transact autonomously:

1. **No human-in-the-loop**: The entire negotiate → sign → pay → receive cycle is fully automatable
2. **Machine-readable**: JSON payloads, HTTP headers — no CAPTCHAs, no form filling
3. **Sub-cent capability**: At $0.10 for 10 articles ($0.01/article), x402 enables true micropayments that would be economically irrational with credit card processors
4. **Composable**: An agent can chain x402 calls — use one service's output as input to another, paying each independently
5. **Metered compute**: AI compute (like Groq inference) can be sold per-call with instant settlement

---

## Stellar Blockchain

### Why Stellar?

Stellar was chosen as the settlement layer for StellarRead for specific technical and economic reasons:

| Feature | Stellar | Ethereum L1 | Solana |
|---------|---------|-------------|--------|
| **Finality** | ~5 seconds | ~12 minutes (finalized) | ~0.4 seconds |
| **Transaction fee** | ~$0.00001 | $0.50–$50 | $0.00025 |
| **USDC support** | Native (SEP-41) | Native (ERC-20) | Native (SPL) |
| **Smart contracts** | Soroban (Rust/WASM) | Solidity (EVM) | Rust (BPF) |
| **x402 support** | First-class | First-class | Not yet |
| **Micropayment viability** | ✅ ($0.00001 fee) | ❌ (fees > payment) | ✅ |
| **Fee sponsorship** | Built-in (Soroban) | Gas stations | N/A |

**The key differentiator**: Stellar's fee of ~$0.00001 means the transaction cost is 0.01% of a $0.10 article batch payment. On Ethereum L1, the gas fee alone would exceed the payment amount. This makes Stellar uniquely suited for micropayment applications.

### Stellar Consensus Protocol (SCP)

Stellar uses the **Federated Byzantine Agreement (FBA)** consensus mechanism, which is fundamentally different from Proof of Work or Proof of Stake:

- **No mining**: Zero energy waste
- **No staking**: No capital lockup requirements
- **Quorum slices**: Each node defines its own trust set (quorum slice), and consensus emerges from the intersection of overlapping slices
- **Safety-first**: SCP halts rather than fork — it never produces conflicting transactions

**For StellarRead, this means:**
- Transactions are final in ~5 seconds (no "6 confirmation" waiting)
- No risk of transaction reversal or chain reorganization
- Content delivery can proceed immediately after settlement

### Sub-Second Finality

Stellar's ledger closes every ~5 seconds. Once a transaction is included in a closed ledger, it is **absolutely final** — there is no possibility of reversal.

In StellarRead's x402 flow:
```
Agent signs auth entry          → instant
Facilitator submits to network  → ~1 second
Stellar confirms in next ledger → ~5 seconds
Server delivers content         → immediate after confirmation
Total round-trip                → ~2-3 seconds
```

### USDC on Stellar — SEP-41 Tokens

StellarRead uses **USDC (USD Coin)** on Stellar for all payments. USDC on Stellar exists in two forms:

#### Classic USDC
- Issued by Circle ([GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5](https://stellar.expert/explorer/testnet/asset/USDC-GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5))
- Requires a **trustline** (ChangeTrust operation) to hold
- Used for the initial user → agent funding transfer

#### Soroban USDC (SEP-41)
- The same USDC, accessible via Soroban's smart contract interface
- Enables programmable transfers via authorization entries
- Used by x402's "exact" scheme for settlement
- Has **7 decimal places** (1 USDC = 10,000,000 stroops)

**SEP-41** is Stellar's token standard (analogous to ERC-20 on Ethereum). It defines a standard interface for fungible tokens on Soroban:
- `transfer(from, to, amount)`
- `approve(from, spender, amount)`
- `balance(address)`
- `decimals()`

### Soroban Smart Contracts

**Soroban** is Stellar's smart contract platform, released in 2024. It runs **WebAssembly (WASM)** bytecode compiled from Rust.

StellarRead doesn't deploy custom Soroban contracts — instead, it uses Soroban's **built-in SEP-41 token transfer functionality** via authorization entries. This is how x402's "exact" scheme works on Stellar:

```
Traditional approach:
  User builds full transaction → submits to network

x402/Soroban approach:
  User signs authorization entry → facilitator wraps in real transaction
  → facilitator sponsors fees → facilitator submits to network
```

The authorization entry is essentially a signed "permission slip" that says: *"I authorize USDC transfer of X from my address to address Y."* The facilitator then constructs the full Soroban transaction envelope around this entry.

### Soroban Authorization Entries

This is the core cryptographic primitive that makes x402 work on Stellar:

```
┌───────────────────────────────────────────────-──┐
│            SOROBAN AUTH ENTRY                    │
│                                                  │
│  Contract: USDC SEP-41 Token                     │
│  Function: transfer                              │
│  Args:                                           │
│    from:   G_AGENT_WALLET... (agent's address)   │
│    to:     G_PUBLISHER...    (content publisher) │
│    amount: 1000000           (0.10 USDC)         │
│                                                  │
│  Signature: Ed25519(agent_secret, entry_hash)    │
│                                                  │
│  Note: This is NOT a full transaction.           │
│  The facilitator wraps it into a Soroban tx.     │
└─────────────────────────────────────────────────-┘
```

**Why auth entries instead of full transactions?**
1. **Fee abstraction**: The signer doesn't need XLM for fees
2. **Composability**: Multiple auth entries can be combined into one transaction
3. **Facilitator flexibility**: The facilitator can choose fee rates and submission timing

### Transaction Fee Structure

Stellar's fee model is a key enabler for micropayments:

| Component | Cost |
|-----------|------|
| Base fee | ~100 stroops (~$0.00001) |
| Soroban resource fee | Variable, typically ~$0.0001–$0.001 |
| Facilitator markup | Depends on provider (OZ: typically free on testnet) |
| **Total per x402 payment** | **< $0.001** |

This means a $0.10 article batch payment incurs less than 1% in network fees — making micropayments economically rational for the first time.

### Horizon API

**Horizon** is Stellar's REST API server. StellarRead uses it for:

| Operation | Horizon Endpoint | Usage |
|-----------|-----------------|-------|
| Load account | `GET /accounts/{id}` | Check balances, sequence numbers |
| Submit transaction | `POST /transactions` | Submit signed transactions |
| Transaction details | `GET /transactions/{hash}` | Verify payment proofs |
| Operations for tx | `GET /transactions/{hash}/operations` | Check payment amounts |

StellarRead connects to `https://horizon-testnet.stellar.org` for all Horizon interactions.

### Stellar SDK Integration

StellarRead uses `@stellar/stellar-sdk` v12.3+ for:

```javascript
import * as StellarSdk from '@stellar/stellar-sdk';

// Keypair generation (agent wallet)
const agentKeypair = StellarSdk.Keypair.random();
const publicKey = agentKeypair.publicKey();    // G...
const secretKey = agentKeypair.secret();       // S...

// Horizon client
const horizon = new StellarSdk.Horizon.Server(
  'https://horizon-testnet.stellar.org'
);

// Account loading
const account = await horizon.loadAccount(publicKey);

// Transaction building
const tx = new StellarSdk.TransactionBuilder(account, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET
})
  .addOperation(StellarSdk.Operation.changeTrust({ asset }))
  .addOperation(StellarSdk.Operation.payment({ destination, asset, amount }))
  .setTimeout(30)
  .build();

// Signing
tx.sign(agentKeypair);

// Submission
await horizon.submitTransaction(tx);
```

### Freighter Wallet

**Freighter** is Stellar's official browser extension wallet (analogous to MetaMask for Ethereum):

| Feature | Details |
|---------|---------|
| **Platform** | Chrome, Firefox, Brave browser extension |
| **Networks** | Mainnet, Testnet, Futurenet |
| **API Version** | @stellar/freighter-api v5 |
| **Key Storage** | Encrypted in extension, never exposed to dApps |
| **Signing** | Transaction signing via popup approval |

StellarRead's `useFreighter` hook provides:
```
isConnected()    → Check if extension is installed
isAllowed()      → Check if site has been approved
requestAccess()  → Prompt user for approval (returns address)
getAddress()     → Get public key silently (if allowed)
signTransaction()→ Sign a transaction (opens popup)
getNetworkDetails() → Get current network
```

**Critical security property**: The user's private key never leaves the Freighter extension. StellarRead only ever receives the public key (`G...`) and signed transaction XDR. The user manually approves every transaction via the Freighter popup.

### Friendbot (Testnet Faucet)

**Friendbot** is Stellar's testnet faucet that funds new accounts with 10,000 XLM:

```
GET https://friendbot.stellar.org?addr=GABC...
→ Creates the account on testnet if it doesn't exist
→ Funds it with 10,000 XLM
```

StellarRead uses Friendbot to give the ephemeral agent wallet its initial XLM reserves (required for Stellar account minimum balance and trustline reserves).

### Trustlines and Asset Management

On Stellar, an account must explicitly "opt in" to hold non-native assets via a **trustline**:

```
ChangeTrust Operation:
  Asset: USDC / GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
  Limit: MAX (unlimited)
```

StellarRead adds a USDC trustline to the agent wallet during the funding phase. Without this trustline, the USDC transfer from user → agent would fail, because the agent account wouldn't be able to hold USDC tokens.

Each trustline requires a **2 XLM** reserve (deducted from the account's XLM balance). Since Friendbot provides 10,000 XLM, this is more than sufficient.

---

## OpenZeppelin Channels — The Facilitator

### What is a Facilitator?

In the x402 protocol, the **Facilitator** is the entity that:

1. **Verifies** payment payloads (checks signatures, balances, requirements)
2. **Settles** payments on-chain (constructs, sponsors, and submits transactions)
3. **Returns** settlement proof (transaction hash, status)

The Facilitator is a **trust-minimized**  intermediary. It cannot steal funds (it only executes pre-signed authorizations), but it performs the mechanical work of transaction submission.

### Fee Sponsorship Model

One of the most powerful features of the Facilitator model is **fee sponsorship**:

```
Without Facilitator:
  Agent needs: USDC (for payment) + XLM (for Stellar fees)
  Complexity: Agent must manage two assets

With Facilitator:
  Agent needs: USDC only
  Facilitator pays Stellar fees from its own XLM reserves
  Simplification: Agent only manages one asset
```

This is critical for StellarRead's UX: the user only needs to fund the agent with USDC. All network fees are transparently handled by the Facilitator.

### Verify → Settle Flow

```
Server receives PAYMENT-SIGNATURE header
         │
         ▼
┌─────────────────────────────────────────┐
│  facilitatorClient.verify(              │
│    paymentPayload,                      │
│    paymentRequirements                  │
│  )                                      │
│                                         │
│  Checks:                                │
│  ✓ Signature is valid Ed25519           │
│  ✓ Amount matches requirements          │
│  ✓ Payer has sufficient USDC balance    │
│  ✓ Network matches (stellar:testnet)    │
│  ✓ payTo matches (publisher address)    │
│                                         │
│  Returns: { valid: true }               │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  facilitatorClient.settle(              │
│    paymentPayload,                      │
│    paymentRequirements                  │
│  )                                      │
│                                         │
│  Actions:                               │
│  1. Build Soroban transaction envelope  │
│  2. Insert payer's auth entry           │
│  3. Add facilitator signature (fees)    │
│  4. Submit to Stellar RPC/Horizon       │
│  5. Wait for ledger inclusion           │
│                                         │
│  Returns: {                             │
│    success: true,                       │
│    transaction: "c9ea08...",            │
│    payer: "G_AGENT...",                 │
│    network: "stellar:testnet"           │
│  }                                      │
└─────────────────────────────────────────┘
```

### In-Process Alternative

For self-hosted deployments, StellarRead supports running the facilitator locally:

```javascript
// Environment configuration
X402_FACILITATOR_MODE=local
FACILITATOR_STELLAR_PRIVATE_KEY=S...  // Server's own keypair

// Code path
const facilitatorSigner = createEd25519Signer(faciliterSecret, network);
const facilitator = new x402Facilitator().register(
  network,
  new ExactStellarFacilitator([facilitatorSigner], { rpcConfig })
);
```

**Trade-offs:**

| Feature | HTTP (OpenZeppelin) | Local (In-Process) |
|---------|-------------------|---------------------|
| Setup | API key only | Manage keypair + XLM reserves |
| Reliability | Professionally operated | Self-managed uptime |
| Privacy | Facilitator sees payment data | Fully private |
| Fee control | Provider sets fees | Full control |
| Dependencies | Network call to OZ | No external dependency |

---

## AI Agent Architecture

### Ephemeral Wallet Pattern

The Ephemeral Wallet Pattern is a security architecture where a fresh cryptographic keypair is generated for each user session:

```
Session Start:
  1. StellarSdk.Keypair.random()
     → Generates a cryptographically random Ed25519 keypair
     → Public key: G... (56 chars, base32)
     → Secret key: S... (56 chars, base32)

  2. Secret stored in JavaScript memory (heap)
     → Never serialized to localStorage/cookies/IndexedDB
     → Not accessible from other tabs/windows
     → Garbage collected when tab closes

  3. Friendbot funds XLM
     → Creates account on Stellar network
     → 10,000 XLM for reserves

  4. User funds USDC
     → Single Freighter-approved transaction
     → USDC moves from user wallet → agent wallet
     → Agent is now "fully loaded" and autonomous

Session End:
  5. stellarService.reset()
     → agentSecret set to null
     → Keypair reference removed
     → JavaScript GC will reclaim memory
     → Remaining USDC stays on-chain (cannot be recovered without secret)
```

**Security properties:**
- **Blast radius**: Even if compromised, the agent can only spend its session budget
- **No persistence**: Key exists only in volatile memory (RAM)
- **One-time use**: New keypair every session; no long-lived credentials
- **Isolation**: Agent wallet is completely separate from user's main wallet

### Ed25519 Signing

Stellar (and x402 on Stellar) uses **Ed25519** — an elliptic-curve digital signature algorithm. It provides:

| Property | Value |
|----------|-------|
| Key size | 256 bits (32 bytes) |
| Signature size | 512 bits (64 bytes) |
| Security level | ~128-bit |
| Performance | ~10,000 signatures/second |
| Deterministic | Yes (same message always produces same signature) |

In StellarRead, the Ed25519 signer is created from the agent's secret key:

```javascript
const signer = createEd25519Signer(agentSecret, 'stellar:testnet');
```

This signer is used to:
1. Sign Soroban authorization entries (for x402 payments)
2. The signature proves the agent authorized the USDC transfer
3. The facilitator can verify the signature without knowing the secret key

### Reading Progress Heuristic

The agent's "brain" is a simple but effective algorithm:

```
                  ┌───────────────────────────┐
                  │   React useEffect         │
                  │   watches: readIds,       │
                  │   articles.length         │
                  └─────────────┬─────────────┘
                                │
                                ▼
                  ┌───────────────────────────┐
                  │ readRatio = read / total  │
                  │                           │
                  │ read = 0?                 │─── YES ──→ WAIT
                  │   (user hasn't started)   │
                  └─────────────┬─────────────┘
                                │ NO
                                ▼
                  ┌───────────────────────────┐
                  │ readRatio >= 0.80?        │
                  │ OR unread/total <= 0.20?  │─── NO ──→ WAIT
                  └─────────────┬─────────────┘
                                │ YES
                                ▼
                  ┌───────────────────────────┐
                  │ Debounce: 5 seconds since │
                  │ last trigger?             │─── NO ──→ WAIT
                  └─────────────┬─────────────┘
                                │ YES
                                ▼
                  ┌───────────────────────────┐
                  │ agentRunning = false?     │─── NO ──→ WAIT
                  │ (not already fetching)    │
                  └─────────────┬─────────────┘
                                │ YES
                                ▼
                  ┌───────────────────────────┐
                  │ hasBudget()?              │─── NO ──→ BUDGET
                  │ (can afford 0.10 USDC)    │          EXHAUSTED
                  └─────────────┬─────────────┘
                                │ YES
                                ▼
                        agentFetchBatch()
                        (x402 payment flow)
```

**Why 80%?** This threshold was chosen to balance two competing goals:
- **Too low (e.g., 50%)**: Agent pays too often; user might not read all articles
- **Too high (e.g., 95%)**: User runs out of articles before agent can fetch more (bad UX)
- **80%**: User has 2 unread articles as buffer while the agent fetches 10 more

### Budget Management Engine

The budget system prevents overspending at multiple layers:

```
Layer 1: Client-Side Check (hasBudget)
  ├── totalSpent + cost <= sessionBudget + 0.0001
  │   (0.0001 tolerance for floating point)
  └── Prevents even attempting an x402 payment if over budget

Layer 2: Soroban Balance Check
  ├── Facilitator checks payer's USDC balance during verify()
  └── Transaction fails if agent wallet has insufficient USDC

Layer 3: On-Chain Settlement
  ├── Stellar network validates the Soroban invocation
  └── Transfer fails if actual USDC balance < amount
```

The triple-layer approach ensures that:
- Users are never charged more than their selected budget
- Even if the client-side logic has a bug, on-chain validation prevents overspending
- Budget exhaustion is detected and displayed immediately

### Agent Decision Logging

Every agent action is logged with a structured entry:

```javascript
logAgent({
  type: 'fetch' | 'success' | 'error',
  decision: 'pay' | 'skip' | 'paid',
  reason: 'Human-readable explanation',
  time: new Date().toLocaleTimeString(),
  // Optional:
  relevant: number,  // number of relevant articles
  total: number,     // total articles evaluated
  titles: string[],  // sample article titles
});
```

This creates a transparent audit trail visible in the Agent Log panel, so users can see exactly why and when the agent decided to make each payment.

### Autonomous Payment Flow

The agent operates in three distinct modes:

| Mode | Trigger | Payment |
|------|---------|---------|
| **Free load** | Session start | None (free batch) |
| **Auto-pay (articles)** | ≥80% articles read | $0.10 USDC via x402 |
| **On-demand (summary)** | User clicks "Summarize" | $0.05 USDC via x402 |
| **On-demand (Q&A)** | User clicks "Ask a Question" | $0.03 USDC via x402 |
| **On-demand (impact)** | User clicks "Impact" | $0.02 USDC via x402 |
| **On-demand (tip)** | User clicks "Tip The Author" | $0.01 USDC via x402 |

For auto-pay, the agent acts without any user prompt. For on-demand services, the user initiates the action, but the agent handles all payment mechanics autonomously.

---

## Groq AI Inference

### Why Groq?

**Groq** provides ultra-fast AI inference using their custom **Language Processing Unit (LPU)** hardware:

| Metric | Groq | OpenAI GPT-4 | Anthropic Claude |
|--------|------|-------------|-----------------|
| **Speed** | ~500 tokens/sec | ~40 tokens/sec | ~80 tokens/sec |
| **Latency (first token)** | <100ms | 200-500ms | 200-400ms |
| **Cost** | $0.05/1M input tokens | $30/1M tokens | $15/1M tokens |
| **Model** | Llama 3.1 8B | GPT-4 Turbo | Claude 3.5 Sonnet |

For StellarRead, speed matters more than model size: users want instant summaries, not doctoral dissertations. Groq's Llama 3.1 8B delivers quality summaries in <1 second.

### Llama 3.1 8B Instant

StellarRead uses Meta's **Llama 3.1 8B Instant** model via Groq:

| Property | Value |
|----------|-------|
| **Model ID** | `llama-3.1-8b-instant` |
| **Parameters** | 8 billion |
| **Context window** | 128K tokens |
| **Training data** | Up to December 2023 |
| **Temperature** | 0.3 (low creativity, high accuracy) |
| **Max output** | ~100 tokens (limited by prompt) |

### Article Summarization Pipeline

```
User clicks "Ask Agent to Summarize"
         │
         ▼
┌─────────────────────────────────────────┐
│  x402 Payment Gate                      │
│  POST /api/chat/summarize               │
│  Price: 0.05 USDC                       │
│  Settlement: Soroban USDC transfer      │
└─────────────┬───────────────────────────┘
              │ (payment settled)
              ▼
┌───────────────────────────────────────-──┐
│  Groq API Call                           │
│                                          │
│  System Prompt:                          │
│  "You are a concise News Bot.            │
│   Summarize the provided article         │
│   strictly into a 20-30 word bulleted    │
│   digest. Focus on the core fact or      │
│   event. Do not add conversational       │
│   filler."                               │
│                                          │
│  User Prompt:                            │
│  "Title: {title}                         │
│   Content: {first 3000 chars}..."        │
│                                          │
│  Temperature: 0.3                        │
│  Model: llama-3.1-8b-instant             │
└─────────────┬───────────────────────────-┘
              │
              ▼
         Summary returned
         Display in Reading Digest panel
```

### Article Q&A Pipeline

```
User clicks "Ask a Question", types question, submits
         │
         ▼
┌─────────────────────────────────────────┐
│  x402 Payment Gate                      │
│  POST /api/chat/ask                     │
│  Price: 0.03 USDC                       │
│  Settlement: Soroban USDC transfer      │
└─────────────┬───────────────────────────┘
              │ (payment settled)
              ▼
┌───────────────────────────────────────-──┐
│  Groq API Call                           │
│                                          │
│  System Prompt:                          │
│  "You are a knowledgeable crypto/Web3    │
│   news assistant. Answer the user's      │
│   question based strictly on the         │
│   provided article content. Be concise   │
│   and accurate. Limit your response to   │
│   50-80 words."                          │
│                                          │
│  User Prompt:                            │
│  "Article Title: {title}                 │
│   Article Content: {first 3000 chars}    │
│   Question: {user's question}"           │
│                                          │
│  Temperature: 0.3                        │
│  Model: llama-3.1-8b-instant             │
└─────────────┬───────────────────────────-┘
              │
              ▼
         Answer returned
         Display in article modal
```

### Sector Impact Analysis Pipeline

```
User clicks "Analyze Sector Impact"
         │
         ▼
┌─────────────────────────────────────────┐
│  x402 Payment Gate                      │
│  POST /api/chat/impact                  │
│  Price: 0.02 USDC                       │
│  Settlement: Soroban USDC transfer      │
└─────────────┬───────────────────────────┘
              │ (payment settled)
              ▼
┌─────────────────────────────────────-────┐
│  Groq API Call                           │
│                                          │
│  System Prompt:                          │
│  "You are a concise Web3/Crypto          │
│   Sector Analyst. Answer how the events  │
│   in this article structurally or        │
│   financially impact the broader         │
│   Web3/blockchain/crypto sector.         │
│   Limit your response strictly to        │
│   40-50 words."                          │
│                                          │
│  User Prompt:                            │
│  "Title: {title}                         │
│   Content: {first 3000 chars}..."        │
│                                          │
│  Temperature: 0.3                        │
│  Model: llama-3.1-8b-instant             │
└─────────────┬──────────────────────────-─┘
              │
              ▼
         Impact analysis returned
         Display in Impact Analysis panel
```

### Prompt Engineering

All three AI services use carefully crafted system prompts:

**Summarization prompt design choices:**
- "20-30 word bulleted digest" → Forces extreme brevity
- "Focus on the core fact or event" → Prevents tangential information
- "Do not add conversational filler" → Eliminates "In this article..." patterns
- Temperature 0.3 → Low creativity, high factual accuracy

**Impact analysis prompt design choices:**
- "Structurally or financially impact" → Forces analysis, not summary
- "Broader Web3/blockchain/crypto sector" → Sector-level thinking
- "40-50 words" → Slightly longer than summary, but still concise
- Same temperature (0.3) → Consistency

**Q&A prompt design choices:**
- "Based strictly on the provided article content" → Prevents hallucination beyond article scope
- "Be concise and accurate" → Factual, direct answers
- "50-80 words" → Detailed enough to be useful, concise enough to be scannable
- "If the article does not contain enough information, say so" → Honest about limitations

### Paid Compute — x402 Gated AI

The integration of x402 with AI inference is a key innovation of StellarRead:

```
Traditional AI API:
  API Key → Unlimited calls → Monthly invoice

StellarRead AI:
  No API key needed
  Each call: x402 payment → on-chain settlement → compute
  Pricing: $0.05/summary, $0.03/question, $0.02/impact
  Revenue: Instant, on-chain, auditable
```

This model enables:
1. **Zero-setup monetization**: Any AI service can add x402 pricing without user accounts
2. **Per-call billing**: Users pay only for what they use
3. **Instant settlement**: Revenue is immediately available on Stellar
4. **Audit trail**: Every AI computation has a corresponding on-chain transaction

---

## Frontend Technology Stack

### React 18

StellarRead's frontend is built with **React 18**, using:

| Feature | Usage |
|---------|-------|
| **useState** | All component-level state (articles, readIds, transactions, etc.) |
| **useEffect** | Reading progress monitoring, auto-payment triggers, session initialization |
| **useRef** | Agent lock (`agentRunningRef`), debounce timestamps, free batch tracking |
| **useCallback** | Memoized event handlers for `agentFetchBatch`, `loadFreeBatch` |
| **Functional components** | All components are functions (no class components) |

### Vite Build System

**Vite 5** provides the development and build infrastructure:

| Feature | Configuration |
|---------|--------------|
| **Dev server** | Hot Module Replacement (HMR) at `localhost:5173` |
| **Build** | ES modules + code splitting |
| **Plugins** | `@vitejs/plugin-react` (JSX transform) |
| **Polyfills** | `vite-plugin-node-polyfills` (Buffer, process for Stellar SDK) |
| **Output** | `dist/` directory for Vercel deployment |

The `vite-plugin-node-polyfills` is critical because the Stellar SDK uses Node.js APIs (Buffer, crypto) that don't exist in browsers natively.

### React Router v6

Three-page routing:

```javascript
<Routes>
  <Route path="/"            element={<LandingPage />} />
  <Route path="/feed"        element={<NewsFeedPage />} />
  <Route path="/confirmation" element={<ConfirmationPage />} />
</Routes>
```

Navigation is programmatic via `useNavigate()`:
- Landing → Feed: `navigate('/feed')` after funding
- Feed → Confirmation: `navigate('/confirmation')` on session end
- Confirmation → Landing: `navigate('/')` on new session

### Node Polyfills for Stellar SDK

The Stellar SDK relies on several Node.js built-ins that must be polyfilled for browser use:

```javascript
// vite.config.js
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default {
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream', 'events'],
      globals: { Buffer: true, process: true },
    }),
  ],
};
```

### Component Architecture

| Component | Responsibility | Key Props |
|-----------|---------------|-----------|
| **LandingPage** | Wallet connection, budget selection, agent deployment | onSessionStart, walletAddress |
| **NewsFeedPage** | Article display, reading tracking, agent orchestration, bookmarking | walletAddress, sessionBudget, userInterests, bookmarkedArticles |
| **ConfirmationPage** | Session summary, refund, bookmarked articles | sessionSummary, walletAddress, bookmarkedArticles |
| **Header** | App bar with wallet info and batch stats | walletAddress, totalSpent, batchCount |
| **ArticleCard** | Individual article tile in the feed grid | article, isRead, onClick |
| **BillingCounter** | Real-time session billing dashboard | articlesRead, totalSpent, budgetXLM, ... |
| **AgentLog** | Decision history and Stellar transaction list | transactions, agentLog, agentStatus |

### CSS Design System

StellarRead uses a comprehensive CSS custom properties (variables) system for theming:

```css
:root {
  --bg-primary: #0a0e1a;
  --bg-card: rgba(15, 20, 35, 0.85);
  --stellar-blue: #4C9AFF;
  --accent-purple: #a855f7;
  --accent-green: #22c55e;
  --accent-red: #ef4444;
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --glass-blur: blur(20px);
  --border-subtle: rgba(255, 255, 255, 0.06);
}
```

Design features:
- **Glassmorphism**: Frosted glass effects with `backdrop-filter: blur()`
- **Dark mode**: Full dark theme with optional light mode toggle
- **Animated particles**: CSS animation particles floating in the background
- **Responsive grid**: CSS Grid for article layout, Flexbox for navigation
- **Micro-animations**: Hover effects, fade-ins, spinner animations

### Dark Mode Implementation

Dark mode uses CSS class toggling on `document.documentElement`:

```javascript
const toggleTheme = () => {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
};
```

CSS selects based on the `.dark` class:
```css
.dark { --bg-primary: #0a0e1a; }
:root:not(.dark) { --bg-primary: #f8fafc; }
```

---

## Backend Technology Stack

### Express.js Server

The backend is a lightweight Express.js server with the following middleware stack:

```
Request
  │
  ├── CORS (origin whitelist + x402 headers)
  ├── express.json() (body parsing)
  ├── Request logging (payment-signature detection)
  │
  ├── /api/articles    → articlesRouter
  ├── /api/facilitator → facilitatorRouter
  ├── /api/chat        → chatRouter
  ├── /health          → status endpoint
  │
  ├── 404 handler
  └── Error handler
```

### Multi-Source News Aggregation

The server supports three news providers:

#### CoinDesk RSS (Default)
```
Source: https://www.coindesk.com/arc/outboundfeeds/rss/
Format: RSS XML
Auth: None required
Parsing: Regex-based XML extraction (<item> tags)
Features: Full article content, media:content images
```

#### CryptoCompare API
```
Source: https://min-api.cryptocompare.com/data/v2/news/
Format: JSON
Auth: API key (optional, improves rate limits)
Features: Categories, source info, timestamps
```

#### Financial Modeling Prep (FMP)
```
Source: https://financialmodelingprep.com/stable/news/crypto-latest
Format: JSON
Auth: API key (required)
Features: Pagination, tickers, detailed metadata
```

All sources normalize to a common article schema with: id, title, summary, content, category, author, readTime, publishedAt, image, url, source.

### CORS and Header Management

CORS is configured to expose x402 headers that browsers normally block:

```javascript
app.use(cors({
  origin: [frontendUrl, 'http://localhost:5173'],
  allowedHeaders: [
    'Content-Type',
    'PAYMENT-SIGNATURE',
    'PAYMENT-REQUIRED',
    'PAYMENT-RESPONSE',
  ],
  exposedHeaders: [
    'PAYMENT-REQUIRED',
    'PAYMENT-RESPONSE',
    'PAYMENT-SIGNATURE',
  ],
}));
```

The `exposedHeaders` configuration is critical — without it, the browser's CORS policy would strip the `PAYMENT-REQUIRED` and `PAYMENT-RESPONSE` headers from the response, breaking the x402 protocol entirely.

### Replay Protection System

```javascript
// In-memory Set with auto-expiry
const usedHashes = new Set();
const EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function markAsUsed(txHash) {
  usedHashes.add(txHash);
  setTimeout(() => usedHashes.delete(txHash), EXPIRY_MS);
}

function isAlreadyUsed(txHash) {
  return usedHashes.has(txHash);
}
```

**Why in-memory?** For a hackathon demo, an in-memory Set is sufficient. Production would use Redis with TTL keys for persistence across server restarts.

### Environment Configuration

The server uses a layered environment configuration:

```bash
# Stellar Network
STELLAR_NETWORK=TESTNET
STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# x402 Pricing
PRICE_PER_BATCH=0.10
ARTICLES_PER_BATCH=10

# Publisher (receives payments)
PUBLISHER_ADDRESS=GABC...

# Facilitator
X402_FACILITATOR_MODE=http  # or 'local'
FACILITATOR_URL=             # default: OpenZeppelin testnet
FACILITATOR_API_KEY=         # if using authenticated facilitator

# News Sources
NEWS_SOURCE=coindesk_rss     # or 'cryptocompare' or 'fmp'
CRYPTOCOMPARE_API_KEY=
FMP_API_KEY=

# AI
GROQ_API_KEY=gsk_...

# Server
PORT=3001
FRONTEND_URL=https://stellarread.vercel.app
```

---

## Deployment Architecture

### Vercel (Frontend)

```
┌──────────────────────────────────────┐
│  Vercel Edge Network                 │
│                                      │
│  stellarread.vercel.app              │
│                                      │
│  ├── index.html (SPA entry)          │
│  ├── assets/                         │
│  │   ├── index-[hash].js             │
│  │   └── index-[hash].css            │
│  └── Env vars:                       │
│      VITE_BACKEND_URL                │
│      VITE_STELLAR_NETWORK_CAIP2      │ 
│      VITE_PRICE_PER_BATCH_USD        │
└──────────────────────────────────────┘
```

### Render / Railway (Backend)

```
┌──────────────────────────────────────┐
│  Cloud Container                     │
│                                      │
│  stellarread-server.onrender.com     │
│                                      │
│  ├── node index.js                   │
│  ├── Express on PORT 3001            │
│  └── Env vars:                       │
│      PUBLISHER_ADDRESS               │
│      GROQ_API_KEY                    │
│      STELLAR_NETWORK                 │
│      FACILITATOR_URL                 │
│      NEWS_SOURCE                     │
└──────────────────────────────────────┘
```

---

## Security Technologies

| Technology | Purpose | Implementation |
|------------|---------|----------------|
| **Ed25519** | Transaction signing | Stellar keypair signatures for x402 auth entries |
| **Soroban Auth Entries** | Payment authorization | Signed token transfer permissions |
| **CORS** | Cross-origin security | Whitelist frontend domains, expose x402 headers |
| **HTTPS** | Transport encryption | TLS on both Vercel and backend hosting |
| **Ephemeral Keys** | Session isolation | Fresh keypair per session, never persisted |
| **Replay Protection** | Double-spend prevention | In-memory Set with 10-minute TTL |
| **Budget Caps** | Overspend prevention | Client-side + on-chain double check |
| **Freighter Approval** | Transaction authorization | User manually approves initial funding tx |

---

## Technology Comparison Matrix

### How StellarRead Compares to Traditional Approaches

| Capability | Traditional News Site | Stripe-Gated API | StellarRead |
|------------|----------------------|-------------------|-------------|
| **Payment method** | Credit card / subscription | Credit card | USDC on Stellar |
| **Minimum payment** | $4.99/month | $0.50 | $0.01 |
| **Settlement speed** | T+2 business days | T+2 business days | ~2 seconds |
| **AI integration** | Separate subscription | Separate API | Same payment rail |
| **Agent-compatible** | No | Partially | Natively designed |
| **Audit trail** | Receipt emails | Dashboard | Public blockchain |
| **Cross-border** | Card-dependent | Card-dependent | Global (crypto) |
| **Privacy** | Full KYC | Full KYC | Wallet address only |
| **Infrastructure** | Payment processor + CMS | Payment processor + API gateway | x402 server + Stellar |
| **Revenue split** | 70-85% after processor fees | 97% after Stripe 2.9% | ~99.99% (Stellar fees ≈ $0.00001) |

---

## Full Dependency Tree

### Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.2.0 | UI framework |
| `react-dom` | ^18.2.0 | DOM rendering |
| `react-router-dom` | ^6.20.1 | Client-side routing |
| `@stellar/stellar-sdk` | ^12.3.0 | Stellar blockchain interaction |
| `@stellar/freighter-api` | ^5.0.0 | Freighter wallet integration |
| `@x402/core` | ~2.6.0 | x402 protocol core |
| `@x402/stellar` | ~2.6.0 | x402 Stellar implementation |
| `@x402/fetch` | ^2.8.0 | x402 fetch wrapper |
| `vite` | ^5.0.8 | Build toolchain |
| `@vitejs/plugin-react` | ^4.2.1 | React JSX transform |
| `vite-plugin-node-polyfills` | ^0.22.0 | Node.js API polyfills for browser |

### Backend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.2 | HTTP server framework |
| `cors` | ^2.8.5 | Cross-origin resource sharing |
| `dotenv` | ^16.4.5 | Environment variable loading |
| `groq-sdk` | ^1.1.2 | Groq AI inference client |
| `node-fetch` | ^3.3.2 | HTTP client for news APIs |
| `@stellar/stellar-sdk` | ^12.3.0 | Stellar blockchain interaction |
| `@x402/core` | ~2.6.0 | x402 protocol core (server + facilitator) |
| `@x402/stellar` | ~2.6.0 | x402 Stellar implementation (server + facilitator) |

---

## Key Innovations

### 1. HTTP-Native Micropayments
x402 transforms the HTTP protocol itself into a payment channel. No payment forms, no redirects, no third-party scripts — just HTTP headers.

### 2. Autonomous Agent Economy
The ephemeral agent wallet pattern demonstrates how AI agents can transact independently within user-defined budgets. This is the foundation of the emerging **agentic economy**.

### 3. Paid Compute as a Service
By gating Groq AI calls behind x402, StellarRead demonstrates that compute resources (summarization, impact analysis, Q&A) can be sold per-invocation with instant blockchain settlement — no API keys, no monthly plans, no invoicing.

### 4. Sub-Cent Content Monetization
At $0.01 per article, StellarRead achieves content pricing that is economically impossible with credit card processors (minimum $0.30 per transaction). Stellar's $0.00001 fees make this viable.

### 5. Verifiable Revenue
Every dollar of revenue is a Stellar transaction — auditable, transparent, and impossible to fake. Publishers receive 99.99%+ of the payment amount (vs. 70-85% through traditional processors).

---

*Built with ⭐ Stellar · ⚡ x402 · 🧠 Groq AI · 🤖 Autonomous Agents*

*Stellar Agents x402 Hackathon 2026 · DoraHacks*
