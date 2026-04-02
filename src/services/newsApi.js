/**
 * StellarRead — News API Service
 * Fetches real-time crypto/Web3 news from CryptoCompare (free, no CORS issues)
 */

const BASE_URL = 'https://min-api.cryptocompare.com/data/v2/news/?lang=EN';

export async function fetchWeb3News(limit = 10) {
  console.log(`📰 Fetching ${limit} articles from CryptoCompare...`);

  try {
    const apiKey = import.meta.env.VITE_CRYPTOCOMPARE_API_KEY;
    const url = apiKey ? `${BASE_URL}&api_key=${apiKey}` : BASE_URL;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`CryptoCompare error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.Data || data.Data.length === 0) {
      console.warn('No articles returned from CryptoCompare');
      return null;
    }

    // Shuffle to get variety on each call, then take limit
    const shuffled = [...data.Data].sort(() => Math.random() - 0.5);

    const articles = shuffled.slice(0, limit).map((item, index) => ({
      id: item.id?.toString() || `cc-${index}-${Date.now()}`,
      title: item.title,
      summary: item.body?.slice(0, 180) + '...' || item.title,
      content: item.body || item.title,
      category: detectCategory(item.categories, item.title),
      author: item.source_info?.name || item.source || 'CryptoCompare',
      readTime: estimateReadTime(item.body),
      publishedAt: formatTimeAgo(item.published_on),
      image: item.imageurl || getPlaceholderImage(index),
      url: item.url,
      source: item.source_info?.name || item.source || 'CryptoCompare',
    }));

    console.log(`✅ Loaded ${articles.length} articles`);
    return { articles, source: 'CryptoCompare' };
  } catch (error) {
    console.error('News fetch error:', error.message);
    return null;
  }
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
  if (c.includes('regulation') || t.includes('sec')) return 'Regulation';
  if (c.includes('stablecoin') || t.includes('stablecoin')) return 'Stablecoins';
  if (c.includes('ai') || t.includes('ai agent')) return 'AI';
  if (c.includes('exchange') || t.includes('binance')) return 'Exchange';
  return 'Crypto';
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Recently';
  try {
    const seconds = Math.floor((Date.now() / 1000) - timestamp);
    if (isNaN(seconds) || seconds < 0) return 'Recently';
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  } catch {
    return 'Recently';
  }
}

function estimateReadTime(content) {
  if (!content) return '3 min';
  const words = content.split(/\s+/).length;
  return `${Math.max(2, Math.min(Math.ceil(words / 200), 10))} min`;
}

function getPlaceholderImage(index) {
  const images = [
    'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=600',
    'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=600',
    'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=600',
    'https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=600',
    'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=600',
    'https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=600',
    'https://images.unsplash.com/photo-1516245834210-c4c142787335?w=600',
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600',
    'https://images.unsplash.com/photo-1634704784915-aacf363b021f?w=600',
    'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=600',
  ];
  return images[index % images.length];
}
