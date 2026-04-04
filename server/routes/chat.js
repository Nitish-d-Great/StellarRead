import express from 'express';
import Groq from 'groq-sdk';
import { getX402 } from '../services/x402.js';

const router = express.Router();

router.post('/summarize', async (req, res) => {
  try {
    const { httpServer } = await getX402();
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

    if (result.type === 'payment-error') {
      res.status(result.response.status);
      for (const [k, v] of Object.entries(result.response.headers || {})) res.setHeader(k, v);
      return res.json(result.response.body);
    }

    if (result.type !== 'payment-verified') {
      return res.status(500).json({ error: 'x402_unexpected_state', message: result.type });
    }

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

    console.log(`🤖 Agent Executing Groq Summarize for paid tx: ${String(settled.transaction).slice(0, 8)}...`);

    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Missing title or content in request body.' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'Groq API Key is not configured on the server.' });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a concise News Bot. Summarize the provided article strictly into a 20-30 word bulleted digest. Focus on the core fact or event. Do not add conversational filler.",
        },
        {
          role: "user",
          content: `Title: ${title}\nContent:\n${content.substring(0, 3000)}...`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
    });

    const summary = completion.choices[0]?.message?.content || "Could not generate summary.";

    res.json({
      success: true,
      summary,
      paymentProof: {
        transaction: settled.transaction,
        payer: settled.payer,
        network: settled.network,
      }
    });

  } catch (err) {
    console.error('Groq summarize error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate summary' });
  }
});

router.post('/impact', async (req, res) => {
  try {
    const { httpServer } = await getX402();
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

    if (result.type === 'payment-error') {
      res.status(result.response.status);
      for (const [k, v] of Object.entries(result.response.headers || {})) res.setHeader(k, v);
      return res.json(result.response.body);
    }

    if (result.type !== 'payment-verified') {
      return res.status(500).json({ error: 'x402_unexpected_state', message: result.type });
    }

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

    console.log(`🤖 Agent Executing Groq Impact Analysis for paid tx: ${String(settled.transaction).slice(0, 8)}...`);

    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Missing title or content in request body.' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'Groq API Key is not configured on the server.' });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a concise Web3/Crypto Sector Analyst. Answer how the events in this article structurally or financially impact the broader Web3/blockchain/crypto sector. Limit your response strictly to 40-50 words.",
        },
        {
          role: "user",
          content: `Title: ${title}\nContent:\n${content.substring(0, 3000)}...`
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.3,
    });

    const impact = completion.choices[0]?.message?.content || "Could not generate impact analysis.";

    res.json({
      success: true,
      impact,
      paymentProof: {
        transaction: settled.transaction,
        payer: settled.payer,
        network: settled.network,
      }
    });

  } catch (err) {
    console.error('Groq impact analysis error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate impact analysis' });
  }
});

export default router;
