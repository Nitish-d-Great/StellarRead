import { useState, useEffect, useCallback } from 'react';
import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  getNetworkDetails,
} from '@stellar/freighter-api';

/**
 * useFreighter — Stellar wallet hook
 *
 * Uses the correct @stellar/freighter-api v5 API:
 *   isConnected()   → { isConnected: boolean }   — is extension installed?
 *   isAllowed()     → { isAllowed: boolean }      — has site been approved?
 *   requestAccess() → { address: string, error? } — prompt user to approve
 *   getAddress()    → { address: string, error? } — get address (if allowed)
 *
 * Key fix from docs: requestAccess() returns .address NOT .publicKey
 */
export function useFreighter() {
  const [address, setAddress]           = useState(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInstalled, setIsInstalled]   = useState(false);
  const [network, setNetwork]           = useState(null);
  const [error, setError]               = useState(null);

  // ── Check on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        // Step 1: is Freighter installed?
        const connResult = await isConnected();
        const installed = connResult?.isConnected === true;
        setIsInstalled(installed);

        if (!installed) return;

        // Step 2: has this site been allowed before?
        const allowResult = await isAllowed();
        const allowed = allowResult?.isAllowed === true;

        if (!allowed) return;

        // Step 3: get address silently (no popup needed — already allowed)
        const addrResult = await getAddress();
        if (addrResult?.error) {
          console.warn('Freighter getAddress error:', addrResult.error);
          return;
        }

        const pubKey = addrResult?.address;
        if (!pubKey) return;

        // Step 4: get network
        const netResult = await getNetworkDetails();
        const passphrase = netResult?.networkPassphrase || '';

        setAddress(pubKey);
        setIsWalletConnected(true);
        setNetwork(passphrase);
        console.log('✅ Freighter auto-connected:', pubKey.slice(0, 8) + '...');

      } catch (err) {
        // Non-fatal — Freighter may not be installed
        // Non-fatal — Freighter may not be installed
        // Non-fatal — Freighter may not be installed
        // Non-fatal — Freighter may not be installed
        console.log('Freighter mount check:', err.message);
      }
    };

    check();
  }, []);

  // ── Connect (triggered by button click) ────────────────────────────────────
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Verify extension is installed
      const connResult = await isConnected();
      if (!connResult?.isConnected) {
        setError('Freighter not found. Please install it from freighter.app');
        setIsInstalled(false);
        return null;
      }

      setIsInstalled(true);

      // requestAccess → opens Freighter popup, returns { address } or { error }
      const accessResult = await requestAccess();

      if (accessResult?.error) {
        throw new Error(accessResult.error.message || 'Access denied');
      }

      // ✅ Correct field from docs: .address (NOT .publicKey)
      const pubKey = accessResult?.address;
      if (!pubKey) {
        throw new Error('No address returned from Freighter');
      }

      // Get network details
      let passphrase = 'Test SDF Network ; September 2015'; // testnet default
      try {
        const netResult = await getNetworkDetails();
        if (netResult && !netResult.error) {
          passphrase = netResult.networkPassphrase || passphrase;
        }
      } catch {
        // non-fatal
      }

      setAddress(pubKey);
      setIsWalletConnected(true);
      setIsInstalled(true);
      setNetwork(passphrase);

      console.log('✅ Freighter connected:', pubKey.slice(0, 8) + '...');
      console.log('   Network:', passphrase);

      return pubKey;

    } catch (err) {
      const msg = err?.message || 'Failed to connect';
      if (msg.includes('User declined') || msg.includes('rejected') || msg.includes('denied')) {
        setError('Connection rejected in Freighter. Please try again and click Approve.');
      } else {
        setError(msg);
      }
      console.error('Freighter connect error:', err);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setIsWalletConnected(false);
    setNetwork(null);
    setError(null);
  }, []);

  const isTestnet = !network || network.toLowerCase().includes('test');

  return {
    address,
    isConnected: isWalletConnected,
    isConnecting,
    isInstalled,
    isTestnet,
    network,
    error,
    connect,
    disconnect,
  };
}

export default useFreighter;