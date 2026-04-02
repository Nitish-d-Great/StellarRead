/**
 * StellarRead — Backend Server
 *
 * Implements a real x402 paywall:
 *   POST /api/articles — returns HTTP 402 without proof, articles with valid proof
 *
 * Start: node index.js (or npm run dev for watch mode)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load server/.env no matter where you run node from (repo root vs server/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import articlesRouter from './routes/articles.js';
import facilitatorRouter from './routes/facilitator.js';
import { getX402 } from './services/x402.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'http://localhost:4173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'x-payment-proof',
    'Authorization',
    'PAYMENT-SIGNATURE',
    'PAYMENT-REQUIRED',
    'PAYMENT-RESPONSE',
  ],
  exposedHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE', 'PAYMENT-SIGNATURE'],
}));

app.use(express.json());

// ── x402 init (fail fast if misconfigured) ───────────────────────────────────
await getX402();

// ── Request logging ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const proof = req.headers['x-payment-proof'];
  console.log(
    `${new Date().toISOString()} ${req.method} ${req.path}`,
    proof ? `[proof: ${proof.slice(0, 8)}...]` : '[no proof]'
  );
  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/articles', articlesRouter);
app.use('/api/facilitator', facilitatorRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'StellarRead x402 Server',
    network: process.env.STELLAR_NETWORK || 'TESTNET',
    asset: process.env.PAYMENT_ASSET || 'XLM',
    pricePerBatch: process.env.PRICE_PER_BATCH || '0.10',
    publisherAddress: process.env.PUBLISHER_ADDRESS,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
⭐ StellarRead x402 Server running on port ${PORT}

   Network:   ${process.env.STELLAR_NETWORK || 'TESTNET'}
   Asset:     ${process.env.PAYMENT_ASSET || 'XLM'}
   Price:     ${process.env.PRICE_PER_BATCH || '0.10'} per batch
   Publisher: ${process.env.PUBLISHER_ADDRESS || '⚠️  NOT SET'}
   Frontend:  ${FRONTEND_URL}

   Endpoints:
   GET  /health                      → server status
   GET  /api/articles/instructions   → x402 payment instructions
   POST /api/articles                → x402-gated articles
  `);
});

export default app;
