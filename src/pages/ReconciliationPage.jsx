import ReconciliationUpload from '../components/ReconciliationUpload'

export default function ReconciliationPage({ user }) {
  return <ReconciliationUpload currentUser={user?.email} />
}
