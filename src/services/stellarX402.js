/**
 * StellarRead — x402 Payment Service (Frontend)
 *
 * Spec-compliant Stellar x402 (v2):
 * - Uses Soroban SEP-41 token transfer authorization entries
 * - Uses HTTP headers: PAYMENT-REQUIRED / PAYMENT-SIGNATURE / PAYMENT-RESPONSE
 * - Facilitator sponsors fees + settles on-chain
 */

import { createEd25519Signer } from '@x402/stellar';
import { x402Client } from '@x402/core/client';
import { x402HTTPClient } from '@x402/core/http';
import { ExactStellarScheme } from '@x402/stellar/exact/client';
import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';

const CONFIG = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
  ARTICLES_PER_BATCH: 10,
  STELLAR_NETWORK_CAIP2: import.meta.env.VITE_STELLAR_NETWORK_CAIP2 || 'stellar:testnet',
  STELLAR_RPC_URL: import.meta.env.VITE_STELLAR_RPC_URL || '',
  PRICE_PER_BATCH_USD: parseFloat(import.meta.env.VITE_PRICE_PER_BATCH_USD || '0.10'),
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
    this.userAddress = null;   // user's Freighter wallet
    this.sessionBudget = 0;
    this.agentSecret = null;
    this.totalSpent = 0;
    this.transactions = [];
    this.batchCount = 0;
    this.isInitialized = false;
  }

  /**
   * Free first batch — no x402, no payment.
   * Used to hydrate the feed with 10 articles immediately.
   */
  async fetchFreeBatch() {
    const walletQ = this.userAddress ? `?wallet=${encodeURIComponent(this.userAddress)}` : '';
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/articles/free${walletQ}`);
    if (!response.ok) throw new Error(`Free batch error: ${response.status}`);
    const data = await response.json();
    return data.articles || [];
  }

  /**
   * Full initialization:
   * - Store wallet address + session settings
   */
  async initialize(userAddress, budgetXLM = 1.0, agentSecret = null) {
    this.userAddress = userAddress;
    this.sessionBudget = budgetXLM;
    this.agentSecret = agentSecret;
    this.totalSpent = 0;
    this.transactions = [];
    this.batchCount = 0;

    this.isInitialized = true;
  }

  /** Call from feed if user opened /feed without going through LandingPage (e.g. refresh). */
  ensureSession(walletAddress, budgetXLM = 1.0) {
    if (!walletAddress) return;
    if (!this.isInitialized) this.initialize(walletAddress, budgetXLM);
  }

  hasBudget(cost) {
    if (cost === undefined) {
      cost = Number.isFinite(CONFIG.PRICE_PER_BATCH_USD) ? CONFIG.PRICE_PER_BATCH_USD : 0.1;
    }
    // Add 0.0001 to prevent floating point rejection (e.g. 0.45 + 0.05 = 0.5000000000000001 > 0.50)
    return (this.totalSpent + cost) <= (this.sessionBudget + 0.0001);
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
    if (!this.agentSecret) throw new Error('SESSION_NOT_FUNDED');

    const batchNum = this.batchCount + 1;

    // Use autonomous agent signer
    const signer = createEd25519Signer(this.agentSecret, CONFIG.STELLAR_NETWORK_CAIP2);

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
      amount: (() => {
        const raw = paymentRequired?.accepts?.[0]?.amount;
        if (!raw) return String(CONFIG.PRICE_PER_BATCH_USD);
        const num = Number(raw);
        // x402 exact scheme on Stellar returns stroops (7 decimals for USDC)
        if (Number.isFinite(num) && num > 1000) return (num / 1e7).toFixed(2);
        return String(raw);
      })(),
      explorerUrl: txHash
        ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
        : null,
    };

    this.transactions.push(txRecord);
    this.batchCount = batchNum;
    // Budget cap is configured in USD; keep spend tracking consistent with that cap.
    this.totalSpent += Number.isFinite(CONFIG.PRICE_PER_BATCH_USD)
      ? CONFIG.PRICE_PER_BATCH_USD
      : 0.1;

    return { txRecord, articles: data.articles };
  }

  async payForSummary(title, content) {
    if (!this.isInitialized) throw new Error('Service not initialized');
    if (!this.agentSecret) throw new Error('SESSION_NOT_FUNDED');
    if (!this.hasBudget(0.05)) throw new Error('Insufficient Agent Budget. Please restart session.');

    const signer = createEd25519Signer(this.agentSecret, CONFIG.STELLAR_NETWORK_CAIP2);
    const core = new x402Client().register(
      'stellar:*',
      new ExactStellarScheme(signer, CONFIG.STELLAR_RPC_URL ? { url: CONFIG.STELLAR_RPC_URL } : undefined),
    );
    const httpClient = new x402HTTPClient(core);

    const payload = { title, content };

    // 1) Unpaid request to get PAYMENT-REQUIRED
    const first = await fetch(`${CONFIG.BACKEND_URL}/api/chat/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (first.status !== 402) {
      if (!first.ok) throw new Error(`Backend error: ${first.status}`);
      const data = await first.json();
      throw new Error(`Expected 402 PAYMENT-REQUIRED, got 200`);
    }

    const paymentRequired = httpClient.getPaymentRequiredResponse(
      (name) => first.headers.get(name),
      await first.json().catch(() => ({})),
    );

    // 2) Build + sign Soroban transfer
    let paymentPayload;
    try {
      paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
    } catch (e) {
      throw new Error(`Summary Payment Error: ${formatX402PaymentBuildError(e)}`);
    }

    // 3) Retry request with PAYMENT-SIGNATURE
    const paid = await fetch(`${CONFIG.BACKEND_URL}/api/chat/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...httpClient.encodePaymentSignatureHeader(paymentPayload),
      },
      body: JSON.stringify(payload)
    });

    if (!paid.ok) {
      const err = await paid.json().catch(() => ({}));
      throw new Error(`SUMMARY_PAYMENT_REJECTED: ${err?.error || err?.message || paid.status}`);
    }

    const settlement = httpClient.getPaymentSettleResponse((name) => paid.headers.get(name));
    const data = await paid.json();

    const txHash = settlement.transaction;

    const txRecord = {
      type: 'summary',
      title: title.slice(0, 30) + '...',
      network: settlement.network,
      transaction: txHash,
      hash: txHash,
      payer: settlement.payer,
      timestamp: new Date().toISOString(),
      status: settlement.success ? 'confirmed' : 'failed',
      scheme: 'exact',
      asset: paymentRequired?.accepts?.[0]?.asset,
      amount: '0.05',
      explorerUrl: txHash
        ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
        : null,
    };
    this.transactions.push(txRecord);
    this.totalSpent += 0.05;

    return { txHash, summary: data.summary };
  }

  async payForImpact(title, content) {
    if (!this.isInitialized) throw new Error('Service not initialized');
    if (!this.agentSecret) throw new Error('SESSION_NOT_FUNDED');
    if (!this.hasBudget(0.02)) throw new Error('Insufficient Agent Budget. Please restart session.');

    const signer = createEd25519Signer(this.agentSecret, CONFIG.STELLAR_NETWORK_CAIP2);
    const core = new x402Client().register(
      'stellar:*',
      new ExactStellarScheme(signer, CONFIG.STELLAR_RPC_URL ? { url: CONFIG.STELLAR_RPC_URL } : undefined),
    );
    const httpClient = new x402HTTPClient(core);

    const payload = { title, content };

    // 1) Unpaid request to get PAYMENT-REQUIRED
    const first = await fetch(`${CONFIG.BACKEND_URL}/api/chat/impact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (first.status !== 402) {
      if (!first.ok) throw new Error(`Backend error: ${first.status}`);
      const data = await first.json();
      throw new Error(`Expected 402 PAYMENT-REQUIRED, got 200`);
    }

    const paymentRequired = httpClient.getPaymentRequiredResponse(
      (name) => first.headers.get(name),
      await first.json().catch(() => ({})),
    );

    // 2) Build + sign Soroban transfer
    let paymentPayload;
    try {
      paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
    } catch (e) {
      throw new Error(`Impact Payment Error: ${formatX402PaymentBuildError(e)}`);
    }

    // 3) Retry request with PAYMENT-SIGNATURE
    const paid = await fetch(`${CONFIG.BACKEND_URL}/api/chat/impact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...httpClient.encodePaymentSignatureHeader(paymentPayload),
      },
      body: JSON.stringify(payload)
    });

    if (!paid.ok) {
      const err = await paid.json().catch(() => ({}));
      throw new Error(`IMPACT_PAYMENT_REJECTED: ${err?.error || err?.message || paid.status}`);
    }

    const settlement = httpClient.getPaymentSettleResponse((name) => paid.headers.get(name));
    const data = await paid.json();

    const txHash = settlement.transaction;

    const txRecord = {
      type: 'impact',
      title: title.slice(0, 30) + '...',
      network: settlement.network,
      transaction: txHash,
      hash: txHash,
      payer: settlement.payer,
      timestamp: new Date().toISOString(),
      status: settlement.success ? 'confirmed' : 'failed',
      scheme: 'exact',
      asset: paymentRequired?.accepts?.[0]?.asset,
      amount: '0.02',
      explorerUrl: txHash
        ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
        : null,
    };
    this.transactions.push(txRecord);

    // Deduct exact amount (0.02 USDC)
    this.totalSpent += 0.02;

    return { txHash, impact: data.impact };
  }

  async payForTip(title, amount) {
    if (!this.isInitialized) throw new Error('Service not initialized');
    if (!this.agentSecret) throw new Error('SESSION_NOT_FUNDED');
    
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) throw new Error('Invalid tip amount.');
    
    if (!this.hasBudget(amount)) throw new Error('Insufficient Agent Budget. Please restart session.');

    const signer = createEd25519Signer(this.agentSecret, CONFIG.STELLAR_NETWORK_CAIP2);
    const core = new x402Client().register(
      'stellar:*',
      new ExactStellarScheme(signer, CONFIG.STELLAR_RPC_URL ? { url: CONFIG.STELLAR_RPC_URL } : undefined),
    );
    const httpClient = new x402HTTPClient(core);

    const payload = { title, amount };

    // 1) Unpaid request to get PAYMENT-REQUIRED
    const first = await fetch(`${CONFIG.BACKEND_URL}/api/chat/tip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (first.status !== 402) {
      if (!first.ok) throw new Error(`Backend error: ${first.status}`);
      const data = await first.json();
      throw new Error(`Expected 402 PAYMENT-REQUIRED, got 200`);
    }

    const paymentRequired = httpClient.getPaymentRequiredResponse(
      (name) => first.headers.get(name),
      await first.json().catch(() => ({})),
    );

    // 2) Build + sign Soroban transfer
    let paymentPayload;
    try {
      paymentPayload = await httpClient.createPaymentPayload(paymentRequired);
    } catch (e) {
      throw new Error(`Tip Payment Error: ${formatX402PaymentBuildError(e)}`);
    }

    // 3) Retry request with PAYMENT-SIGNATURE
    const paid = await fetch(`${CONFIG.BACKEND_URL}/api/chat/tip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...httpClient.encodePaymentSignatureHeader(paymentPayload),
      },
      body: JSON.stringify(payload)
    });

    if (!paid.ok) {
      const err = await paid.json().catch(() => ({}));
      throw new Error(`TIP_PAYMENT_REJECTED: ${err?.error || err?.message || paid.status}`);
    }

    const settlement = httpClient.getPaymentSettleResponse((name) => paid.headers.get(name));
    const data = await paid.json();

    const txHash = settlement.transaction;

    const txRecord = {
      type: 'tip',
      title: title.slice(0, 30) + '...',
      network: settlement.network,
      transaction: txHash,
      hash: txHash,
      payer: settlement.payer,
      timestamp: new Date().toISOString(),
      status: settlement.success ? 'confirmed' : 'failed',
      scheme: 'exact',
      asset: paymentRequired?.accepts?.[0]?.asset || 'USDC',
      amount: String(amount),
      explorerUrl: txHash
        ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
        : null,
    };
    this.transactions.push(txRecord);

    // Deduct exact amount
    this.totalSpent += amount;

    return { txHash, message: data.message };
  }

  /**
   * Direct wallet transfer from user to agent (no x402)
   * User signs with Freighter, increases session budget
   */
  async addFunds(userAddress, amount) {
    if (!this.isInitialized) throw new Error('Service not initialized');
    if (!this.agentSecret) throw new Error('Agent wallet not initialized');

    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) throw new Error('Invalid refund amount');
    if (amount > 1000) throw new Error('Amount too large (max 1000 USDC per tx)');

    const agentKeypair = StellarSdk.Keypair.fromSecret(this.agentSecret);
    const agentAddress = agentKeypair.publicKey();
    const horizon = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

    try {
      // Load user's account (payer)
      const userAcc = await horizon.loadAccount(userAddress);

      // Build transfer transaction
      const transferTx = new StellarSdk.TransactionBuilder(userAcc, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET
      })
        .addOperation(StellarSdk.Operation.payment({
          destination: agentAddress,
          asset: new StellarSdk.Asset('USDC', TESTNET_USDC_ISSUER),
          amount: String(amount)
        }))
        .setTimeout(120)
        .build();

      // Sign with Freighter
      const signedResult = await signTransaction(transferTx.toXDR(), {
        network: 'TESTNET',
        networkPassphrase: StellarSdk.Networks.TESTNET,
      });

      if (!signedResult) throw new Error('No signature returned');
      if (signedResult.error) throw new Error(signedResult.error);

      // Extract signed XDR (Freighter response format varies)
      const signedXdrStr = typeof signedResult === 'string'
        ? signedResult
        : (signedResult.signedTxXdr || signedResult.signedTransaction || signedResult.transactionXdr || signedResult.signedCmd);

      if (!signedXdrStr || typeof signedXdrStr !== 'string') {
        throw new Error('Could not extract signed transaction from Freighter');
      }

      // Submit to network
      const txToSubmit = StellarSdk.TransactionBuilder.fromXDR(signedXdrStr, StellarSdk.Networks.TESTNET);
      const txResult = await horizon.submitTransaction(txToSubmit);

      const txHash = txResult.hash;

      // Record transaction
      const txRecord = {
        type: 'wallet-funded',
        title: 'Session Top-up',
        network: 'Stellar Testnet',
        transaction: txHash,
        hash: txHash,
        payer: userAddress,
        receiver: agentAddress,
        timestamp: new Date().toISOString(),
        status: 'confirmed',
        scheme: 'direct',
        asset: 'USDC',
        amount: String(amount),
        explorerUrl: txHash
          ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
          : null,
      };
      this.transactions.push(txRecord);

      // Increase session budget
      this.sessionBudget += amount;

      return { txHash, success: true };
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('insufficient')) {
        throw new Error(`Insufficient USDC balance. Need ${amount} USDC in your wallet.`);
      }
      if (msg.includes('rejected') || msg.includes('declined') || msg.includes('denied')) {
        throw new Error('Transfer cancelled in Freighter. Please try again and approve the transaction.');
      }
      throw new Error(`Transfer failed: ${msg}`);
    }
  }

  getSessionSummary() {
    return {
      batchCount: this.batchCount,
      totalSpent: parseFloat(this.totalSpent.toFixed(6)),
      transactions: [...this.transactions],
      budgetRemaining: parseFloat(this.getRemainingBudget()),
      sessionBudget: this.sessionBudget,
      articlesUnlocked: this.batchCount * CONFIG.ARTICLES_PER_BATCH,
      asset: 'SEP-41 Token (e.g., USDC)',
      network: CONFIG.STELLAR_NETWORK_CAIP2,
    };
  }

  reset() {
    this.totalSpent = 0;
    this.transactions = [];
    this.batchCount = 0;
    this.isInitialized = false;
    console.log('🔄 StellarX402: session reset');
  }
}

let _instance = null;
export function getStellarX402Service() {
  if (!_instance) _instance = new StellarX402Service();
  return _instance;
}

export default StellarX402Service;