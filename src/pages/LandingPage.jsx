import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFreighter } from '../hooks/useFreighter';
import './LandingPage.css';

const BUDGET_OPTIONS = [
  { label: '0.5 XLM', value: 0.5, desc: '~50 articles' },
  { label: '1 XLM',   value: 1.0, desc: '~100 articles', recommended: true },
  { label: '2 XLM',   value: 2.0, desc: '~200 articles' },
];

const INTEREST_SUGGESTIONS = [
  'Bitcoin', 'Ethereum', 'Stellar', 'DeFi', 'AI agents',
  'Stablecoins', 'x402', 'Regulation', 'NFT', 'Solana',
];

const DEFAULT_INTERESTS = 'Stellar, DeFi, AI agents, stablecoins';

// Steps in the setup flow
const STEP = {
  CONNECT:  'connect',
  SETUP:    'setup',
  FUNDING:  'funding',
};

const LandingPage = ({ onSessionStart, walletAddress }) => {
  const navigate = useNavigate();
  const { address, isConnected, isConnecting, error, connect } = useFreighter();

  const [step, setStep]                   = useState(STEP.CONNECT);
  const [selectedBudget, setSelectedBudget] = useState(1.0);
  const [interests, setInterests]         = useState(DEFAULT_INTERESTS);
  const [isFunding, setIsFunding]         = useState(false);
  const [fundingError, setFundingError]   = useState(null);
  const [fundingTx, setFundingTx]         = useState(null);

  const connectedAddress = address || walletAddress;

  const handleConnect = async () => {
    const addr = await connect();
    if (addr) setStep(STEP.SETUP);
  };

  const toggleInterest = (tag) => {
    const current = interests.split(',').map(s => s.trim()).filter(Boolean);
    const exists  = current.some(i => i.toLowerCase() === tag.toLowerCase());
    const updated = exists
      ? current.filter(i => i.toLowerCase() !== tag.toLowerCase())
      : [...current, tag];
    setInterests(updated.join(', '));
  };

  /**
   * User clicks "Start Agent" — this triggers the ONE Freighter approval.
 * Spec-compliant x402 on Stellar uses Soroban auth-entry signing per payment.
 * Session starts immediately after wallet connect.
   */
  const handleFundAndStart = async () => {
    if (!connectedAddress || !interests.trim()) return;

    setIsFunding(true);
    setFundingError(null);
    setStep(STEP.FUNDING);

    try {
      // No funding step required for spec-compliant flow; facilitator sponsors fees.
      console.log('✅ Session started. Payments will use Soroban x402 auth-entry signing.');

      // Notify App, navigate to feed
      await onSessionStart(connectedAddress, selectedBudget, interests.trim(), null);
      navigate('/feed');

    } catch (err) {
      console.error('Funding error:', err);
      if (err.message?.includes('rejected') || err.message?.includes('declined')) {
        setFundingError('Action rejected. Please approve in Freighter.');
      } else {
        setFundingError(err.message || 'Failed to start session.');
      }
      setStep(STEP.SETUP);
    } finally {
      setIsFunding(false);
    }
  };

  const activeInterests = interests.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  return (
    <div className="landing">

      {/* Hero */}
      <div className="landing-hero">
        <div className="hero-badge">
          <span>⭐</span>
          <span>Stellar Agents x402 Hackathon 2026</span>
        </div>

        <h1 className="hero-title">
          Read News.<br />
          <span className="hero-accent">Agent Pays Autonomously.</span>
        </h1>

        <p className="hero-sub">
          Fund the agent once. It evaluates articles using <strong>AI</strong>,
          pays per batch on <strong>Stellar</strong> via <strong>x402</strong> —
          completely autonomously. No signing per batch.
        </p>

        <div className="how-it-works">
          <div className="hiw-step">
            <span className="hiw-num">1</span>
            <div>
              <strong>Fund once</strong>
              <p>One Freighter approval</p>
            </div>
          </div>
          <div className="hiw-arrow">→</div>
          <div className="hiw-step">
            <span className="hiw-num">2</span>
            <div>
              <strong>Agent evaluates</strong>
              <p>AI scores relevance</p>
            </div>
          </div>
          <div className="hiw-arrow">→</div>
          <div className="hiw-step">
            <span className="hiw-num">3</span>
            <div>
              <strong>Auto-pays</strong>
              <p>No popups per batch</p>
            </div>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="landing-card">

        {/* ── Step: Connect ── */}
        {step === STEP.CONNECT && (
          <>
            <div className="card-section">
              <h2>Connect Your Wallet</h2>
              <p>
                You need <strong>Freighter</strong> on <strong>Testnet</strong>.
                You'll approve <strong>one transaction</strong> to fund the agent — that's it.
              </p>

              <button
                className="btn btn-primary btn-large connect-btn"
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting
                  ? <><span className="btn-spinner" /> Connecting...</>
                  : <><span>⭐</span> Connect Freighter</>}
              </button>

              {error && (
                <div className="connect-error">
                  <span>⚠️</span>
                  <span>{error}</span>
                  {error.toLowerCase().includes('not found') && (
                    <a href="https://freighter.app" target="_blank" rel="noopener noreferrer"
                      className="install-link">Get Freighter →</a>
                  )}
                </div>
              )}
            </div>

            <div className="card-divider" />

            <p className="testnet-note">
              🧪 <strong>Stellar Testnet</strong> — get free XLM from{' '}
              <a href="https://friendbot.stellar.org" target="_blank" rel="noopener noreferrer">
                Friendbot ↗
              </a>
            </p>
          </>
        )}

        {/* ── Step: Setup ── */}
        {step === STEP.SETUP && (
          <>
            <div className="card-section">
              <div className="wallet-connected">
                <span className="wc-dot" />
                <span className="wc-label">Wallet Connected</span>
              </div>
              <div className="wc-address">
                {connectedAddress?.slice(0, 10)}...{connectedAddress?.slice(-8)}
              </div>
            </div>

            <div className="card-divider" />

            {/* Interests */}
            <div className="card-section">
              <h3>Your Reading Interests</h3>
              <p>Agent only pays for batches with ≥ 3 matching articles.</p>

              <div className="interest-tags">
                {INTEREST_SUGGESTIONS.map(tag => (
                  <button
                    key={tag}
                    className={`interest-tag ${activeInterests.includes(tag.toLowerCase()) ? 'active' : ''}`}
                    onClick={() => toggleInterest(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <input
                className="interest-input"
                type="text"
                placeholder="Or type: Polygon, payments, Web3..."
                value={interests}
                onChange={e => setInterests(e.target.value)}
              />
            </div>

            <div className="card-divider" />

            {/* Budget */}
            <div className="card-section">
              <h3>Agent Budget</h3>
              <p>Agent will be funded with this amount. It pays 0.10 XLM per 10 articles autonomously.</p>

              <div className="budget-options">
                {BUDGET_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`budget-btn ${selectedBudget === opt.value ? 'selected' : ''}`}
                    onClick={() => setSelectedBudget(opt.value)}
                  >
                    {opt.recommended && <span className="budget-recommended">Recommended</span>}
                    <span className="budget-amount">{opt.label}</span>
                    <span className="budget-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>

              {fundingError && (
                <div className="connect-error">
                  <span>⚠️</span>
                  <span>{fundingError}</span>
                </div>
              )}

              <button
                className="btn btn-primary btn-large start-btn"
                onClick={handleFundAndStart}
                disabled={isFunding || !interests.trim()}
              >
                {isFunding
                  ? <><span className="btn-spinner" /> Waiting for Freighter...</>
                  : `Fund Agent (${selectedBudget} XLM) →`}
              </button>

              <p className="funding-note">
                ⚡ This sends {selectedBudget} XLM to the agent's session wallet.
                After this, <strong>no more popups</strong>.
              </p>
            </div>
          </>
        )}

        {/* ── Step: Funding in progress ── */}
        {step === STEP.FUNDING && (
          <div className="card-section funding-progress">
            <div className="funding-spinner">
              <span className="btn-spinner large-spinner" />
            </div>
            <h3>Funding Agent Wallet...</h3>
            <p>Please approve the transaction in Freighter.</p>
            <p className="funding-sub">This is the only approval you'll need.</p>
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="tech-badges">
        <span className="tech-badge">⭐ Stellar Testnet</span>
        <span className="tech-badge">⚡ x402 Protocol</span>
        <span className="tech-badge">🧠 Groq AI Agent</span>
        <span className="tech-badge">🤖 Autonomous Payments</span>
      </div>
    </div>
  );
};

export default LandingPage;