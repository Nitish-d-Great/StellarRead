/**
 * StellarRead — Articles Route
 *
 * GET  /api/articles/instructions  → x402 payment instructions (free)
 * GET  /api/articles/preview       → article headlines only (free, no payment)
 *                                    Agent uses this to decide whether to pay
 * POST /api/articles               → full articles (x402 payment required)
 */

import express from 'express';
import { fetchArticles } from '../services/newsApi.js';
import { getX402 } from '../services/x402.js';

const router = express.Router();

// ── GET /api/articles/free ────────────────────────────────────────────────────
// FREE endpoint — returns full articles for the initial experience (no payment).
router.get('/free', async (req, res) => {
  try {
    const articles = await fetchArticles(10);
    res.json({ success: true, articles, count: articles.length, free: true });
  } catch (err) {
    console.error('Free batch fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch free articles', message: err.message });
  }
});

// ── GET /api/articles/instructions ──────────────────────────────────────────
router.get('/instructions', (req, res) => {
  res.json({
    message: 'POST /api/articles. If unpaid, server returns HTTP 402 with PAYMENT-REQUIRED header (x402 v2).',
    protocol: 'x402',
    version: 2,
  });
});

// ── GET /api/articles/preview ────────────────────────────────────────────────
// FREE endpoint — returns titles + summaries only, no full content.
// The AI agent uses this to evaluate relevance BEFORE deciding to pay.
router.get('/preview', async (req, res) => {
  try {
    const articles = await fetchArticles();
    // Return only metadata — no full content
    const previews = articles.map(a => ({
      id:          a.id,
      title:       a.title,
      summary:     a.summary,
      category:    a.category,
      publishedAt: a.publishedAt,
      source:      a.source,
    }));
    res.json({ previews, count: previews.length });
  } catch (err) {
    console.error('Preview fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch previews', message: err.message });
  }
});

// ── POST /api/articles ───────────────────────────────────────────────────────
// x402-protected (x402 v2 headers). Only returns full articles after Soroban settlement.
router.post('/', async (req, res) => {
  try {
    const { httpServer } = await getX402();

    // Express mounts this router at /api/articles, so req.path is "/" here — x402 routes
    // are registered as "POST /api/articles". Use the full URL path.
    const pathname = req.originalUrl.split(/[?#]/)[0] || '/';

    const adapter = {
      getHeader: (name) => req.get(name) || '',
      getAcceptHeader: () => req.get('accept') || '',
      getUserAgent: () => req.get('user-agent') || '',
      getUrl: () => `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    };

    const transportContext = { request: { adapter, path: pathname, method: req.method } };

    const result = await httpServer.processHTTPRequest(
      { adapter, path: pathname, method: req.method },
      undefined,
    );

    // Unpaid or verification failure → return 402 + PAYMENT-REQUIRED
    if (result.type === 'payment-error') {
      res.status(result.response.status);
      for (const [k, v] of Object.entries(result.response.headers || {})) res.setHeader(k, v);
      if (result.response.isHtml) return res.send(result.response.body);
      return res.json(result.response.body);
    }

    if (result.type === 'no-payment-required') {
      return res.status(500).json({
        error: 'x402_route_mismatch',
        message:
          'Payment route did not match. Check POST path is /api/articles (full path for x402).',
      });
    }

    if (result.type !== 'payment-verified') {
      return res.status(500).json({ error: 'x402_unexpected_state', message: result.type });
    }

    // Settle (facilitator submits tx) → attach PAYMENT-RESPONSE
    const settled = await httpServer.processSettlement(
      result.paymentPayload,
      result.paymentRequirements,
      result.declaredExtensions,
      transportContext,
    );

    if (!settled.success) {
      res.status(settled.response.status);
      for (const [k, v] of Object.entries(settled.response.headers || {})) res.setHeader(k, v);
      return res.json(settled.response.body);
    }

    for (const [k, v] of Object.entries(settled.headers || {})) res.setHeader(k, v);

    console.log(`📰 Fetching articles for settled payment tx: ${String(settled.transaction).slice(0, 8)}...`);
    const articles = await fetchArticles();

    res.json({
      success:  true,
      articles,
      count:    articles.length,
      paymentProof: {
        transaction: settled.transaction,
        payer: settled.payer,
        network: settled.network,
      },
      meta: {
        source:     process.env.NEWS_SOURCE || 'news',
        unlockedAt: new Date().toISOString(),
        protocol:   'x402',
        network:    process.env.STELLAR_NETWORK || 'TESTNET',
      },
    });
  } catch (err) {
    console.error('Article fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch articles', message: err.message });
  }
});

export default router;