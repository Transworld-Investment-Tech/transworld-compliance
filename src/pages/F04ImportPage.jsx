import F04PreJobImport from '../components/F04PreJobImport'

export default function F04ImportPage({ user }) {
  return <F04PreJobImport currentUser={user?.email} />
}
