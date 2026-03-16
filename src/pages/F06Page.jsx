import F06ErrorTradeLog from '../components/F06ErrorTradeLog'

function displayName(user) {
  if (!user) return 'Unknown'
  const meta = user.user_metadata || {}
  if (meta.full_name) return meta.full_name
  if (meta.name)      return meta.name
  const prefix = (user.email || '').split('@')[0]
  return prefix.split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

export default function F06Page({ user }) {
  return <F06ErrorTradeLog currentUser={displayName(user)} />
}
