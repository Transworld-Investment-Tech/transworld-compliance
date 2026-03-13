import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Shell from './components/Shell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import F04ImportPage from './pages/F04ImportPage'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for auth changes (magic link click lands here)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )

    return () => subscription.unsubscribe()
  }, [])

  // Still checking auth
  if (session === undefined) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--navy)'
      }}>
        <div style={{ color: 'var(--gold)', fontFamily: 'var(--font-serif)', fontSize: 18 }}>
          Loading…
        </div>
      </div>
    )
  }

  // Not logged in
  if (!session) return <LoginPage />

  // Logged in
  return (
    <Shell user={session.user}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage user={session.user} />} />
        <Route path="/f04" element={<F04ImportPage user={session.user} />} />
        {/* Future routes added here:
            <Route path="/reconcile" element={<ReconcilePage user={session.user} />} />
            <Route path="/f05" element={<F05Page user={session.user} />} />
            <Route path="/f06" element={<F06Page user={session.user} />} />
        */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Shell>
  )
}
