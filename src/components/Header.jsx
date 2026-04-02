import React from 'react';
import './Header.css';

const Header = ({ walletAddress, totalSpent, batchCount }) => {
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-brand">
          <span className="brand-icon">⭐</span>
          <span className="brand-name">StellarRead</span>
          <span className="brand-tag">x402</span>
        </div>

        <div className="header-right">
          {batchCount > 0 && (
            <div className="header-stat">
              <span className="stat-label">Batches</span>
              <span className="stat-val">{batchCount}</span>
            </div>
          )}
          {totalSpent > 0 && (
            <div className="header-stat">
              <span className="stat-label">Spent</span>
              <span className="stat-val">{totalSpent.toFixed(2)} XLM</span>
            </div>
          )}
          {shortAddress && (
            <div className="wallet-chip">
              <span className="wallet-dot" />
              <span>{shortAddress}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
