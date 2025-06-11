import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Sidebar from "./components/Sidebar";
import AuthWrapper from "./components/AuthWrapper";
import Dashboard from "./components/Dashboard";
import Elections from "./components/Elections";
import ElectionDetail from "./components/ElectionDetail";
import Analytics from "./components/Analytics";
import AdminPage from "./components/AdminPage";
import { CONFIG } from "./config";

function App() {
  const [user, setUser] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check if contract address has changed and clear localStorage if so
    const storedContractAddress = localStorage.getItem('contractAddress');
    if (storedContractAddress && storedContractAddress !== CONFIG.CONTRACT_ADDRESS) {
      console.log('Contract address changed, clearing localStorage');
      localStorage.clear();
    }
    localStorage.setItem('contractAddress', CONFIG.CONTRACT_ADDRESS);
    
    // Check if user is registered
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      setUser(JSON.parse(userData));
      setIsConnected(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-dark-bg">
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'bg-dark-card text-white border border-gray-700',
          duration: 4000,
        }}
      />
      
      {isConnected ? (
        <div className="flex">
          <Sidebar user={user} />
          <main className="flex-1 ml-64 p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard user={user} />} />
              <Route path="/elections" element={<Elections user={user} />} />
              <Route path="/elections/:id" element={<ElectionDetail user={user} />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={
                <div className="card p-8 text-center">
                  <h2 className="text-2xl font-bold text-red-400">Page not found</h2>
                  <p className="text-gray-400 mt-2">The page you're looking for doesn't exist.</p>
                </div>
              } />
            </Routes>
          </main>
        </div>
      ) : (
        <AuthWrapper setUser={setUser} setIsConnected={setIsConnected} />
      )}
    </div>
  );
}

export default App;
