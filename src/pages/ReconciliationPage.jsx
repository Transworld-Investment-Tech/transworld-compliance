import ReconciliationUpload from '../components/ReconciliationUpload'

// Extract a display name from the Supabase user object.
// Supabase magic link users often have no display name set,
// so we derive it from the email prefix as a clean fallback.
function displayName(user) {
  if (!user) return 'Unknown'
  // Check metadata fields set by Supabase or user profile
  const meta = user.user_metadata || {}
  if (meta.full_name) return meta.full_name
  if (meta.name)      return meta.name
  // Derive from email: "florence.ashofor@transworldltd.com.ng" → "Florence Ashofor"
  const email = user.email || ''
  const prefix = email.split('@')[0] // "florence.ashofor"
  return prefix
    .split(/[._-]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export default function ReconciliationPage({ user }) {
  return <ReconciliationUpload currentUser={displayName(user)} />
}
