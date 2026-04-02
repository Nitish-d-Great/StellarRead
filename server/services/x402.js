import { x402Facilitator } from '@x402/core/facilitator';
import { x402ResourceServer } from '@x402/core/server';
import { x402HTTPResourceServer } from '@x402/core/http';

import { createEd25519Signer, STELLAR_TESTNET_CAIP2, STELLAR_PUBNET_CAIP2 } from '@x402/stellar';
import { ExactStellarScheme as ExactStellarServer } from '@x402/stellar/exact/server';
import { ExactStellarScheme as ExactStellarFacilitator } from '@x402/stellar/exact/facilitator';

function getCaipNetwork() {
  const n = (process.env.STELLAR_NETWORK || 'TESTNET').toUpperCase();
  return n === 'MAINNET' ? STELLAR_PUBNET_CAIP2 : STELLAR_TESTNET_CAIP2;
}

class InProcessFacilitatorClient {
  constructor(facilitator) {
    this.facilitator = facilitator;
  }
  async getSupported() {
    return this.facilitator.getSupported();
  }
  async verify(paymentPayload, paymentRequirements) {
    return this.facilitator.verify(paymentPayload, paymentRequirements);
  }
  async settle(paymentPayload, paymentRequirements) {
    return this.facilitator.settle(paymentPayload, paymentRequirements);
  }
}

let _instance = null;

export async function getX402() {
  if (_instance) return _instance;

  const network = getCaipNetwork();

  const payTo = process.env.PUBLISHER_ADDRESS;
  if (!payTo) {
    throw new Error('PUBLISHER_ADDRESS is required for x402 payTo');
  }

  const facilitatorSecret = process.env.FACILITATOR_STELLAR_PRIVATE_KEY;
  if (!facilitatorSecret) {
    throw new Error('FACILITATOR_STELLAR_PRIVATE_KEY is required to sponsor+settle Soroban txs');
  }

  const rpcUrl = process.env.STELLAR_RPC_URL; // optional (testnet has a default in the library)
  const rpcConfig = rpcUrl ? { url: rpcUrl } : undefined;

  // Facilitator (fee sponsor + settlement)
  const facilitatorSigner = createEd25519Signer(facilitatorSecret, network);
  const facilitator = new x402Facilitator().register(
    network,
    new ExactStellarFacilitator([facilitatorSigner], { rpcConfig }),
  );

  // Resource server (builds requirements + calls facilitator via client)
  const resourceServer = new x402ResourceServer(new InProcessFacilitatorClient(facilitator)).register(
    network,
    new ExactStellarServer(),
  );

  // Route config used by HTTP wrapper
  const routes = {
    'POST /api/articles': {
      accepts: {
        scheme: 'exact',
        network,
        payTo,
        // Money value (decimal). Server scheme converts to token units (default: USDC, 7 decimals).
        price: process.env.PRICE_PER_BATCH || '0.10',
      },
      description: 'Unlock the next batch of StellarRead news articles',
      mimeType: 'application/json',
    },
  };

  const httpServer = new x402HTTPResourceServer(resourceServer, routes);

  // Initialize resource server (derives facilitator supported kinds)
  await resourceServer.initialize();
  await httpServer.initialize();

  _instance = { network, facilitator, resourceServer, httpServer };
  return _instance;
}

