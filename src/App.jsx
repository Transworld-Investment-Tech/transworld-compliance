import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Shell from './components/Shell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import F04ImportPage from './pages/F04ImportPage'
import ReconciliationPage from './pages/ReconciliationPage'
import F06Page from './pages/F06Page'
import UsersPage from './pages/UsersPage'
import SetPasswordPage from './pages/SetPasswordPage'

export default function App() {
  const [session,      setSession]      = useState(undefined)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        // Supabase fires PASSWORD_RECOVERY when user clicks reset email link
        if (event === 'PASSWORD_RECOVERY') {
          setRecoveryMode(true)
        }
        if (event === 'USER_UPDATED') {
          setRecoveryMode(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Loading
  if (session === undefined) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--navy)' }}>
        <div style={{ color: 'var(--gold)', fontFamily: 'var(--font-serif)', fontSize: 18 }}>Loading…</div>
      </div>
    )
  }

  // Password recovery flow — user clicked reset link in email
  // Show set-password form even though they have a session
  if (recoveryMode) {
    return <SetPasswordPage mode="reset" />
  }

  // Not logged in
  if (!session) return <LoginPage />

  // Logged in — full app
  return (
    <Shell user={session.user}>
      <Routes>
        <Route path="/"                element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"       element={<DashboardPage user={session.user} />} />
        <Route path="/f04"             element={<F04ImportPage user={session.user} />} />
        <Route path="/reconcile"       element={<ReconciliationPage user={session.user} />} />
        <Route path="/f06"             element={<F06Page user={session.user} />} />
        <Route path="/users"           element={<UsersPage user={session.user} />} />
        <Route path="/change-password" element={<SetPasswordPage mode="change" />} />
        <Route path="*"                element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Shell>
  )
}
