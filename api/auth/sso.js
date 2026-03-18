// SSO authentication for Transworld Workspace integration
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const ssoToken = req.query.sso_token || (req.body && req.body.sso_token)

  if (!ssoToken) {
    return res.status(400).json({ error: 'Missing SSO token' })
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
    // Step 1: Verify token with workspace
    const verifyRes = await fetch(workspaceSsoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: ssoToken }),
    })

    if (!verifyRes.ok) {
      const text = await verifyRes.text()
      return res.status(401).json({ error: 'Token verify failed', status: verifyRes.status, body: text })
    }

    const verifyData = await verifyRes.json()
    const email = verifyData.email
    if (!email) {
      return res.status(400).json({ error: 'No email in verify response', data: verifyData })
    }

    // Step 2: Supabase admin client
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Step 3: Check if user exists
    const { data: users, error: listErr } = await admin.auth.admin.listUsers()
    if (listErr) {
      return res.status(500).json({ error: 'listUsers failed', detail: listErr.message })
    }
    let user = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    // Step 4: Auto-create if not found
    if (!user) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: email.toLowerCase(),
        email_confirm: true,
      })
      if (createErr) {
        return res.status(500).json({ error: 'createUser failed', detail: createErr.message })
      }
      user = created.user
    }

    // Step 5: Generate magic link
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
    })

    if (linkErr) {
      return res.status(500).json({ error: 'generateLink failed', detail: linkErr.message })
    }

    if (!linkData?.properties?.hashed_token) {
      return res.status(500).json({ error: 'No hashed_token in link data', data: JSON.stringify(linkData) })
    }

    // Step 6: Redirect to Supabase verify
    const confirmUrl = new URL(`${supabaseUrl}/auth/v1/verify`)
    confirmUrl.searchParams.set('token', linkData.properties.hashed_token)
    confirmUrl.searchParams.set('type', 'magiclink')
    confirmUrl.searchParams.set('redirect_to', 'https://transworld-compliance.vercel.app/dashboard')

    return res.status(200).json({ 
      debug: true,
      message: 'SSO flow completed — redirect URL below',
      redirect_url: confirmUrl.toString(),
      email,
      user_id: user.id,
    })
  } catch (err) {
    return res.status(500).json({ error: 'SSO exception', detail: err.message, stack: err.stack })
  }
}
