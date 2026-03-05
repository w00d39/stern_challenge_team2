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

const CVD_MODES = [
  { id: 'default', label: 'Default', desc: 'Full color palette' },
  { id: 'deuteranopia', label: 'Deuteranopia', desc: 'Red-green (most common)' },
  { id: 'protanopia', label: 'Protanopia', desc: 'Red-blind' },
  { id: 'tritanopia', label: 'Tritanopia', desc: 'Blue-yellow blind' },
  { id: 'highContrast', label: 'High Contrast', desc: 'Maximum differentiation' },
]

const GIRARD_KEYS = ['--c-red', '--c-mustard', '--c-teal', '--c-olive', '--c-red-deep', '--c-amber', '--c-teal-light', '--c-concrete']

function App() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cvdMode, setCvdMode] = useState(() => localStorage.getItem('cvd-mode') || 'default')
  const [cvdOpen, setCvdOpen] = useState(false)

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

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('cvd-deuteranopia', 'cvd-protanopia', 'cvd-tritanopia', 'cvd-highContrast')
    if (cvdMode !== 'default') {
      root.classList.add(`cvd-${cvdMode}`)
    }
    localStorage.setItem('cvd-mode', cvdMode)
  }, [cvdMode])

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
          <strong>Destination Zero Dashboard</strong>
          <span className="nav-subtitle">Facility Decarbonization</span>
        </div>
        <div className="nav-right">
          <span className="nav-role">{ROLE_LABELS[role]}</span>
          <span className="nav-email">{user.email}</span>

          <div className="cvd-toggle">
            <button
              className="cvd-toggle-btn"
              onClick={() => setCvdOpen(!cvdOpen)}
              aria-haspopup="listbox"
              aria-expanded={cvdOpen}
              title="Color vision mode"
            >
              <span aria-hidden="true">◐</span>
              {CVD_MODES.find((m) => m.id === cvdMode)?.label}
            </button>
            {cvdOpen && (
              <div className="cvd-dropdown" role="listbox">
                {CVD_MODES.map((m) => (
                  <button
                    key={m.id}
                    className={`cvd-option ${cvdMode === m.id ? 'active' : ''}`}
                    role="option"
                    aria-selected={cvdMode === m.id}
                    onClick={() => {
                      setCvdMode(m.id)
                      setCvdOpen(false)
                    }}
                  >
                    {m.label}
                    <span className="cvd-option-desc">{m.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="btn-nav" onClick={() => auth.signOut()}>
            Sign Out
          </button>
        </div>
      </nav>

      <div className="girard-strip">
        {GIRARD_KEYS.map((key) => (
          <div key={key} style={{ background: `var(${key})` }} />
        ))}
      </div>

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
