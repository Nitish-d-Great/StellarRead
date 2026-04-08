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
  const [bookmarkedArticles, setBookmarkedArticles] = useState([]);

  const stellarServiceRef = useRef(null);

  const handleSessionStart = async (address, budget, interests, agentSecret) => {
    getStellarX402Service().initialize(address, budget, agentSecret);
    setWalletAddress(address);
    setSessionBudget(budget);
    setUserInterests(interests);
    setSessionReady(true);
    console.log('🚀 Session started. Agent is now autonomous.');
    console.log('   Agent Secret securely stored in memory.');
  };

  const handleSessionEnd = (summary) => {
    setSessionSummary(summary);
  };

  const handleNewSession = () => {
    setSessionSummary(null);
    setSessionReady(false);
    setWalletAddress(null);
    setBookmarkedArticles([]);
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
            bookmarkedArticles={bookmarkedArticles}
            setBookmarkedArticles={setBookmarkedArticles}
          />
        } />
        <Route path="/confirmation" element={
          <ConfirmationPage
            walletAddress={walletAddress}
            sessionSummary={sessionSummary}
            onNewSession={handleNewSession}
            bookmarkedArticles={bookmarkedArticles}
          />
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;