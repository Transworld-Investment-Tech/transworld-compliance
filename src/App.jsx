import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Shell from './components/Shell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import F04ImportPage from './pages/F04ImportPage'
import ReconciliationPage from './pages/ReconciliationPage'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#0d1f3c'
      }}>
        <div style={{ color: '#c9a84c', fontFamily: "'Playfair Display', serif", fontSize: 18 }}>
          Loading…
        </div>
      </div>
    )
  }

  if (!session) return <LoginPage />

  return (
    <Shell user={session.user}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage user={session.user} />} />
        <Route path="/f04" element={<F04ImportPage user={session.user} />} />
        <Route path="/reconcile" element={<ReconciliationPage user={session.user} />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Shell>
  )
}
