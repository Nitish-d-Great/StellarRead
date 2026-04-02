/**
 * StellarRead — x402 Payment Service (Frontend)
 *
 * Spec-compliant Stellar x402 (v2):
 * - Uses Soroban SEP-41 token transfer authorization entries
 * - Uses HTTP headers: PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE
 * - Facilitator sponsors fees + settles on-chain
 */

import { signAuthEntry } from '@stellar/freighter-api';
import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import { ExactStellarScheme } from '@x402/stellar/exact/client';

const CONFIG = {
  BACKEND_URL:        import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
  ARTICLES_PER_BATCH: 10,
  STELLAR_NETWORK_CAIP2: import.meta.env.VITE_STELLAR_NETWORK_CAIP2 || 'stellar:testnet',
  STELLAR_RPC_URL: import.meta.env.VITE_STELLAR_RPC_URL || '',
};

export { CONFIG };

/** Stellar testnet USDC (classic asset backing SEP-41); receiver must hold a trustline. */
const TESTNET_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

/**
 * x402 "exact" on Stellar uses Soroban USDC (SEP-41). Contract #13 can mean:
 * - payer has no USDC, or
 * - receiver (PUBLISHER_ADDRESS) has no USDC trustline — your wallet can still show USDC.
 */
function formatX402PaymentBuildError(err) {
  const raw = err?.message || String(err);
  if (/trustline/i.test(raw)) {
    return (
      'The x402 payee account (PUBLISHER_ADDRESS in server/.env) is missing a USDC trustline on testnet. ' +
      'Your wallet balance is not the issue. Sign in as the publisher key and submit a Change Trust for ' +
      `USDC, issuer ${TESTNET_USDC_ISSUER} (Stellar Lab → Transactions → Change Trust, or Freighter), then retry.`
    );
  }
  if (
    /simulation failed/i.test(raw) ||
    /Error\(Contract,\s*#13\)/i.test(raw) ||
    /Contract.*#\s*13/i.test(raw) ||
    /insufficient/i.test(raw)
  ) {
    return (
      'Not enough testnet USDC in this wallet for the x402 payment (Soroban simulation failed). ' +
      'x402 uses USDC on Soroban, not XLM. Fund your Freighter address with Stellar testnet USDC ' +
      '(e.g. https://faucet.circle.com — choose Stellar testnet), then try again.'
    );
  }
  return raw.length > 400 ? `${raw.slice(0, 400)}…` : raw;
}

class StellarX402Service {
  constructor() {
    this.userAddress         = null;   // user's Freighter wallet
    this.sessionBudget       = 0;
    this.totalSpent          = 0;
    this.transactions        = [];
    this.batchCount          = 0;
    this.isInitialized       = false;
  }

  /**
   * Free first batch — no x402, no payment.
   * Used to hydrate the feed with 10 articles immediately.
   */
  async fetchFreeBatch() {
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/articles/free`);
    if (!response.ok) throw new Error(`Free batch error: ${response.status}`);
    const data = await response.json();
    return data.articles || [];
  }

  /**
   * Full initialization:
   * - Store wallet address + session settings
   */
  async initialize(userAddress, budgetXLM = 1.0) {
    this.userAddress   = userAddress;
    this.sessionBudget = budgetXLM;
    this.totalSpent    = 0;
    this.transactions  = [];
    this.batchCount    = 0;

    this.isInitialized = true;
  }

  /** Call from feed if user opened /feed without going through LandingPage (e.g. refresh). */
  ensureSession(walletAddress, budgetXLM = 1.0) {
    if (!walletAddress) return;
    if (!this.isInitialized) this.initialize(walletAddress, budgetXLM);
  }

  hasBudget() {
    // Budgeting here is UX-only; on-chain balance is enforced by the token contract.
    return this.totalSpent <= this.sessionBudget;
  }

  getRemainingBudget() {
    return Math.max(0, this.sessionBudget - this.totalSpent).toFixed(4);
  }

  /**
   * Spec-compliant x402 payment:
   *   1) POST /api/articles (no payment) → 402 + PAYMENT-REQUIRED
   *   2) Create Soroban transfer auth-entry payment payload (Freighter signs auth entry)
   *   3) Retry POST /api/articles with PAYMENT-SIGNATURE
   *   4) Read PAYMENT-RESPONSE for settlement result
   */
  async payForBatch() {
    if (!this.isInitialized) throw new Error('Service not initialized');
    if (!this.userAddress) throw new Error('Wallet not connected');

    const batchNum = this.batchCount + 1;

    // Build x402 client (Freighter signs auth entries)
    const signer = {
      address: this.userAddress,
      signAuthEntry: async (authEntryXdr) => {
        return await signAuthEntry(authEntryXdr, { address: this.userAddress });
      },
    };

    const core = new x402Client().register(
      'stellar:*',
      new ExactStellarScheme(signer, CONFIG.STELLAR_RPC_URL ? { url: CONFIG.STELLAR_RPC_URL } : undefined),
    );
    const httpClient = new x402HTTPClient(core);

    // 1) Unpaid request to get PAYMENT-REQUIRED
    const first = await fetch(`${CONFIG.BACKEND_URL}/api/articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (first.status !== 402) {
      if (!first.ok) throw new Error(`Backend error: ${first.status}`);
      const data = await first.json();
      throw new Error(`Expected 402 PAYMENT-REQUIRED, got 200 (${data?.count || 'unknown'} articles)`);
    }

    const paymentRequired = httpClient.getPaymentRequiredResponse(
      (name) => first.headers.get(name),
      await first.json().catch(() => ({})),
    );

    // 2) Build + sign Soroban transfer (simulation fails if payer has no USDC)
    let paymentPayload;
    try {
      paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
    } catch (e) {
      throw new Error(formatX402PaymentBuildError(e));
    }

    // 3) Retry request with PAYMENT-SIGNATURE
    const paid = await fetch(`${CONFIG.BACKEND_URL}/api/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...httpClient.encodePaymentSignatureHeader(paymentPayload),
      },
    });

    if (!paid.ok) {
      const err = await paid.json().catch(() => ({}));
      throw new Error(`PAYMENT_REJECTED: ${err?.error || err?.message || paid.status}`);
    }

    const settlement = httpClient.getPaymentSettleResponse((name) => paid.headers.get(name));
    const data = await paid.json();

    const txHash = settlement.transaction;
    const txRecord = {
      batch: batchNum,
      network: settlement.network,
      transaction: txHash,
      hash: txHash,
      payer: settlement.payer,
      timestamp: new Date().toISOString(),
      status: settlement.success ? 'confirmed' : 'failed',
      scheme: 'exact',
      asset: paymentRequired?.accepts?.[0]?.asset,
      amount: paymentRequired?.accepts?.[0]?.amount,
      explorerUrl: txHash
        ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
        : null,
    };

    this.transactions.push(txRecord);
    this.batchCount = batchNum;
    // Best-effort budget UX: increment by configured "price" in decimal units if available
    const priceMaybe = paymentRequired?.accepts?.[0]?.amount;
    if (typeof priceMaybe === 'string' && /^\d+$/.test(priceMaybe)) {
      // Can't reliably convert token units back to decimal without knowing decimals; keep as 0 for now.
      this.totalSpent += 0;
    }

    return { txRecord, articles: data.articles };
  }

  getSessionSummary() {
    return {
      batchCount:       this.batchCount,
      totalSpent:       parseFloat(this.totalSpent.toFixed(6)),
      transactions:     [...this.transactions],
      budgetRemaining:  parseFloat(this.getRemainingBudget()),
      sessionBudget:    this.sessionBudget,
      articlesUnlocked: this.batchCount * CONFIG.ARTICLES_PER_BATCH,
      asset:            'SEP-41 Token (e.g., USDC)',
      network:          CONFIG.STELLAR_NETWORK_CAIP2,
    };
  }

  reset() {
    this.totalSpent      = 0;
    this.transactions    = [];
    this.batchCount      = 0;
    this.isInitialized   = false;
    console.log('🔄 StellarX402: session reset');
  }
}

let _instance = null;
export function getStellarX402Service() {
  if (!_instance) _instance = new StellarX402Service();
  return _instance;
}

export default StellarX402Service;