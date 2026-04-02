import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ConfirmationPage.css';

const ConfirmationPage = ({ walletAddress, sessionSummary, onNewSession }) => {
  const navigate = useNavigate();

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

  return (
    <div className="conf-page">
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
            <span className="cs-label">XLM Spent</span>
          </div>
          <div className="conf-stat">
            <span className="cs-val">{(budgetRemaining || 0).toFixed(2)}</span>
            <span className="cs-label">XLM Remaining</span>
          </div>
        </div>

        {/* x402 explainer */}
        <div className="conf-explainer">
          <div className="ce-row">
            <span className="ce-icon">⚡</span>
            <div>
              <strong>How x402 worked in this session</strong>
              <p>
                Each time your unread buffer dropped to 2 articles, the agent
                automatically paid <strong>0.10 XLM</strong> on Stellar. The backend
                verified each transaction on Horizon before returning articles.
                The Stellar tx hash was the access credential — no API keys,
                no subscriptions.
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
                    <span className="ctx-amount">{tx.amount} XLM</span>
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
