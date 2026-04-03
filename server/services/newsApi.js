/**
 * StellarRead — Server-side News API
 *
 * Sources (NEWS_SOURCE in server/.env):
 * - fmp — Financial Modeling Prep (free tier; needs FMP_API_KEY)
 * - coindesk_rss — CoinDesk public RSS (no key)
 * - cryptocompare — CryptoCompare (needs CRYPTOCOMPARE_API_KEY)
 */

const CRYPTOCOMPARE_BASE = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN';
const COINDESK_RSS_URL =
  process.env.COINDESK_RSS_URL || 'https://www.coindesk.com/arc/outboundfeeds/rss/';

/** FMP stable crypto news (Web3-friendly). Override with stock-latest if you prefer equities. */
const FMP_DEFAULT_ENDPOINT =
  process.env.FMP_NEWS_URL ||
  'https://financialmodelingprep.com/stable/news/crypto-latest';

const ARTICLES_PER_BATCH = parseInt(process.env.ARTICLES_PER_BATCH || '10', 10);
const CRYPTOCOMPARE_API_KEY = process.env.CRYPTOCOMPARE_API_KEY || '';
const FMP_API_KEY = process.env.FMP_API_KEY || '';

/** @type {'fmp' | 'coindesk_rss' | 'cryptocompare'} */
const NEWS_SOURCE = (process.env.NEWS_SOURCE || 'coindesk_rss').toLowerCase();

export async function fetchArticles(limit = ARTICLES_PER_BATCH) {
  if (NEWS_SOURCE === 'cryptocompare') {
    return fetchCryptoCompare(limit);
  }
  if (NEWS_SOURCE === 'coindesk_rss') {
    return fetchCoindeskRss(limit);
  }
  return fetchFmp(limit);
}

export async function fetchUniqueArticles(limit = ARTICLES_PER_BATCH, excludeIds = []) {
  const target = Math.max(1, Number(limit) || ARTICLES_PER_BATCH);
  const excluded = new Set((excludeIds || []).map(id => String(id)));
  const collected = [];
  const collectedIds = new Set();

  // Multiple attempts help when providers return overlapping "latest" sets.
  for (let attempt = 0; attempt < 8 && collected.length < target; attempt += 1) {
    const candidateLimit = Math.max(target * 4, 20);
    const batch = await fetchArticles(candidateLimit);

    for (const article of batch) {
      const id = String(article?.id || '');
      if (!id) continue;
      if (excluded.has(id) || collectedIds.has(id)) continue;
      collectedIds.add(id);
      collected.push(article);
      if (collected.length >= target) break;
    }
  }

  if (collected.length < target) {
    throw new Error(`UNIQUE_ARTICLES_EXHAUSTED:${collected.length}/${target}`);
  }
  return collected.slice(0, target);
}

