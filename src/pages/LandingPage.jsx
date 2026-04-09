import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFreighter } from '../hooks/useFreighter';
import * as StellarSdk from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import './LandingPage.css';

const BUDGET_OPTIONS = [
  { label: '$0.5', value: 0.5, desc: '~50 articles' },
  { label: '$1.0', value: 1.0, desc: '~100 articles', recommended: true },
  { label: '$2.0', value: 2.0, desc: '~200 articles' },
];

const INTEREST_SUGGESTIONS = [
  'Bitcoin', 'Ethereum', 'Stellar', 'DeFi', 'AI agents',
  'Stablecoins', 'x402', 'Regulation', 'NFT', 'Solana',
];

const DEFAULT_INTERESTS = 'Stellar, DeFi, AI agents, stablecoins';

// Constants
const TESTNET_USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

// Steps in the setup flow
const STEP = {
  CONNECT: 'connect',
  SETUP: 'setup',
  FUNDING: 'funding',
};

// Particle config
const PARTICLE_COLORS = ['pink', 'cyan', 'purple', 'blue'];
const PARTICLE_COUNT = 20;

function generateParticles() {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    size: 4 + Math.random() * 6,
    left: Math.random() * 100,
    delay: Math.random() * 15,
    duration: 10 + Math.random() * 20,
  }));
}

