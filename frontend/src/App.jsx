import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './lib/firebase'
import Login from './pages/login'
import Unauthorized from './pages/Unauthorized'
import FacilityEngineer from './pages/FacilityEngineer'
import SustainabilityDirector from './pages/SustainabilityDirector'
import Auditor from './pages/Auditor'
import './App.css'

const ROLE_LABELS = {
  facility_engineer: 'Facility Engineer',
  sustainability_director: 'Sustainability Director',
  auditor: 'Auditor',
}

const VALID_ROLES = Object.keys(ROLE_LABELS)

function App() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }

    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const token = await u.getIdTokenResult()
        setRole(token.claims.role || null)
        setUser(u)
      } else {
        setUser(null)
        setRole(null)
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) return <Login />

  if (!role || !VALID_ROLES.includes(role)) {
    return <Unauthorized user={user} />
  }

  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="nav-brand">
          <strong>Accelera</strong>
          <span className="nav-subtitle">Facility Decarbonization</span>
        </div>
        <div className="nav-right">
          <span className="nav-role">{ROLE_LABELS[role]}</span>
          <span className="nav-email">{user.email}</span>
          <button className="btn-nav" onClick={() => auth.signOut()}>
            Sign Out
          </button>
        </div>
      </nav>

      <main className="main-content">
        {role === 'facility_engineer' && <FacilityEngineer user={user} />}
        {role === 'sustainability_director' && (
          <SustainabilityDirector user={user} />
        )}
        {role === 'auditor' && <Auditor user={user} />}
      </main>
    </div>
  )
}

export default App
