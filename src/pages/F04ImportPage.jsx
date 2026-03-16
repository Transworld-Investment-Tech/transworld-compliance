import F04PreJobImport from '../components/F04PreJobImport'

function displayName(user) {
  if (!user) return 'Unknown'
  const meta = user.user_metadata || {}
  if (meta.full_name) return meta.full_name
  if (meta.name)      return meta.name
  const email = user.email || ''
  const prefix = email.split('@')[0]
  return prefix
    .split(/[._-]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export default function F04ImportPage({ user }) {
  return <F04PreJobImport currentUser={displayName(user)} />
}
