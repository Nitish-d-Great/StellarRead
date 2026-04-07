import React from 'react';
import './AgentLog.css';

function decisionBadge(entry) {
  if (entry.type === 'fetch') return '⏳ Next batch';
  if (entry.type === 'success') return '✓ Settled';
  if (entry.decision === 'skip') return '⏭ Skipped';
  if (entry.decision === 'pay') return '✓ Paid';
  return '•';
}

const AgentLog = ({ transactions, isAgentWorking, agentStatus, agentLog = [] }) => {
  return (
    <div className="agent-log">
      <div className="al-header">
        <div className="al-title">
          <span className="al-icon">🤖</span>
          <h3>Agent Log</h3>
        </div>
        {isAgentWorking && (
          <span className="al-working">
            <span className="al-spinner" />
            Working...
          </span>
        )}
      </div>

      {/* Current status */}
      {agentStatus && (
        <div className={`al-status al-status--${agentStatus.type}`}>
          <span className="al-status-icon">{agentStatus.icon}</span>
          <span>{agentStatus.message}</span>
        </div>
      )}

      {/* Agent decision history */}
      {agentLog.length > 0 && (
        <div className="al-decisions">
          {agentLog.map((entry, i) => (
            <div key={i} className={`al-decision al-decision--${entry.type}`}>
              <div className="al-decision-top">
                <span className="al-decision-badge">{decisionBadge(entry)}</span>
                {(entry.relevant != null && entry.total != null) && (
                  <span className="al-decision-stats">
                    {entry.relevant}/{entry.total} relevant
                  </span>
                )}
                <span className="al-decision-time">{entry.time}</span>
              </div>
              <p className="al-decision-reason">{entry.reason}</p>
              {entry.titles?.length > 0 && (
                <div className="al-decision-titles">
                  {entry.titles.slice(0, 2).map((t, j) => (
                    <span key={j} className="al-title-chip">"{t.slice(0, 40)}..."</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stellar transactions */}
      <div className="al-txs">
        {transactions.length === 0 && agentLog.length === 0 ? (
          <div className="al-empty">
            <p>Agent will log decisions and Stellar transactions here.</p>
          </div>
        ) : (
          [...transactions].reverse().map(tx => {
            const h = tx.hash || tx.transaction;
            if (!h) return null;
            return (
            <div key={h} className="al-tx animate-fadeIn">
              <div className="al-tx-top">
                <span className="al-tx-batch">
                  {tx.batch ? `Batch #${tx.batch}` : tx.type === 'wallet-funded' ? 'Wallet Funded' : tx.type ? `${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} Payment` : 'Payment'}
                </span>
                <span className="al-tx-amount">{tx.amount ? `$${tx.amount}` : 'x402'}</span>
              </div>
              <div className="al-tx-hash">
                <span className="al-tx-label">Tx</span>
                <a href={tx.explorerUrl || `https://stellar.expert/explorer/testnet/tx/${h}`} target="_blank" rel="noopener noreferrer"
                  className="al-tx-link">
                  {h.slice(0, 8)}...{h.slice(-6)} ↗
                </a>
              </div>
              <div className="al-tx-time">{new Date(tx.timestamp).toLocaleTimeString()}</div>
              <div className="al-tx-confirmed">
                <span className="al-confirmed-dot" />
                Confirmed on Stellar Testnet
              </div>
            </div>
            );
          })
        )}
      </div>

      <div className="al-footer">
        <span className="al-footer-icon">⚡</span>
        <span>x402 on Stellar · Claude agent</span>
      </div>
    </div>
  );
};

export default AgentLog;