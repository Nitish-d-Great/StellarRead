import React from 'react';
import './BillingCounter.css';

const BillingCounter = ({ articlesRead, totalBatches, totalSummaries, totalSpent, budgetXLM, remainingBudget }) => {
  const budgetPct = budgetXLM > 0
    ? Math.min(((totalSpent || 0) / budgetXLM) * 100, 100)
    : 0;

  return (
    <div className="billing-counter">
      <div className="bc-header">
        <span className="bc-icon">💳</span>
        <h3>Session Billing</h3>
      </div>

      <div className="bc-stats">
        <div className="bc-stat">
          <span className="bc-stat-label">Articles Read</span>
          <span className="bc-stat-val articles">{articlesRead}</span>
        </div>
        <div className="bc-divider" />
        <div className="bc-stat">
          <span className="bc-stat-label">Batches</span>
          <span className="bc-stat-val batches">{totalBatches}</span>
        </div>
        <div className="bc-divider" />
        <div className="bc-stat">
          <span className="bc-stat-label">Summaries</span>
          <span className="bc-stat-val cost">{totalSummaries || 0}</span>
        </div>
        <div className="bc-divider" />
        <div className="bc-stat">
          <span className="bc-stat-label">Spent (USD est.)</span>
          <span className="bc-stat-val cost">{(totalSpent || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Budget progress bar */}
      {budgetXLM > 0 && (
        <div className="bc-budget">
          <div className="bc-budget-labels">
            <span>Budget used</span>
            <span>{(totalSpent || 0).toFixed(2)} / {budgetXLM} USD</span>
          </div>
          <div className="bc-budget-bar">
            <div
              className="bc-budget-fill"
              style={{
                width: `${budgetPct}%`,
                background: budgetPct > 80 ? 'var(--accent-red)' : 'var(--stellar-blue)',
              }}
            />
          </div>
          <p className="bc-remaining">{(remainingBudget || 0).toFixed(2)} USD remaining</p>
        </div>
      )}

      <div className="bc-rate">
        <span>Rates</span>
        <span>$0.10/batch · $0.05/summary</span>
      </div>

      <div className="bc-network">
        <span className="bc-net-dot" />
        <span>Stellar Testnet · x402 exact (USDC)</span>
      </div>
    </div>
  );
};

export default BillingCounter;
