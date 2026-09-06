import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl     = process.env.VITE_SUPABASE_URL
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured in Vercel environment variables.' })
  }

  // Admin client — uses service role, bypasses RLS
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // ── Authorisation gate ────────────────────────────────────────────────────
  // Every action requires a valid Supabase session token belonging to an
  // ACTIVE ADMIN. The portal sends it as an Authorization: Bearer header.
  // Without this gate, anyone who discovers the URL could create admin
  // accounts or reset passwords.
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Not authorised. Please sign in again.' })
  }

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Session invalid or expired. Please sign in again.' })
  }

  const { data: callerProfile } = await admin
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', userData.user.id)
    .single()

  if (!callerProfile || callerProfile.role !== 'admin' || callerProfile.is_active === false) {
    return res.status(403).json({ error: 'Admin access required.' })
  }

  const { action, payload } = req.body

  try {
    // ── CREATE USER ───────────────────────────────────────────────────────────
    if (action === 'create') {
      const { email, password, full_name, job_title, role } = payload

      // 1. Create auth user
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email:          email.trim().toLowerCase(),
        password:       password,
        email_confirm:  true,  // skip email verification
        user_metadata:  { full_name, role },
      })

      if (authErr) return res.status(400).json({ error: authErr.message })

      // 2. Insert profile
      const { error: profileErr } = await admin
        .from('user_profiles')
        .insert({
          id:        authData.user.id,
          full_name: full_name.trim(),
          role,
          job_title: job_title?.trim() || null,
          is_active: true,
        })

      if (profileErr) {
        // Roll back auth user if profile fails
        await admin.auth.admin.deleteUser(authData.user.id)
        return res.status(500).json({ error: 'Profile creation failed: ' + profileErr.message })
      }

      return res.status(200).json({ success: true, userId: authData.user.id })
    }

    // ── LIST USERS ────────────────────────────────────────────────────────────
    if (action === 'list') {
      const { data: profiles } = await admin
        .from('user_profiles')
        .select('id, full_name, role, job_title, is_active, created_at')
        .order('created_at', { ascending: true })

      // Get emails from auth
      const { data: authList } = await admin.auth.admin.listUsers()
      const emailMap = {}
      if (authList?.users) {
        authList.users.forEach(u => { emailMap[u.id] = u.email })
      }

      const users = (profiles || []).map(p => ({
        ...p,
        email: emailMap[p.id] || '—',
      }))

      return res.status(200).json({ users })
    }

    // ── UPDATE ROLE ───────────────────────────────────────────────────────────
    if (action === 'update_role') {
      const { id, role } = payload
      const { error } = await admin.from('user_profiles').update({ role }).eq('id', id)
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    // ── TOGGLE ACTIVE ─────────────────────────────────────────────────────────
    if (action === 'toggle_active') {
      const { id, is_active } = payload
      const { error } = await admin.from('user_profiles').update({ is_active }).eq('id', id)
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    // ── RESET PASSWORD ────────────────────────────────────────────────────────
    if (action === 'reset_password') {
      const { id, new_password } = payload
      const { error } = await admin.auth.admin.updateUserById(id, { password: new_password })
      if (error) return res.status(400).json({ error: error.message })
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Unknown action' })

  } catch (err) {
    console.error('admin-users error:', err)
    return res.status(500).json({ error: err.message })
  }
}
