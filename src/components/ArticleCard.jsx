import React from 'react';
import './ArticleCard.css';

const CATEGORY_COLORS = {
  Bitcoin: '#F7931A',
  Ethereum: '#627EEA',
  Solana: '#9945FF',
  Stellar: '#3B82F6',
  DeFi: '#10B981',
  NFT: '#EC4899',
  Regulation: '#EF4444',
  Stablecoins: '#06B6D4',
  AI: '#8B5CF6',
  Exchange: '#F59E0B',
  Crypto: '#64748B',
};

const ArticleCard = ({ article, isRead, onClick }) => {
  const catColor = CATEGORY_COLORS[article.category] || '#64748B';

  return (
    <article className={`article-card ${isRead ? 'is-read' : ''}`} onClick={onClick}>
      {/* Thumbnail */}
      <div className="card-image">
        <img src={article.image} alt={article.title} loading="lazy" />
        <span
          className="card-category"
          style={{ background: catColor + '18', color: catColor, border: `1px solid ${catColor}30` }}
        >
          {article.category}
        </span>
        {isRead && (
          <div className="card-read-badge">
            <span>✓ Read</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="card-body">
        <h3 className="card-title">{article.title}</h3>
        <p className="card-summary">{article.summary}</p>

        <div className="card-meta">
          <span className="meta-author">{article.author}</span>
          <div className="meta-right">
            <span>{article.readTime}</span>
            <span className="meta-sep">·</span>
            <span>{article.publishedAt}</span>
          </div>
        </div>
      </div>

      {/* Hover overlay */}
      <div className="card-overlay">
        <span>{isRead ? '↩ Read Again' : '→ Read Article'}</span>
      </div>
    </article>
  );
};

export default ArticleCard;
