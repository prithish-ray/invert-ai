import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { getToken, getUser, getMe, clearAuth } from './api'
import AuthPage from './components/AuthPage'
import NavBar from './components/NavBar'
import DecisionGate from './components/DecisionGate'
import SessionView from './components/SessionView'
import Journal from './components/Journal'
import BiasFingerprint from './components/BiasFingerprint'

export default function App() {
  const [user, setUser]       = useState(null)
  const [checking, setChecking] = useState(true)   // verifying stored token on load

  // On mount: validate any stored token
  useEffect(() => {
    const token = getToken()
    if (!token) { setChecking(false); return }

    getMe()
      .then(u => setUser(u))
      .catch(() => clearAuth())   // token expired or invalid — wipe it
      .finally(() => setChecking(false))
  }, [])

  const handleAuth = (userData) => setUser(userData)

  const handleLogout = () => {
    clearAuth()
    setUser(null)
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <AuthPage onAuth={handleAuth} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar user={user} onLogout={handleLogout} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/"            element={<Navigate to="/gate" replace />} />
          <Route path="/gate"        element={<DecisionGate />} />
          <Route path="/session/:id" element={<SessionView />} />
          <Route path="/journal"     element={<Journal />} />
          <Route path="/bias"        element={<BiasFingerprint />} />
        </Routes>
      </main>
    </div>
  )
}
