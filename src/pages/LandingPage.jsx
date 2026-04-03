import React, { useState } from 'react';
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

const LandingPage = ({ onSessionStart, walletAddress }) => {
  const navigate = useNavigate();
  const { address, isConnected, isConnecting, error, connect } = useFreighter();

  const [step, setStep] = useState(STEP.CONNECT);
  const [selectedBudget, setSelectedBudget] = useState(1.0);
  const [interests, setInterests] = useState(DEFAULT_INTERESTS);
  const [isFunding, setIsFunding] = useState(false);
  const [fundingError, setFundingError] = useState(null);
  const [fundingStatus, setFundingStatus] = useState('');

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

  /**
   * Generates Agent Wallet, gets XLM from Friendbot, adds USDC Trustline,
   * then requests exactly ONE Freighter 1.0 USDC payment from user to fund the Agent.
   */
  const handleFundAndStart = async () => {
    if (!connectedAddress || !interests.trim()) return;

    setIsFunding(true);
    setFundingError(null);
    setFundingStatus('Generating ephemeral agent wallet...');
    setStep(STEP.FUNDING);

    try {
      // 1. Generate Agent Keypair
      const agentKeypair = StellarSdk.Keypair.random();
      const agentPubKey = agentKeypair.publicKey();
      console.log('Generated Autonomous Agent Wallet:', agentPubKey);

      // 2. Fund with Friendbot
      setFundingStatus('Requesting XLM from Friendbot for reserves...');
      const fbRes = await fetch(`https://friendbot.stellar.org?addr=${agentPubKey}`);
      if (!fbRes.ok) throw new Error('Failed to fund agent via Friendbot. Testnet might be congested.');

      const horizon = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

      // 3. ChangeTrust for USDC
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

      // 4. Human funds the Agent with USDC via Freighter
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

      // Notify App, pass the agent secret!
      await onSessionStart(connectedAddress, selectedBudget, interests.trim(), agentKeypair.secret());
      navigate('/feed');

    } catch (err) {
      console.error('Funding error:', err);
      // Clean up horizon errors for UI
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
      <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Dark Mode">
        {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>

      {/* Hero */}
      <div className="landing-hero">
        <div className="hero-badge">
          <span>⭐</span>
          <span>Stellar Agents x402 Hackathon 2026</span>
        </div>

        <h1 className="hero-title">
          Read News.<br />
          <span className="hero-accent">Agent Auto-Requests via x402.</span>
        </h1>

        <p className="hero-sub">
          The app evaluates reading progress and triggers x402 payment requests on
          <strong> Stellar</strong>. You approve each wallet signature in
          <strong> Freighter</strong>.
        </p>

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
                className="btn btn-primary btn-large start-btn"
                onClick={handleFundAndStart}
                disabled={isFunding || !interests.trim()}
              >
                {isFunding
                  ? <><span className="btn-spinner" /> Waiting for Freighter...</>
                  : `Start Session (Budget $${selectedBudget}) →`}
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

      {/* Badges */}
      <div className="tech-badges">
        <span className="tech-badge">⭐ Stellar Testnet</span>
        <span className="tech-badge">⚡ x402 Protocol</span>
        <span className="tech-badge">🧠 Groq AI Agent</span>
        <span className="tech-badge">🤖 Auto-triggered x402</span>
      </div>
    </div>
  );
};

export default LandingPage;