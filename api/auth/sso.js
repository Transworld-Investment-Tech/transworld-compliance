import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const ssoToken = req.query.sso_token || (req.body && req.body.sso_token)

  if (!ssoToken) {
    return res.redirect('/login?error=missing_token')
  }

  const workspaceSsoUrl = process.env.WORKSPACE_SSO_URL
  const supabaseUrl     = process.env.VITE_SUPABASE_URL
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!workspaceSsoUrl || !supabaseUrl || !serviceRoleKey) {
    const missing = [
      !workspaceSsoUrl && 'WORKSPACE_SSO_URL',
      !supabaseUrl && 'VITE_SUPABASE_URL',
      !serviceRoleKey && 'SUPABASE_SERVICE_ROLE_KEY',
    ].filter(Boolean).join(', ')
    return res.status(500).json({ error: `Missing env vars: ${missing}` })
  }

  try {
    const verifyRes = await fetch(workspaceSsoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ssoToken }),
    })

    if (!verifyRes.ok) {
      return res.redirect('/login?error=sso_failed')
    }

    const { email } = await verifyRes.json()
    if (!email) {
      return res.redirect('/login?error=sso_failed')
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: users } = await admin.auth.admin.listUsers()
    let user = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: email.toLowerCase(),
        email_confirm: true,
      })
      if (createErr) {
        return res.redirect('/login?error=sso_failed')
      }
      user = created.user
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
    })

    if (linkErr || !linkData?.properties?.hashed_token) {
      return res.redirect('/login?error=sso_failed')
    }

    const confirmUrl = new URL(`${supabaseUrl}/auth/v1/verify`)
    confirmUrl.searchParams.set('token', linkData.properties.hashed_token)
    confirmUrl.searchParams.set('type', 'magiclink')
    confirmUrl.searchParams.set('redirect_to', 'https://transworld-compliance.vercel.app/dashboard')

    return res.redirect(confirmUrl.toString())
  } catch (err) {
    console.error('SSO error:', err)
    return res.redirect('/login?error=sso_failed')
  }
}
