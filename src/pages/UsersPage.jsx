import { useState, useEffect } from 'react'

const NAV      = '#0d1f3c'
const GOLD     = '#c9a84c'
const GREEN    = '#1a7a4a'
const GREEN_BG = '#e8f5e9'
const RED      = '#c0392b'
const RED_BG   = '#fdecea'
const AMBER    = '#b45309'
const AMBER_BG = '#fff8e1'
const BLUE     = '#1565c0'
const BORDER   = '#dde1ea'
const SURFACE  = '#f7f8fa'

const ROLES = [
  { value: 'admin',            label: 'Admin',              color: '#c9a84c', bg: '#fef9ec', desc: 'Full access + user management' },
  { value: 'operations',       label: 'Operations',         color: GREEN,     bg: GREEN_BG,  desc: 'F-04, F-05, F-06 entry & detect' },
  { value: 'coo',              label: 'Chief Ops Officer',  color: BLUE,      bg: '#e3f0ff', desc: 'View all, sign-off, approve' },
  { value: 'compliance',       label: 'Compliance Officer', color: '#6d28d9', bg: '#f5f3ff', desc: 'View all, F-06 sign-off, NGX reports' },
  { value: 'internal_control', label: 'Internal Control',   color: '#374151', bg: '#f3f4f6', desc: 'Read-only, document requests' },
]
const roleCfg = v => ROLES.find(r => r.value === v) || ROLES[0]

async function api(action, payload = {}) {
  const res = await fetch('/api/admin-users', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, payload }),
  })
  return res.json()
}

