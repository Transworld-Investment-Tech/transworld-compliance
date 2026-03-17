import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const NAV    = '#0d1f3c'
const GOLD   = '#c9a84c'
const GREEN  = '#1a7a4a'
const GREEN_BG = '#e8f5e9'
const RED    = '#c0392b'
const RED_BG = '#fdecea'
const BORDER = '#dde1ea'
const SURFACE = '#f7f8fa'

const ROLES = [
  { value: 'admin',            label: 'Admin',              desc: 'Full access + user management',          color: '#c9a84c',  bg: '#fef9ec' },
  { value: 'operations',       label: 'Operations',         desc: 'F-04, F-05, F-06 log & detect',          color: '#1a7a4a',  bg: '#e8f5e9' },
  { value: 'coo',              label: 'Chief Ops Officer',  desc: 'View all, sign-off F-05/F-06, approve',  color: '#1565c0',  bg: '#e3f0ff' },
  { value: 'compliance',       label: 'Compliance Officer', desc: 'View all, F-06 sign-off, NGX reports',   color: '#6d28d9',  bg: '#f5f3ff' },
  { value: 'internal_control', label: 'Internal Control',   desc: 'Read-only, request documents',           color: '#374151',  bg: '#f3f4f6' },
]

const inp = {
  width: '100%', padding: '9px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 7,
  fontSize: 13, color: NAV, outline: 'none', fontFamily: "'IBM Plex Sans', sans-serif",
  boxSizing: 'border-box',
}

