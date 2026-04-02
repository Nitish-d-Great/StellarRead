import React, { useState, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import NewsFeedPage from './pages/NewsFeedPage';
import ConfirmationPage from './pages/ConfirmationPage';
import { getStellarX402Service } from './services/stellarX402';

function App() {
  const [walletAddress, setWalletAddress]     = useState(null);
  const [sessionBudget, setSessionBudget]     = useState(1.0);
  const [userInterests, setUserInterests]     = useState('Stellar, DeFi, AI agents');
  const [sessionReady, setSessionReady]       = useState(false);
  const [sessionSummary, setSessionSummary]   = useState(null);

  const stellarServiceRef = useRef(null);

  /**
   * Called from LandingPage after user:
   *   1. Connects Freighter
   *   2. Sets interests + budget
   *   3. Approves the ONE funding transaction
   */
  const handleSessionStart = async (address, budget, interests, fundingTxHash) => {
    getStellarX402Service().initialize(address, budget);
    setWalletAddress(address);
    setSessionBudget(budget);
    setUserInterests(interests);
    setSessionReady(true);
    console.log('🚀 Session started. Agent is now autonomous.');
    console.log('   Funding tx:', fundingTxHash);
  };

  const handleSessionEnd = (summary) => {
    setSessionSummary(summary);
  };

  const handleNewSession = () => {
    setSessionSummary(null);
    setSessionReady(false);
    setWalletAddress(null);
    const service = getStellarX402Service();
    service.reset();
    // Force new instance next time
    stellarServiceRef.current = null;
  };

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={
          <LandingPage
            onSessionStart={handleSessionStart}
            walletAddress={walletAddress}
            sessionReady={sessionReady}
          />
        } />
        <Route path="/feed" element={
          <NewsFeedPage
            walletAddress={walletAddress}
            sessionBudget={sessionBudget}
            userInterests={userInterests}
            onSessionEnd={handleSessionEnd}
          />
        } />
        <Route path="/confirmation" element={
          <ConfirmationPage
            walletAddress={walletAddress}
            sessionSummary={sessionSummary}
            onNewSession={handleNewSession}
          />
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;