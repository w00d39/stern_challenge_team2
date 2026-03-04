import { auth } from '../lib/firebase'

export default function Unauthorized({ user }) {
  return (
    <div className="unauthorized-container">
      <h1>Accelera</h1>
      <p style={{ color: '#888', marginBottom: 24 }}>
        Cummins Facility Decarbonization Platform
      </p>

      <div className="card" style={{ textAlign: 'left' }}>
        <h3 style={{ marginBottom: 12 }}>No Role Assigned</h3>
        <p style={{ marginBottom: 12 }}>
          Signed in as <strong>{user.email}</strong>
        </p>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
          Your account does not have a role assigned yet. Contact your
          administrator to be assigned one of: Facility Engineer, Sustainability
          Director, or Auditor.
        </p>
        <button className="btn btn-primary" onClick={() => auth.signOut()}>
          Sign Out
        </button>
      </div>
    </div>
  )
}
