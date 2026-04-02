/**
 * Optional preview fetch for debugging / future features.
 * Batch fetching is driven only by reading progress (≥80%) + x402 in NewsFeedPage.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export async function fetchPreviews() {
  const res = await fetch(`${BACKEND_URL}/api/articles/preview`);
  if (!res.ok) throw new Error(`Preview fetch failed: ${res.status}`);
  const data = await res.json();
  return data.previews || [];
}

export default { fetchPreviews };