const LandingPage = ({ onSessionStart, walletAddress }) => {
  const navigate = useNavigate();
  const { address, isConnected, isConnecting, error, connect } = useFreighter();

  const [step, setStep] = useState(STEP.CONNECT);
  const [selectedBudget, setSelectedBudget] = useState(1.0);
  const [interests, setInterests] = useState(DEFAULT_INTERESTS);
  const [isFunding, setIsFunding] = useState(false);
  const [fundingError, setFundingError] = useState(null);
  const [fundingStatus, setFundingStatus] = useState('');
  const [particles] = useState(generateParticles);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const connectedAddress = address || walletAddress;

  const handleConnect = async () => {
    const addr = await connect();
    if (addr) setStep(STEP.SETUP);
  };

  const toggleInterest = (tag) => {
    const current = interests.split(',').map(s => s.trim()).filter(Boolean);
    const exists = current.some(i => i.toLowerCase() === tag.toLowerCase());
    const updated = exists
      ? current.filter(i => i.toLowerCase() !== tag.toLowerCase())
      : [...current, tag];
    setInterests(updated.join(', '));
  };

  const handleFundAndStart = async () => {
    if (!connectedAddress || !interests.trim()) return;

    setIsFunding(true);
    setFundingError(null);
    setFundingStatus('Generating ephemeral agent wallet...');
    setStep(STEP.FUNDING);

    try {
      const agentKeypair = StellarSdk.Keypair.random();
      const agentPubKey = agentKeypair.publicKey();
      console.log('Generated Autonomous Agent Wallet:', agentPubKey);

      setFundingStatus('Requesting XLM from Friendbot for reserves...');
      const fbRes = await fetch(`https://friendbot.stellar.org?addr=${agentPubKey}`);
      if (!fbRes.ok) throw new Error('Failed to fund agent via Friendbot. Testnet might be congested.');

      const horizon = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

      setFundingStatus('Adding USDC trustline to Agent wallet...');
      const agentAcc = await horizon.loadAccount(agentPubKey);
      const trustTx = new StellarSdk.TransactionBuilder(agentAcc, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET
      })
        .addOperation(StellarSdk.Operation.changeTrust({
          asset: new StellarSdk.Asset('USDC', TESTNET_USDC_ISSUER)
        }))
        .setTimeout(30)
        .build();

      trustTx.sign(agentKeypair);
      await horizon.submitTransaction(trustTx);

      setFundingStatus('Awaiting your approval in Freighter...');

      const humanAcc = await horizon.loadAccount(connectedAddress);
      const fundTx = new StellarSdk.TransactionBuilder(humanAcc, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET
      })
        .addOperation(StellarSdk.Operation.payment({
          destination: agentPubKey,
          asset: new StellarSdk.Asset('USDC', TESTNET_USDC_ISSUER),
          amount: String(selectedBudget)
        }))
        .setTimeout(120)
        .build();

      let signedFundResult;
      try {
        signedFundResult = await signTransaction(fundTx.toXDR(), {
          network: 'TESTNET',
          networkPassphrase: StellarSdk.Networks.TESTNET,
        });
      } catch (err) {
        throw new Error(err.message || 'Signature failed');
      }

      if (signedFundResult && signedFundResult.error) {
        throw new Error(signedFundResult.error);
      }

      const signedXdrStr = typeof signedFundResult === 'string'
        ? signedFundResult
        : (signedFundResult.signedTxXdr || signedFundResult.signedTransaction || signedFundResult.transactionXdr || signedFundResult.signedCmd);

      if (!signedXdrStr || typeof signedXdrStr !== 'string') {
        console.error('Unhandled Freighter response:', signedFundResult);
        throw new Error('Could not parse successful signature from Freighter. Ensure you are using the latest extension version.');
      }

      setFundingStatus('Submitting funding transaction to Stellar network...');

      const txToSubmit = StellarSdk.TransactionBuilder.fromXDR(signedXdrStr, StellarSdk.Networks.TESTNET);
      await horizon.submitTransaction(txToSubmit);

      setFundingStatus('Session funded successfully!');
      console.log('✅ Session started. Agent is fully funded and autonomous.');

      await onSessionStart(connectedAddress, selectedBudget, interests.trim(), agentKeypair.secret());
      navigate('/feed');

    } catch (err) {
      console.error('Funding error:', err);
      let errorMsg = err.message;
      if (err.response && err.response.data && err.response.data.extras) {
        errorMsg = `Payment failed. Do you have ${selectedBudget} USDC? (${err.response.data.extras.result_codes?.operations?.join(', ') || ''})`;
      }
      if (errorMsg?.includes('rejected') || errorMsg?.includes('declined')) {
        setFundingError('Action rejected. Please approve in Freighter.');
      } else {
        setFundingError(errorMsg || 'Failed to start session.');
      }
      setStep(STEP.SETUP);
    } finally {
      setIsFunding(false);
    }
  };

  const activeInterests = interests.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  return (
    <div className="landing">
      {/* Animated Background */}
      <div className="landing-bg" />
      <div className="grid-overlay" />

      {/* Floating Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className={`particle particle--${p.color}`}
          style={{
            width: p.size,
            height: p.size,
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}

      <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Dark Mode">
        {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>

      <div className="landing-content">

        {/* Navbar */}
        <nav className="landing-nav">
          <div className="nav-brand">
            <span className="nav-logo">StellarRead</span>
            <span className="nav-badge">x402</span>
          </div>
          <div className="nav-links">
            <a href="https://medium.com/@nit.nitish02/stellarread-how-it-works-ad53958b616b" target="_blank" rel="noopener noreferrer" className="nav-link">How It Works</a>
            <a href="https://medium.com/@nit.nitish02/stellarread-the-tech-behind-it-1a74c2f717f1" target="_blank" rel="noopener noreferrer" className="nav-link">Technology</a>
            <a href="https://github.com/Nitish-d-Great/StellarRead" target="_blank" rel="noopener noreferrer" className="nav-link">GitHub</a>
          </div>
        </nav>

        {/* Hero */}
        <div className="landing-hero">
          <div className="hero-badge">
            <span>⭐</span>
            <span>Stellar Agents x402 Hackathon 2026</span>
          </div>

          <h1 className="hero-title">
            Read Uninterrupted<br />
            <span className="hero-accent">Your Agent Pays via x402</span>
          </h1>

          <p className="hero-sub">
            AI agent silently rides every scroll of yours - the instant you crave more, get ready for more - all via <strong> Stellar</strong>. Summarise, Analyse, Tip, Share, Bookmark, Ask AI. <strong>Do More Than Just Reading.</strong></p>

          <div className="how-it-works">
            <div className="hiw-step">
              <span className="hiw-num">1</span>
              <div>
                <strong>Read threshold reached</strong>
                <p>Agent detects low unread buffer</p>
              </div>
            </div>
            <div className="hiw-arrow">→</div>
            <div className="hiw-step">
              <span className="hiw-num">2</span>
              <div>
                <strong>x402 challenge</strong>
                <p>Server returns 402 + payment requirements</p>
              </div>
            </div>
            <div className="hiw-arrow">→</div>
            <div className="hiw-step">
              <span className="hiw-num">3</span>
              <div>
                <strong>Freighter approval</strong>
                <p>Signed payload unlocks the next batch</p>
              </div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="landing-card">
          <div className="landing-card-inner">

            {/* ── Step: Connect ── */}
            {step === STEP.CONNECT && (
              <>
                <div className="card-section">
                  <h2>Connect Your Wallet</h2>
                  <p>
                    You need <strong>Freighter</strong> on <strong>Testnet</strong>.
                    You approve signatures when x402 payments are requested.
                  </p>

                  <button
                    className="connect-btn"
                    onClick={handleConnect}
                    disabled={isConnecting}
                  >
                    {isConnecting
                      ? <><span className="btn-spinner" /> <span>Connecting...</span></>
                      : <><span>⭐</span> <span>Connect Freighter</span></>}
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
                  <p>Used for feed personalization and future ranking features.</p>

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
                  <p>Session cap for x402 spend. Price target is about $0.10 per 10 articles.</p>

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
                    className="start-btn"
                    onClick={handleFundAndStart}
                    disabled={isFunding || !interests.trim()}
                  >
                    {isFunding
                      ? <><span className="btn-spinner" /> <span>Waiting for Freighter...</span></>
                      : <span>{`Start Session (Budget $${selectedBudget}) →`}</span>}
                  </button>

                  <p className="funding-note">
                    ⚡ Session budget is tracked in-app; wallet signatures still require approval per payment.
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
                <h3>Deploying AI Agent...</h3>
                <p className="funding-status">{fundingStatus || 'Preparing...'}</p>
                <p className="funding-sub">This creates a secure, ephemeral session wallet for autonomous background payments.</p>
              </div>
            )}
          </div>
        </div>

        {/* Feature Cards */}
        <div className="feature-section">
          <h2 className="feature-title">Built With Cutting-Edge Technology</h2>
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-card-inner">
                <span className="feature-icon">⚡</span>
                <h4>x402 Protocol</h4>
                <p>HTTP-native micropayments. The server returns 402 Payment Required, the agent signs & pays autonomously.</p>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-card-inner">
                <span className="feature-icon">🧠</span>
                <h4>Groq AI Inference</h4>
                <p>On-demand article summarization and Web3 sector impact analysis powered by Llama 3.1 via Groq.</p>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-card-inner">
                <span className="feature-icon">⭐</span>
                <h4>Stellar Network</h4>
                <p>USDC settlements on Stellar Testnet with Soroban smart contracts and sub-second finality.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-card-inner">
              <span className="stat-value">$0.10</span>
              <span className="stat-label">Per Batch</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-inner">
              <span className="stat-value">$0.05</span>
              <span className="stat-label">Per Summary</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-inner">
              <span className="stat-value">$0.02</span>
              <span className="stat-label">Per Impact</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-inner">
              <span className="stat-value">~2s</span>
              <span className="stat-label">Settlement</span>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="tech-badges">
          <span className="tech-badge">⭐ Stellar Testnet</span>
          <span className="tech-badge">⚡ x402 Protocol</span>
          <span className="tech-badge">🧠 Groq AI Agent</span>
          <span className="tech-badge">🤖 Auto-triggered x402</span>
          <span className="tech-badge">💳 USDC Payments</span>
          <span className="tech-badge">🔐 Soroban Contracts</span>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;