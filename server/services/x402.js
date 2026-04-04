import { x402Facilitator } from '@x402/core/facilitator';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { x402HTTPResourceServer } from '@x402/core/http';

import { createEd25519Signer, STELLAR_TESTNET_CAIP2, STELLAR_PUBNET_CAIP2 } from '@x402/stellar';
import { ExactStellarScheme as ExactStellarServer } from '@x402/stellar/exact/server';
import { ExactStellarScheme as ExactStellarFacilitator } from '@x402/stellar/exact/facilitator';

/** OpenZeppelin Channels — testnet runtime (see 1-shot-stellar x402 guide). */
const DEFAULT_OZ_FACILITATOR_URL = 'https://channels.openzeppelin.com/x402/testnet';

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

/**
 * Facilitator modes (matches x402 docs / 1-shot-stellar Guide.md):
 * - `http` — HTTPFacilitatorClient → OpenZeppelin Channels (or any x402 facilitator URL)
 * - `local` — in-process x402Facilitator + ExactStellarFacilitator (your key sponsors fees)
 */
export async function getX402() {
  if (_instance) return _instance;

  const network = getCaipNetwork();

  const payTo = process.env.PUBLISHER_ADDRESS;
  if (!payTo) {
    throw new Error('PUBLISHER_ADDRESS is required for x402 payTo');
  }

  const rpcUrl = process.env.STELLAR_RPC_URL;
  const rpcConfig = rpcUrl ? { url: rpcUrl } : undefined;

  const facilitatorUrl = (process.env.FACILITATOR_URL || '').trim();
  const forceLocal = process.env.X402_FACILITATOR_MODE === 'local';
  const useHttpFacilitator =
    !forceLocal &&
    (process.env.X402_FACILITATOR_MODE === 'http' ||
      facilitatorUrl.length > 0 ||
      !process.env.FACILITATOR_STELLAR_PRIVATE_KEY);

  let facilitatorClient;
  let facilitatorMode;

  if (useHttpFacilitator) {
    const url = facilitatorUrl || DEFAULT_OZ_FACILITATOR_URL;
    const apiKey = (process.env.FACILITATOR_API_KEY || '').trim();

    facilitatorClient = new HTTPFacilitatorClient({
      url,
      createAuthHeaders: apiKey
        ? async () => {
            const headers = { Authorization: `Bearer ${apiKey}` };
            return { verify: headers, settle: headers, supported: headers };
          }
        : undefined,
    });
    facilitatorMode = 'http';
  } else {
    const facilitatorSecret = process.env.FACILITATOR_STELLAR_PRIVATE_KEY;
    if (!facilitatorSecret) {
      throw new Error(
        'Set FACILITATOR_URL (+ FACILITATOR_API_KEY for OpenZeppelin) for hosted facilitator, ' +
          'or FACILITATOR_STELLAR_PRIVATE_KEY for in-process settlement.',
      );
    }

    const facilitatorSigner = createEd25519Signer(facilitatorSecret, network);
    const facilitator = new x402Facilitator().register(
      network,
      new ExactStellarFacilitator([facilitatorSigner], { rpcConfig }),
    );
    facilitatorClient = new InProcessFacilitatorClient(facilitator);
    facilitatorMode = 'local';
  }

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    network,
    new ExactStellarServer(),
  );

  const routes = {
    'POST /api/articles': {
      accepts: {
        scheme: 'exact',
        network,
        payTo,
        price: process.env.PRICE_PER_BATCH || '0.10',
      },
      description: 'Unlock the next batch of StellarRead news articles',
      mimeType: 'application/json',
    },
    'POST /api/chat/summarize': {
      accepts: {
        scheme: 'exact',
        network,
        payTo,
        price: '0.05',
      },
      description: 'Groq AI Article Summarization Compute',
      mimeType: 'application/json',
    },
    'POST /api/chat/impact': {
      accepts: {
        scheme: 'exact',
        network,
        payTo,
        price: '0.02',
      },
      description: 'Groq AI Web3 Impact Analysis Compute',
      mimeType: 'application/json',
    },
  };

  const httpServer = new x402HTTPResourceServer(resourceServer, routes);

  await resourceServer.initialize();
  await httpServer.initialize();

  _instance = {
    network,
    facilitator: facilitatorClient,
    facilitatorMode,
    resourceServer,
    httpServer,
  };
  return _instance;
}
