/**
 * StellarRead — Replay Protection
 *
 * Prevents a tx hash from being used more than once.
 * A valid x402 payment proof can only unlock ONE batch.
 *
 * Implementation: in-memory Set (sufficient for hackathon).
 * Production: use Redis or a database with TTL.
 */

const usedHashes = new Set();

// Auto-expire hashes after 10 minutes (prevent unbounded memory growth)
const EXPIRY_MS = 10 * 60 * 1000;

/**
 * Check if a tx hash has already been used.
 * Returns true if already used (replay attack detected).
 */
export function isAlreadyUsed(txHash) {
  return usedHashes.has(txHash);
}

/**
 * Mark a tx hash as used.
 * Automatically expires after EXPIRY_MS.
 */
export function markAsUsed(txHash) {
  usedHashes.add(txHash);
  setTimeout(() => {
    usedHashes.delete(txHash);
    console.log(`🗑️  Expired replay record: ${txHash.slice(0, 8)}...`);
  }, EXPIRY_MS);
  console.log(`🔒 Marked tx as used: ${txHash.slice(0, 8)}... (expires in ${EXPIRY_MS / 1000}s)`);
}

export function getUsedCount() {
  return usedHashes.size;
}

export default { isAlreadyUsed, markAsUsed, getUsedCount };
