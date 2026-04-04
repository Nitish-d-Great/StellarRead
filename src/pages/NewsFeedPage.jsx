import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStellarX402Service } from '../services/stellarX402';
import ArticleCard from '../components/ArticleCard';
import BillingCounter from '../components/BillingCounter';
import AgentLog from '../components/AgentLog';
import Header from '../components/Header';
import { demoArticles } from '../data/articles';
import './NewsFeedPage.css';

const TOP_UP_READ_RATIO = 0.8; // pay when user has read >=80%

const NewsFeedPage = ({ walletAddress, sessionBudget, userInterests, onSessionEnd }) => {
  const navigate = useNavigate();
  const stellarService = getStellarX402Service();

  const [articles, setArticles] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [isAgentWorking, setIsAgentWorking] = useState(false);
  const [agentStatus, setAgentStatus] = useState(null);
  const [agentLog, setAgentLog] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [batchCount, setBatchCount] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [budgetExhausted, setBudgetExhausted] = useState(false);
  const [readingDigest, setReadingDigest] = useState([]);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [impactDigests, setImpactDigests] = useState([]);
  const [isImpacting, setIsImpacting] = useState(false);

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

  const agentRunningRef = useRef(false);
  const hasLoadedFreeRef = useRef(false);
  const lastTopUpTriggerAtRef = useRef(0);

  const logAgent = (entry) => {
    setAgentLog(prev => [{ ...entry, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  const loadFreeBatch = useCallback(async () => {
    if (hasLoadedFreeRef.current) return;
    hasLoadedFreeRef.current = true;

    try {
      setIsLoadingArticles(true);
      const free = await stellarService.fetchFreeBatch();
      setArticles(
        (free || []).map(a => ({
          ...a,
          sourceId: String(a.id),
          id: `${a.id}-free`,
        }))
      );
      setAgentStatus({ type: 'success', icon: '📰', message: 'Loaded 10 free articles.' });
      setTimeout(() => setAgentStatus(null), 2500);
    } catch (err) {
      console.error('Free batch error:', err.message);
      setArticles(demoArticles);
      setAgentStatus({ type: 'error', icon: '⚠️', message: 'Free batch unavailable — showing demo articles.' });
      setTimeout(() => setAgentStatus(null), 5000);
    } finally {
      setIsLoadingArticles(false);
    }
  }, [stellarService]);

  /**
   * Next batch when ≥80% of current articles are read (see useEffect below).
   * No interest / LLM gate — always pays via x402 when this runs.
   */
  const agentFetchBatch = useCallback(async () => {
    if (agentRunningRef.current) return;
    if (!stellarService.hasBudget()) {
      setBudgetExhausted(true);
      setAgentStatus({ type: 'error', icon: '🛑', message: 'Budget exhausted.' });
      return;
    }

    agentRunningRef.current = true;
    setIsAgentWorking(true);

    try {
      setAgentStatus({
        type: 'info', icon: '⚡',
        message: 'Reading threshold met — requesting next batch (x402)...'
      });

      logAgent({
        type: 'fetch',
        decision: 'pay',
        reason: '≥80% of articles read — fetching next batch (Stellar x402)',
      });

      setIsLoadingArticles(true);

      const { txRecord, articles: newArticles } = await stellarService.payForBatch();

      setTransactions(stellarService.getSessionSummary().transactions);
      setTotalSpent(stellarService.totalSpent);
      setBatchCount(stellarService.batchCount);

      setAgentStatus({
        type: 'success', icon: '✅',
        message: `Batch #${txRecord.batch} settled — ${newArticles.length} articles added.`
      });

      logAgent({
        type: 'success',
        decision: 'paid',
        reason: `x402 batch #${txRecord.batch} · ${newArticles.length} articles`,
      });

      setArticles(prev => {
        const mapped = (Array.isArray(newArticles) ? newArticles : []).map((a, idx) => ({
          ...a,
          sourceId: String(a.id),
          id: `${a.id}-b${txRecord.batch}-${idx}`,
        }));

        return [...prev, ...mapped];
      });

      setTimeout(() => setAgentStatus(null), 4000);

    } catch (err) {
      console.error('Agent error:', err.message);

      if (err.message === 'SESSION_NOT_FUNDED') {
        setAgentStatus({
          type: 'error', icon: '💳',
          message: 'Session wallet not funded. Please restart and approve the funding transaction.'
        });
      } else if (err.message === 'SESSION_WALLET_EMPTY') {
        setBudgetExhausted(true);
        setAgentStatus({
          type: 'error', icon: '💸',
          message: 'Session wallet is empty. Start a new session to refund.'
        });
      } else if (err.message === 'SESSION_BUDGET_EXHAUSTED') {
        setBudgetExhausted(true);
        setAgentStatus({ type: 'error', icon: '🛑', message: 'Budget exhausted.' });
      } else if (err.message === 'BACKEND_UNAVAILABLE') {
        setArticles(demoArticles);
        setAgentStatus({
          type: 'error', icon: '⚠️',
          message: 'Backend unavailable — showing demo articles.'
        });
      } else if (err.message?.startsWith('PAYMENT_REJECTED:')) {
        setAgentStatus({
          type: 'error', icon: '✗',
          message: `Payment rejected: ${err.message.replace('PAYMENT_REJECTED:', '').trim()}`
        });
      } else {
        setAgentStatus({ type: 'error', icon: '⚠️', message: `Error: ${err.message}` });
      }
    } finally {
      setIsAgentWorking(false);
      setIsLoadingArticles(false);
      agentRunningRef.current = false;
    }
  }, [stellarService]);

  // Initial load + ensure x402 client is initialized (fixes "Service not initialized")
  useEffect(() => {
    if (!walletAddress) { navigate('/'); return; }
    stellarService.ensureSession(walletAddress, sessionBudget);
    loadFreeBatch();
  }, []); // eslint-disable-line

  // 80% read trigger (debounced)
  useEffect(() => {
    if (articles.length === 0) return;
    if (budgetExhausted) return;
    if (agentRunningRef.current) return;

    const total = articles.length;
    const read = readIds.size;
    const readRatio = total > 0 ? (read / total) : 0;
    const unread = total - read;

    // Only top-up when user is actually consuming (prevents paying immediately after load)
    if (read === 0) return;

    // Condition: read >= 80% OR unread <= 20% of total
    const shouldTopUp = readRatio >= TOP_UP_READ_RATIO || (unread / total) <= (1 - TOP_UP_READ_RATIO);
    if (!shouldTopUp) return;

    // Simple debounce to avoid double-firing on rapid state updates
    const now = Date.now();
    if (now - lastTopUpTriggerAtRef.current < 5000) return;
    lastTopUpTriggerAtRef.current = now;

    agentFetchBatch();
  }, [readIds, articles.length, agentFetchBatch, budgetExhausted, articles]);

  const handleArticleClick = (article) => {
    setSelectedArticle(article);
    if (!readIds.has(article.id)) {
      setReadIds(prev => new Set([...prev, article.id]));
    }
  };

  const handleEndSession = () => {
    const summary = stellarService.getSessionSummary();
    summary.articlesRead = readIds.size;
    onSessionEnd(summary);
    navigate('/confirmation');
  };

  const handleSummarize = async () => {
    if (!selectedArticle) return;
    setIsSummarizing(true);
    setAgentStatus({ type: 'info', icon: '🤖', message: 'Agent negotiating x402 payment for Groq compute...' });

    try {
      const { summary } = await stellarService.payForSummary(selectedArticle.title, selectedArticle.content);

      setReadingDigest(prev => [...prev, { title: selectedArticle.title, summary }]);
      setTransactions(stellarService.getSessionSummary().transactions);
      setTotalSpent(stellarService.totalSpent);

      setAgentStatus({ type: 'success', icon: '✨', message: 'Summary generated & safely paywalled for $0.05 USDC.' });
      setTimeout(() => setAgentStatus(null), 4000);
    } catch (err) {
      console.error('Summarize error:', err.message);
      setAgentStatus({ type: 'error', icon: '⚠️', message: `Summary failed: ${err.message}` });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleImpact = async () => {
    if (!selectedArticle) return;
    setIsImpacting(true);
    setAgentStatus({ type: 'info', icon: '🤖', message: 'Agent negotiating x402 payment for Groq impact analysis...' });

    try {
      const { impact } = await stellarService.payForImpact(selectedArticle.title, selectedArticle.content);

      setImpactDigests(prev => [...prev, { title: selectedArticle.title, impact }]);
      setTransactions(stellarService.getSessionSummary().transactions);
      setTotalSpent(stellarService.totalSpent);

      setAgentStatus({ type: 'success', icon: '✨', message: 'Impact Analysis generated & safely paywalled for $0.02 USDC.' });
      setTimeout(() => setAgentStatus(null), 4000);
    } catch (err) {
      console.error('Impact error:', err.message);
      setAgentStatus({ type: 'error', icon: '⚠️', message: `Impact Analysis failed: ${err.message}` });
    } finally {
      setIsImpacting(false);
    }
  };

  const unreadCount = articles.filter(a => !readIds.has(a.id)).length;
  const readRatio = articles.length > 0 ? (readIds.size / articles.length) : 0;

  return (
    <div className="feed-page">
      <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Dark Mode">
        {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
      </button>

      <Header walletAddress={walletAddress} totalSpent={totalSpent} batchCount={batchCount} />

      <div className="feed-layout">
        <aside className="feed-sidebar">
          <BillingCounter
            articlesRead={readIds.size}
            totalBatches={batchCount}
            totalSummaries={readingDigest.length}
            totalImpacts={impactDigests.length}
            totalSpent={totalSpent}
            budgetXLM={sessionBudget}
            remainingBudget={parseFloat(stellarService.getRemainingBudget())}
          />

          <div className="card interests-card">
            <h4>🧠 Agent Interests</h4>
            <p>{userInterests}</p>
            <span className="autonomous-badge">🤖 Autonomous mode</span>
          </div>

          <div className="buffer-status card">
            <h4>📊 Reading Progress</h4>
            <div className="buffer-numbers">
              <div className="buffer-stat">
                <span className="buffer-val">{unreadCount}</span>
                <span className="buffer-label">Unread</span>
              </div>
              <div className="buffer-sep">/</div>
              <div className="buffer-stat">
                <span className="buffer-val">{articles.length}</span>
                <span className="buffer-label">Total</span>
              </div>
            </div>
            <div className="buffer-bar">
              <div className="buffer-fill" style={{
                width: articles.length > 0 ? `${Math.max(0, Math.min(100, (readRatio * 100)))}%` : '0%',
                background: readRatio >= TOP_UP_READ_RATIO ? 'var(--accent-red)' : 'var(--stellar-blue)',
              }} />
            </div>
            <p className="buffer-note">
              {readRatio >= TOP_UP_READ_RATIO
                ? '🤖 Agent paying autonomously...'
                : `Auto-pays when you read ≥ ${Math.round(TOP_UP_READ_RATIO * 100)}%`}
            </p>
          </div>

          <AgentLog
            transactions={transactions}
            isAgentWorking={isAgentWorking}
            agentStatus={agentStatus}
            agentLog={agentLog}
          />

          {readIds.size > 0 && (
            <button className="btn end-session-btn" onClick={handleEndSession}>
              End Session →
            </button>
          )}

          <div className="sidebar-note">
            <span>⭐</span>
            <span>Stellar · USDC · x402 · Auto-triggered</span>
          </div>
        </aside>

        <main className="feed-main">
          <div className="feed-header">
            <div>
              <h2>{articles.length > 0 ? 'Live Web3 News' : 'Loading...'}</h2>
              <p className="feed-subtitle">
                {readIds.size === 0
                  ? 'Agent auto-triggers x402 requests; you approve each wallet signature'
                  : `${readIds.size} read · ${unreadCount} unread · ${batchCount} batch${batchCount !== 1 ? 'es' : ''} paid`}
              </p>
            </div>
            {articles.length > 0 && (
              <div className="live-badge-row">
                <span className="live-dot-anim" />
                <span>x402 · User-approved signatures</span>
              </div>
            )}
          </div>

          {isLoadingArticles && articles.length === 0 && (
            <div className="articles-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-img" />
                  <div className="skeleton-body">
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                    <div className="skeleton-line shorter" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {articles.length > 0 && (
            <div className="articles-grid">
              {articles.map(article => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  isRead={readIds.has(article.id)}
                  onClick={() => handleArticleClick(article)}
                />
              ))}
              {isLoadingArticles && (
                <div className="loading-more">
                  <span className="al-spinner" />
                  <span>Agent requesting next batch (awaiting wallet approval)...</span>
                </div>
              )}
            </div>
          )}

          {budgetExhausted && (
            <div className="budget-banner">
              <span>🛑</span>
              <div>
                <strong>Session budget exhausted</strong>
                <p>{readIds.size} articles read across {batchCount} batches.</p>
              </div>
              <button className="btn btn-primary" onClick={handleEndSession}>
                View Summary →
              </button>
            </div>
          )}
        </main>

        <aside className="digest-sidebar">
          <div className="digest-header">
            <span style={{ fontSize: '1.5rem' }}>🧠</span>
            <h3>Reading Digest</h3>
          </div>
          {readingDigest.length === 0 ? (
            <div className="digest-empty">
              Open an article and ask the Agent to summarize it.
            </div>
          ) : (
            <div className="digest-list">
              {readingDigest.map((item, idx) => (
                <div className="digest-item" key={idx}>
                  <h4 className="digest-title">{item.title}</h4>
                  <p className="digest-summary">{item.summary}</p>
                </div>
              ))}
            </div>
          )}
        </aside>

        <aside className="digest-sidebar impact-sidebar">
          <div className="digest-header">
            <span style={{ fontSize: '1.5rem' }}>⚡</span>
            <h3>Impact Analysis</h3>
          </div>
          {impactDigests.length === 0 ? (
            <div className="digest-empty">
              Open an article and ask the Agent for a sector impact analysis.
            </div>
          ) : (
            <div className="digest-list">
              {impactDigests.map((item, idx) => (
                <div className="digest-item" key={idx}>
                  <h4 className="digest-title">{item.title}</h4>
                  <p className="digest-summary">{item.impact}</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {selectedArticle && (
        <div className="modal-overlay" onClick={() => setSelectedArticle(null)}>
          <div className="article-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedArticle(null)}>✕</button>
            <div className="modal-image">
              <img src={selectedArticle.image} alt={selectedArticle.title} />
              <span className="modal-cat">{selectedArticle.category}</span>
            </div>
            <div className="modal-body">
              <h1>{selectedArticle.title}</h1>
              <div className="modal-meta">
                <span>✍️ {selectedArticle.author}</span>
                <span>⏱️ {selectedArticle.readTime}</span>
                <span>🕐 {selectedArticle.publishedAt}</span>
              </div>
              <div className="modal-content">
                {selectedArticle.content.split('\n\n').map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
              {selectedArticle.url && (
                <a href={selectedArticle.url} target="_blank" rel="noopener noreferrer"
                  className="btn btn-outline read-original">
                  Read full article on {selectedArticle.source} ↗
                </a>
              )}
              <button
                className="summarize-btn"
                onClick={handleSummarize}
                disabled={isSummarizing || readingDigest.some(d => d.title === selectedArticle.title)}
              >
                {isSummarizing ? (
                  <><span className="al-spinner" /> Negotiating paid compute...</>
                ) : readingDigest.some(d => d.title === selectedArticle.title) ? (
                  <>✓ Summarized</>
                ) : (
                  <>✨ Ask Agent to Summarize (0.05 USDC)</>
                )}
              </button>
              <button
                className="summarize-btn impact-btn"
                onClick={handleImpact}
                disabled={isImpacting || impactDigests.some(d => d.title === selectedArticle.title)}
                style={{ marginTop: '0.75rem', backgroundImage: 'linear-gradient(135deg, var(--accent-green) 0%, #10b981 100%)' }}
              >
                {isImpacting ? (
                  <><span className="al-spinner" /> Negotiating paid compute...</>
                ) : impactDigests.some(d => d.title === selectedArticle.title) ? (
                  <>✓ Impact Analyzed</>
                ) : (
                  <>⚡ Analyze Sector Impact (0.02 USDC)</>
                )}
              </button>
              <div className="modal-paid-badge">
                ✓ Unlocked via x402 · Wallet-approved signature · Settled on Stellar
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsFeedPage;