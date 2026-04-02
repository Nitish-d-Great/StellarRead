import React from 'react';
import './BillingCounter.css';

const BillingCounter = ({ articlesRead, totalBatches, totalSpent, budgetXLM, remainingBudget }) => {
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
          <span className="bc-stat-label">Batches Paid</span>
          <span className="bc-stat-val batches">{totalBatches}</span>
        </div>
        <div className="bc-divider" />
        <div className="bc-stat">
          <span className="bc-stat-label">XLM Spent</span>
          <span className="bc-stat-val cost">{(totalSpent || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* Budget progress bar */}
      {budgetXLM > 0 && (
        <div className="bc-budget">
          <div className="bc-budget-labels">
            <span>Budget used</span>
            <span>{(totalSpent || 0).toFixed(2)} / {budgetXLM} XLM</span>
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
          <p className="bc-remaining">{(remainingBudget || 0).toFixed(2)} XLM remaining</p>
        </div>
      )}

      <div className="bc-rate">
        <span>Rate</span>
        <span>0.10 XLM / 10 articles</span>
      </div>

      <div className="bc-network">
        <span className="bc-net-dot" />
        <span>Stellar Testnet · XLM</span>
      </div>
    </div>
  );
};

export default BillingCounter;
