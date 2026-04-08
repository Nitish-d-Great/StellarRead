import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStellarX402Service } from '../services/stellarX402';
import './ConfirmationPage.css';

const ConfirmationPage = ({ walletAddress, sessionSummary, onNewSession }) => {
  const navigate = useNavigate();
  const [refundState, setRefundState] = useState('idle'); // idle | loading | success | error
  const [refundResult, setRefundResult] = useState(null);
  const [refundError, setRefundError] = useState(null);

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

  if (!sessionSummary) {
    return (
      <div className="conf-page">
        <div className="conf-empty">
          <p>No session data found.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  const {
    batchCount,
    totalSpent,
    transactions,
    articlesRead,
    sessionBudget,
    budgetRemaining,
  } = sessionSummary;

  const handleNewSession = () => {
    onNewSession();
    navigate('/');
  };

  const handleRefund = async () => {
    setRefundState('loading');
    setRefundError(null);
    try {
      const service = getStellarX402Service();
      const result = await service.refundRemainingFunds(walletAddress);
      setRefundResult(result);
      setRefundState('success');
    } catch (err) {
      setRefundError(err.message);
      setRefundState('error');
    }
  };

  return (
    <div className="conf-page">
      <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Dark Mode">
        {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>

      <div className="conf-container">

        {/* Header */}
        <div className="conf-header">
          <div className="conf-check">✓</div>
          <h1>Session Complete</h1>
          <p>
            Your AI agent settled {batchCount} batch{batchCount !== 1 ? 'es' : ''} on
            Stellar via x402.
          </p>
        </div>

        {/* Stats */}
        <div className="conf-stats">
          <div className="conf-stat">
            <span className="cs-val">{articlesRead}</span>
            <span className="cs-label">Articles Read</span>
          </div>
          <div className="conf-stat">
            <span className="cs-val">{batchCount}</span>
            <span className="cs-label">Batches Paid</span>
          </div>
          <div className="conf-stat">
            <span className="cs-val">{(totalSpent || 0).toFixed(2)}</span>
            <span className="cs-label">Spent (USD est.)</span>
          </div>
          <div className="conf-stat">
            <span className="cs-val">{(budgetRemaining || 0).toFixed(2)}</span>
            <span className="cs-label">Budget Remaining</span>
          </div>
        </div>

        {/* x402 explainer */}
        <div className="conf-explainer">
          <div className="ce-row">
            <span className="ce-icon">⚡</span>
            <div>
              <strong>How x402 worked in this session</strong>
              <p>
                Each time your read ratio crossed the threshold, the app requested
                a new batch through x402. The server returned 402 requirements,
                Freighter signed the payment payload, and the facilitator settled
                on Stellar before returning articles.
              </p>
            </div>
          </div>
        </div>

        {/* Transactions */}
        {transactions && transactions.length > 0 && (
          <div className="conf-txs">
            <h3>Stellar Transactions</h3>
            <div className="ctx-list">
              {transactions.map(tx => (
                <div key={tx.hash} className="ctx-item">
                  <div className="ctx-top">
                    <span className="ctx-batch">Batch #{tx.batch}</span>
                    <span className="ctx-amount">{tx.amount} USDC</span>
                    <span className="ctx-status">✓ Confirmed</span>
                  </div>
                  <div className="ctx-hash">
                    <span className="ctx-hash-label">Tx:</span>
                    <a
                      href={tx.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ctx-link"
                    >
                      {tx.hash} ↗
                    </a>
                  </div>
                  <div className="ctx-time">
                    {new Date(tx.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wallet */}
        {walletAddress && (
          <div className="conf-wallet">
            <span>👛 Wallet:</span>
            <span className="conf-addr">{walletAddress}</span>
          </div>
        )}

        {/* Refund */}
        {budgetRemaining > 0 && refundState !== 'success' && (
          <div className="conf-refund">
            <div className="conf-refund-info">
              <span className="conf-refund-icon">💸</span>
              <div>
                <strong>Refund Remaining Funds</strong>
                <p>
                  You have <span className="conf-refund-amount">{(budgetRemaining || 0).toFixed(2)} USDC</span> unspent
                  in your agent wallet. Refund it back to your Freighter wallet.
                </p>
              </div>
            </div>
            <button
              className="btn btn-refund"
              onClick={handleRefund}
              disabled={refundState === 'loading'}
            >
              {refundState === 'loading' ? (
                <><span className="al-spinner" /> Processing Refund...</>
              ) : (
                <>Refund {(budgetRemaining || 0).toFixed(2)} USDC</>
              )}
            </button>
            {refundState === 'error' && (
              <p className="conf-refund-error">{refundError}</p>
            )}
          </div>
        )}

        {refundState === 'success' && refundResult && (
          <div className="conf-refund-success">
            <span className="conf-refund-check">✓</span>
            <div>
              <strong>Refund Successful</strong>
              <p>{parseFloat(refundResult.refundedAmount).toFixed(2)} USDC returned to your wallet.</p>
              <a
                href={refundResult.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ctx-link"
              >
                View on Stellar Expert ↗
              </a>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="conf-actions">
          <button className="btn btn-primary btn-large" onClick={handleNewSession}>
            Start New Session
          </button>
          <a
            href="https://stellar.expert/explorer/testnet"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            Stellar Explorer ↗
          </a>
        </div>

        <div className="conf-hackathon">
          <span>🏆</span>
          <span>Stellar Agents x402 Hackathon 2026 · DoraHacks</span>
        </div>

      </div>
    </div>
  );
};

export default ConfirmationPage;
