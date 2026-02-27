import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './lib/firebase'
import Login from './pages/login'

function App() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        const token = await u.getIdTokenResult()
        setRole(token.claims.role)
        setUser(u)
      } else {
        setUser(null)
        setRole(null)
      }
      setLoading(false)
    })
  }, [])

  if (loading) return <div>Loading...</div>
  if (!user) return <Login />

  return (
    <div style={{ padding: 24 }}>
      <h2>Accelera Battery System</h2>
      <p>Logged in as: {user.email}</p>
      <p>Role: {role}</p>
      <button onClick={() => auth.signOut()}>Sign Out</button>
    </div>
  )
}

export default App