export default function UsersPage({ user }) {
  const [profiles, setProfiles] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [myRole,   setMyRole]   = useState(null)

  const [form, setForm] = useState({
    email: '', full_name: '', job_title: '', role: 'operations', temp_password: '',
  })

  useEffect(() => {
    loadProfiles()
    // Check own role
    supabase.from('user_profiles').select('role').eq('id', user.id).single()
      .then(({ data }) => setMyRole(data?.role))
  }, [])

  async function loadProfiles() {
    setLoading(true)
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, role, job_title, is_active, created_at')
      .order('created_at', { ascending: true })
    setProfiles(data || [])
    setLoading(false)
  }

  async function createUser() {
    if (!form.email || !form.full_name || !form.role || !form.temp_password) {
      setError('All fields are required.'); return
    }
    if (form.temp_password.length < 8) {
      setError('Password must be at least 8 characters.'); return
    }
    setSaving(true); setError(''); setSuccess('')

    // Create auth user via Supabase Admin API (uses service role — only works server-side)
    // Since we don't have a server-side function, use the admin signUp approach
    // In production this should be a Supabase Edge Function — for now use standard signUp
    const { data: authData, error: authErr } = await supabase.auth.admin
      ? // If admin API available
        await supabase.auth.admin.createUser({
          email: form.email.trim().toLowerCase(),
          password: form.temp_password,
          email_confirm: true,
          user_metadata: { full_name: form.full_name, role: form.role },
        })
      : { data: null, error: { message: 'Admin API not available from client' } }

    if (authErr || !authData?.user) {
      // Fallback: instruct user to create via Supabase dashboard
      setError(`Cannot create auth user from browser. Please create the user in Supabase Dashboard → Authentication → Users → Invite, then come back and their profile will auto-insert here.`)
      setSaving(false); return
    }

    // Insert profile
    const { error: profileErr } = await supabase.from('user_profiles').insert({
      id:         authData.user.id,
      full_name:  form.full_name,
      role:       form.role,
      job_title:  form.job_title || null,
      is_active:  true,
    })

    if (profileErr) { setError('User created but profile failed: ' + profileErr.message) }
    else {
      setSuccess(`${form.full_name} created successfully. They can now sign in with their email and password.`)
      setForm({ email: '', full_name: '', job_title: '', role: 'operations', temp_password: '' })
      setShowForm(false)
      loadProfiles()
    }
    setSaving(false)
  }

  async function toggleActive(profile) {
    await supabase.from('user_profiles').update({ is_active: !profile.is_active }).eq('id', profile.id)
    loadProfiles()
  }

  async function changeRole(id, newRole) {
    await supabase.from('user_profiles').update({ role: newRole }).eq('id', id)
    loadProfiles()
  }

  if (myRole && myRole !== 'admin') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: NAV }}>Admin access required</div>
      </div>
    )
  }

  const roleCfg = (role) => ROLES.find(r => r.value === role) || ROLES[0]

  return (
    <div style={{ padding: 40 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>Administration</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: NAV, marginBottom: 4 }}>User Management</div>
        <div style={{ fontSize: 14, color: '#5a6a82' }}>Manage portal access for all Transworld Compliance Operations users.</div>
      </div>

      {/* Role reference */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 32 }}>
        {ROLES.map(r => (
          <div key={r.value} style={{ background: r.bg, border: `1.5px solid ${r.color}22`, borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: r.color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{r.label}</div>
            <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: NAV }}>
            {loading ? 'Loading…' : `${profiles.length} user${profiles.length !== 1 ? 's' : ''}`}
          </div>
          <button onClick={() => { setShowForm(v => !v); setError(''); setSuccess('') }}
            style={{ background: GOLD, color: NAV, border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {showForm ? '✕ Cancel' : '+ Add User'}
          </button>
        </div>

        {/* Add user form */}
        {showForm && (
          <div style={{ padding: '20px 24px', background: '#fef9ec', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: NAV, marginBottom: 16 }}>New User</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lblStyle}>Full Name *</label>
                <input style={inp} placeholder="e.g. Florence Ashofor" value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label style={lblStyle}>Email Address *</label>
                <input style={inp} type="email" placeholder="florence@transworldltd.com.ng" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={lblStyle}>Job Title</label>
                <input style={inp} placeholder="e.g. Head of Operations" value={form.job_title}
                  onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
              </div>
              <div>
                <label style={lblStyle}>Role *</label>
                <select style={inp} value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
                </select>
              </div>
              <div>
                <label style={lblStyle}>Temporary Password * (min 8 chars)</label>
                <input style={inp} type="password" placeholder="They should change this on first login"
                  value={form.temp_password}
                  onChange={e => setForm(f => ({ ...f, temp_password: e.target.value }))} />
              </div>
            </div>
            {error   && <div style={{ background: RED_BG, border: `1px solid ${RED}`, color: RED, borderRadius: 7, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>{error}</div>}
            {success && <div style={{ background: GREEN_BG, border: `1px solid #a5d6a7`, color: GREEN, borderRadius: 7, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>{success}</div>}
            <button onClick={createUser} disabled={saving}
              style={{ background: saving ? '#aaa' : NAV, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        )}

        {success && !showForm && (
          <div style={{ padding: '10px 24px', background: GREEN_BG, borderBottom: `1px solid #a5d6a7`, color: GREEN, fontSize: 13 }}>✅ {success}</div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: NAV }}>
              {['Name', 'Email', 'Role', 'Job Title', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', color: '#fff', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profiles.map((p, i) => {
              const rc = roleCfg(p.role)
              const isMe = p.id === user.id
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? '#fff' : SURFACE }}>
                  <td style={tdS}>
                    <div style={{ fontWeight: 600, color: NAV }}>{p.full_name} {isMe && <span style={{ fontSize: 10, color: GOLD, fontWeight: 700 }}>(you)</span>}</div>
                  </td>
                  <td style={{ ...tdS, fontFamily: 'monospace', fontSize: 12 }}>—</td>
                  <td style={tdS}>
                    <span style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.color}33`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                      {rc.label}
                    </span>
                  </td>
                  <td style={{ ...tdS, color: '#5a6a82', fontSize: 12 }}>{p.job_title || '—'}</td>
                  <td style={tdS}>
                    <span style={{ background: p.is_active ? GREEN_BG : '#f3f4f6', color: p.is_active ? GREEN : '#6b7280', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={tdS}>
                    {!isMe && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select value={p.role} onChange={e => changeRole(p.id, e.target.value)}
                          style={{ border: `1px solid ${BORDER}`, borderRadius: 5, padding: '3px 6px', fontSize: 11, color: NAV, background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <button onClick={() => toggleActive(p)}
                          style={{ background: p.is_active ? '#fdecea' : GREEN_BG, color: p.is_active ? RED : GREEN, border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                          {p.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!loading && profiles.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No user profiles yet. Run the migration SQL and create users in Supabase, then profiles will appear here.
          </div>
        )}
      </div>

      {/* Instructions panel */}
      <div style={{ background: '#f0f4ff', border: '1.5px solid #c7d2fe', borderRadius: 10, padding: '18px 22px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#1e40af', marginBottom: 10 }}>📋 How to set up new users in Supabase</div>
        <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
          <strong>Step 1</strong> — In Supabase Dashboard: <em>Authentication → Users → Invite user</em> — enter their email and a temporary password.<br />
          <strong>Step 2</strong> — Run this SQL to create their profile (replace values accordingly):<br />
          <code style={{ display: 'block', background: '#fff', border: '1px solid #c7d2fe', borderRadius: 5, padding: '8px 12px', marginTop: 8, marginBottom: 8, fontSize: 11, fontFamily: 'monospace', lineHeight: 1.8 }}>
            INSERT INTO user_profiles (id, full_name, role, job_title)<br />
            VALUES (<br />
            &nbsp;&nbsp;'&lt;paste-user-id-from-supabase-auth&gt;',<br />
            &nbsp;&nbsp;'Full Name Here',<br />
            &nbsp;&nbsp;'operations',  -- or: admin, coo, compliance, internal_control<br />
            &nbsp;&nbsp;'Job Title Here'<br />
            );
          </code>
          <strong>Step 3</strong> — Share their email + temporary password. They can use "Forgot password?" on the login page to set their own.
        </div>
      </div>
    </div>
  )
}

const tdS    = { padding: '10px 16px', fontSize: 13, verticalAlign: 'middle' }
const lblStyle = { display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6b7280', marginBottom: 4 }