const inp = {
  width: '100%', padding: '9px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 7,
  fontSize: 13, color: NAV, outline: 'none', fontFamily: "'IBM Plex Sans', sans-serif",
  boxSizing: 'border-box', background: '#fff',
}
const lbl = { display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#6b7280', marginBottom: 4 }

const EMPTY_FORM = { full_name: '', email: '', job_title: '', role: 'operations', password: '', confirmPassword: '' }

export default function UsersPage({ user }) {
  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [toast,      setToast]      = useState(null)  // { msg, type }
  const [resetUser,  setResetUser]  = useState(null)  // user to reset pw for
  const [newPwd,     setNewPwd]     = useState('')
  const [showPwd,    setShowPwd]    = useState(false)

  useEffect(() => { loadUsers() }, [])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadUsers() {
    setLoading(true)
    const data = await api('list')
    setUsers(data.users || [])
    setLoading(false)
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleCreate() {
    setFormError('')
    if (!form.full_name.trim())  return setFormError('Full name is required.')
    if (!form.email.trim())      return setFormError('Email address is required.')
    if (!form.role)              return setFormError('Role is required.')
    if (!form.password)          return setFormError('Password is required.')
    if (form.password.length < 8) return setFormError('Password must be at least 8 characters.')
    if (form.password !== form.confirmPassword) return setFormError('Passwords do not match.')

    setSaving(true)
    const result = await api('create', {
      email:     form.email.trim().toLowerCase(),
      password:  form.password,
      full_name: form.full_name.trim(),
      job_title: form.job_title.trim(),
      role:      form.role,
    })
    setSaving(false)

    if (result.error) { setFormError(result.error); return }

    showToast(`${form.full_name} has been added successfully.`)
    setForm(EMPTY_FORM)
    setShowForm(false)
    loadUsers()
  }

  async function handleRoleChange(id, newRole) {
    const result = await api('update_role', { id, role: newRole })
    if (result.error) showToast(result.error, 'error')
    else { showToast('Role updated.'); loadUsers() }
  }

  async function handleToggleActive(u) {
    const result = await api('toggle_active', { id: u.id, is_active: !u.is_active })
    if (result.error) showToast(result.error, 'error')
    else { showToast(u.is_active ? `${u.full_name} deactivated.` : `${u.full_name} reactivated.`); loadUsers() }
  }

  async function handleResetPassword() {
    if (!newPwd || newPwd.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return }
    const result = await api('reset_password', { id: resetUser.id, new_password: newPwd })
    if (result.error) showToast(result.error, 'error')
    else {
      showToast(`Password reset for ${resetUser.full_name}.`)
      setResetUser(null); setNewPwd('')
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 960 }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          background: toast.type === 'error' ? RED : GREEN,
          color: '#fff', borderRadius: 8, padding: '12px 20px',
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          maxWidth: 360,
        }}>
          {toast.type === 'error' ? '✗ ' : '✓ '}{toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: GOLD, marginBottom: 6 }}>Administration</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: NAV, marginBottom: 4 }}>User Management</div>
        <div style={{ fontSize: 14, color: '#5a6a82' }}>Add and manage portal access for Transworld Compliance Operations staff.</div>
      </div>

      {/* User table card */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>

        {/* Table header bar */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: NAV }}>
            {loading ? '…' : `${users.length} user${users.length !== 1 ? 's' : ''}`}
          </div>
          <button onClick={() => { setShowForm(v => !v); setFormError('') }}
            style={{ background: showForm ? '#f3f4f6' : GOLD, color: showForm ? '#374151' : NAV, border: `1px solid ${showForm ? BORDER : GOLD}`, borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {showForm ? '✕ Cancel' : '+ Add User'}
          </button>
        </div>

        {/* Add user form */}
        {showForm && (
          <div style={{ padding: '24px', background: '#fef9ec', borderBottom: `1px solid #f0e0a0` }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: NAV, marginBottom: 18 }}>New User</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Full Name *</label>
                <input style={inp} placeholder="e.g. Florence Ashofor"
                  value={form.full_name} onChange={e => setField('full_name', e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Work Email *</label>
                <input style={inp} type="email" placeholder="e.g. florence@transworldltd.com.ng"
                  value={form.email} onChange={e => setField('email', e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Job Title</label>
                <input style={inp} placeholder="e.g. Head of Operations"
                  value={form.job_title} onChange={e => setField('job_title', e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Role *</label>
                <select style={inp} value={form.role} onChange={e => setField('role', e.target.value)}>
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Initial Password * (min 8 chars)</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} style={{ ...inp, paddingRight: 40 }}
                    placeholder="They can change this later"
                    value={form.password} onChange={e => setField('password', e.target.value)} />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af', padding: 0 }}>
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div>
                <label style={lbl}>Confirm Password *</label>
                <input type={showPwd ? 'text' : 'password'} style={inp}
                  placeholder="Repeat the password"
                  value={form.confirmPassword} onChange={e => setField('confirmPassword', e.target.value)} />
              </div>
            </div>

            {formError && (
              <div style={{ background: RED_BG, border: `1px solid #fca5a5`, color: RED, borderRadius: 7, padding: '9px 14px', fontSize: 13, marginBottom: 14 }}>
                {formError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleCreate} disabled={saving}
                style={{ background: saving ? '#aaa' : NAV, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Creating user…' : 'Create User'}
              </button>
              <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError('') }}
                style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Users table */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading users…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: NAV, marginBottom: 6 }}>No users yet</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>Click "Add User" above to create the first account.</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: NAV }}>
                {['Name', 'Email', 'Role', 'Job Title', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', color: '#fff', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const rc    = roleCfg(u.role)
                const isMe  = u.id === user.id
                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${BORDER}`, background: i % 2 === 0 ? '#fff' : SURFACE }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: NAV, fontSize: 13 }}>
                        {u.full_name}
                        {isMe && <span style={{ marginLeft: 6, fontSize: 10, color: GOLD, fontWeight: 700, background: '#fef9ec', padding: '1px 6px', borderRadius: 10 }}>you</span>}
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: '#5a6a82' }}>{u.email}</td>
                    <td style={td}>
                      <span style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.color}33`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                        {rc.label}
                      </span>
                    </td>
                    <td style={{ ...td, color: '#5a6a82', fontSize: 12 }}>{u.job_title || '—'}</td>
                    <td style={td}>
                      <span style={{ background: u.is_active ? GREEN_BG : '#f3f4f6', color: u.is_active ? GREEN : '#6b7280', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {!isMe && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          {/* Role picker */}
                          <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                            style={{ border: `1px solid ${BORDER}`, borderRadius: 5, padding: '4px 6px', fontSize: 11, color: NAV, background: '#fff', fontFamily: 'inherit', cursor: 'pointer' }}>
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          {/* Reset password */}
                          <button onClick={() => { setResetUser(u); setNewPwd('') }}
                            style={{ background: AMBER_BG, color: AMBER, border: `1px solid #ffe082`, borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                            Reset PW
                          </button>
                          {/* Activate / Deactivate */}
                          <button onClick={() => handleToggleActive(u)}
                            style={{ background: u.is_active ? RED_BG : GREEN_BG, color: u.is_active ? RED : GREEN, border: 'none', borderRadius: 5, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                            {u.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Reset password modal */}
      {resetUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 400, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 4 }}>Reset Password</div>
            <div style={{ fontSize: 13, color: '#5a6a82', marginBottom: 20 }}>
              Set a new password for <strong>{resetUser.full_name}</strong>.
              They can change it themselves via "Change Password" after signing in.
            </div>
            <label style={lbl}>New Password (min 8 chars)</label>
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <input type={showPwd ? 'text' : 'password'} value={newPwd}
                onChange={e => setNewPwd(e.target.value)} autoFocus
                placeholder="Enter new password"
                style={{ ...inp, paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af', padding: 0 }}>
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleResetPassword}
                style={{ background: NAV, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Set Password
              </button>
              <button onClick={() => { setResetUser(null); setNewPwd('') }}
                style={{ background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const td = { padding: '11px 16px', fontSize: 13, verticalAlign: 'middle' }
