import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function DashboardPage({ user }) {
  const [stats, setStats] = useState({ mandatesThisWeek: 0, lastMandateDate: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const { data } = await supabase
        .from('f04_mandates')
        .select('id, trade_date, status, line_count')
        .gte('trade_date', weekAgo.toISOString().split('T')[0])
        .order('trade_date', { ascending: false })

      setStats({
        mandatesThisWeek: data?.length || 0,
        lastMandateDate: data?.[0]?.trade_date || null,
        lastMandateLines: data?.[0]?.line_count || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div style={{ padding: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 2,
          textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 6
        }}>
          {today}
        </div>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontSize: 30,
          color: 'var(--navy)', fontWeight: 700, marginBottom: 6
        }}>
          Good morning
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {user?.email}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 40 }}>
        <StatCard
          label="Mandates This Week"
          value={loading ? '…' : stats.mandatesThisWeek}
          sub="F-04 records approved"
          accent="var(--gold)"
        />
        <StatCard
          label="Last Mandate"
          value={loading ? '…' : stats.lastMandateDate
            ? new Date(stats.lastMandateDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            : 'None yet'}
          sub={stats.lastMandateLines ? `${stats.lastMandateLines} lines` : ''}
          accent="var(--green)"
        />
        <StatCard
          label="Reconciliation"
          value="—"
          sub="Coming in next release"
          accent="var(--text-muted)"
          dim
        />
      </div>

      {/* Module cards */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 2,
          textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 16
        }}>
          Trading Controls
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <ModuleCard
            to="/f04"
            icon="📋"
            label="F-04 Mandate Import"
            desc="Upload today's NaYa jobbing sheet, extract mandate lines with AI, review and approve."
            live
          />
          <ModuleCard
            icon="⚖️"
            label="Reconciliation"
            desc="Compare approved mandates against NaYa executed trades after market close. Auto-generates F-05."
            soon
          />
          <ModuleCard
            icon="📊"
            label="F-05 Trade Report"
            desc="Daily trade reconciliation report auto-generated from NaYa execution logs."
            soon
          />
          <ModuleCard
            icon="⚠️"
            label="F-06 Error Trade GL"
            desc="Error trade recording, root cause documentation, NGX threshold monitoring."
            soon
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent, dim }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '24px',
      border: '1px solid var(--border)',
      opacity: dim ? 0.5 : 1,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--navy)', marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: accent }}>
        {sub}
      </div>
    </div>
  )
}

function ModuleCard({ to, icon, label, desc, live, soon }) {
  const inner = (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '24px',
      border: live ? '2px solid var(--gold)' : '1px solid var(--border)',
      cursor: live ? 'pointer' : 'default',
      opacity: soon ? 0.55 : 1,
      transition: 'box-shadow 0.2s',
    }}
      onMouseOver={e => live && (e.currentTarget.style.boxShadow = '0 4px 20px rgba(201,168,76,0.2)')}
      onMouseOut={e => live && (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        {live && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            textTransform: 'uppercase', color: 'var(--green)',
            background: '#e8f5e9', padding: '3px 8px', borderRadius: 20
          }}>Live</span>
        )}
        {soon && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            textTransform: 'uppercase', color: 'var(--text-muted)',
            background: 'var(--surface)', padding: '3px 8px', borderRadius: 20,
            border: '1px solid var(--border)'
          }}>Coming soon</span>
        )}
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {desc}
      </div>
    </div>
  )

  if (live && to) return <Link to={to} style={{ textDecoration: 'none' }}>{inner}</Link>
  return inner
}