async function fetchFmp(limit) {
  const key = FMP_API_KEY.trim();
  if (!key) {
    throw new Error(
      'FMP_API_KEY is required when NEWS_SOURCE=fmp. Get a free key at financialmodelingprep.com',
    );
  }

  const randomPage = Math.floor(Math.random() * 10);
  const url = `${FMP_DEFAULT_ENDPOINT}?page=${randomPage}&limit=${limit}&apikey=${encodeURIComponent(key)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`FMP error: ${response.status}`);
  }

  const data = await response.json();

  const errMsg = data?.['Error Message'] || data?.error || data?.Error;
  if (errMsg) {
    throw new Error(String(errMsg));
  }

  const list = Array.isArray(data) ? data : data?.content || data?.data;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(
      'No articles returned from FMP. Check FMP_API_KEY, endpoint (FMP_NEWS_URL), and plan limits.',
    );
  }

  const shuffled = [...list].sort(() => Math.random() - 0.5);

  return shuffled.slice(0, limit).map((item, index) => {
    const title = item.title || item.headline || 'Untitled';
    const body =
      item.text || item.description || item.content || item.summary || title;
    const urlArticle = item.url || item.link || '';
    const published =
      item.publishedDate || item.date || item.published_at || item.datetime;
    const symbol = item.symbol || item.tickers || '';
    const fallback = `${title}|${published || ''}|${item.site || item.source || ''}`;
    const id = String(item.id || item.news_id || urlArticle || fallback);

    return {
      id,
      title,
      summary: String(body).slice(0, 200) + (String(body).length > 200 ? '...' : ''),
      content: String(body),
      category: detectCategory(String(symbol), title),
      author: item.site || item.source || item.author || 'FMP',
      readTime: estimateReadTime(String(body)),
      publishedAt: formatPublished(published),
      image: item.image || item.imageUrl || null,
      url: urlArticle,
      source: item.site || item.source || 'Financial Modeling Prep',
    };
  });
}

async function fetchCryptoCompare(limit) {
  const url = CRYPTOCOMPARE_API_KEY
    ? `${CRYPTOCOMPARE_BASE}&api_key=${CRYPTOCOMPARE_API_KEY}`
    : CRYPTOCOMPARE_BASE;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`CryptoCompare error: ${response.status}`);
  }

  const data = await response.json();

  if (data.Response === 'Error' || data.Type === 1) {
    const msg = data.Message || 'CryptoCompare rejected the request';
    throw new Error(
      `${msg}. Set CRYPTOCOMPARE_API_KEY in server/.env (min-api.cryptocompare.com).`,
    );
  }

  if (!Array.isArray(data.Data) || data.Data.length === 0) {
    throw new Error(
      'No articles returned from CryptoCompare. Check CRYPTOCOMPARE_API_KEY and rate limits.',
    );
  }

  const shuffled = [...data.Data].sort(() => Math.random() - 0.5);

  return shuffled.slice(0, limit).map((item) => ({
    id: String(item.id || item.guid || item.url || `${item.title || 'untitled'}|${item.published_on || ''}`),
    title: item.title,
    summary: item.body?.slice(0, 200) + '...' || item.title,
    content: item.body || item.title,
    category: detectCategory(item.categories, item.title),
    author: item.source_info?.name || item.source || 'CryptoCompare',
    readTime: estimateReadTime(item.body),
    publishedAt: formatTimeAgoFromUnix(item.published_on),
    image: item.imageurl || null,
    url: item.url,
    source: item.source_info?.name || item.source || 'CryptoCompare',
  }));
}

function extractTagXml(block, tagName) {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const m = block.match(re);
  if (!m) return '';
  let inner = m[1].trim();
  const cdata = inner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) inner = cdata[1].trim();
  return inner.replace(/<[^>]+>/g, '').trim();
}

function extractGuid(block) {
  const m = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
  if (!m) return '';
  let inner = m[1].trim();
  const cdata = inner.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) inner = cdata[1].trim();
  return inner.replace(/<[^>]+>/g, '').trim();
}

function extractMediaUrl(block) {
  const m = block.match(/<media:content[^>]*url="([^"]+)"/i);
  return m ? m[1] : null;
}

async function fetchCoindeskRss(limit) {
  const response = await fetch(COINDESK_RSS_URL, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' },
  });
  if (!response.ok) {
    throw new Error(`CoinDesk RSS error: ${response.status}`);
  }
  const xml = await response.text();

  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let im;
  while ((im = itemRe.exec(xml)) !== null) {
    items.push(im[1]);
  }

  if (items.length === 0) {
    throw new Error('CoinDesk RSS returned no <item> entries.');
  }

  const shuffled = [...items].sort(() => Math.random() - 0.5);
  const slice = shuffled.slice(0, limit);

  return slice.map((block, index) => {
    const title = extractTagXml(block, 'title') || 'Untitled';
    const link = extractTagXml(block, 'link') || '';
    const description = extractTagXml(block, 'description') || '';
    const pubDateRaw = extractTagXml(block, 'pubDate') || '';
    const guid = extractGuid(block) || `${title}|${pubDateRaw}|${link}`;
    const author =
      extractTagXml(block, 'dc:creator') || extractTagXml(block, 'creator') || 'CoinDesk';
    const image = extractMediaUrl(block);

    const body = description || title;
    return {
      id: guid,
      title,
      summary: body.slice(0, 200) + (body.length > 200 ? '...' : ''),
      content: body || title,
      category: detectCategory('', title),
      author,
      readTime: estimateReadTime(body),
      publishedAt: formatTimeAgoFromRfc822(pubDateRaw),
      image,
      url: link,
      source: 'CoinDesk',
    };
  });
}

function detectCategory(categories, title) {
  const c = (categories || '').toLowerCase();
  const t = (title || '').toLowerCase();
  if (c.includes('btc') || t.includes('bitcoin')) return 'Bitcoin';
  if (c.includes('eth') || t.includes('ethereum')) return 'Ethereum';
  if (c.includes('sol') || t.includes('solana')) return 'Solana';
  if (c.includes('xlm') || t.includes('stellar')) return 'Stellar';
  if (c.includes('defi') || t.includes('defi')) return 'DeFi';
  if (c.includes('nft') || t.includes('nft')) return 'NFT';
  if (c.includes('stablecoin') || t.includes('stablecoin')) return 'Stablecoins';
  if (c.includes('ai') || t.includes('ai agent')) return 'AI';
  if (c.includes('regulation') || t.includes('sec')) return 'Regulation';
  return 'Crypto';
}

function formatTimeAgoFromUnix(timestamp) {
  if (!timestamp) return 'Recently';
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatTimeAgoFromRfc822(pubDateStr) {
  if (!pubDateStr) return 'Recently';
  const ms = Date.parse(pubDateStr);
  if (Number.isNaN(ms)) return 'Recently';
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** FMP often returns ISO-like date strings */
function formatPublished(raw) {
  if (raw == null || raw === '') return 'Recently';
  if (typeof raw === 'number') {
    return formatTimeAgoFromUnix(raw > 1e12 ? Math.floor(raw / 1000) : raw);
  }
  const ms = Date.parse(String(raw));
  if (Number.isNaN(ms)) return 'Recently';
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function estimateReadTime(content) {
  if (!content) return '3 min';
  const words = content.split(/\s+/).length;
  return `${Math.max(2, Math.min(Math.ceil(words / 200), 10))} min`;
}

export default { fetchArticles };
