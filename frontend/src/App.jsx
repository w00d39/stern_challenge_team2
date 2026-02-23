import { useEffect, useState } from 'react'
import { db } from './lib/firebase'
import { collection, getDocs } from 'firebase/firestore'

function App() {
  const [status, setStatus] = useState('connecting...')

  useEffect(() => {
    const test = async () => {
      try {
        await getDocs(collection(db, 'test'))
        setStatus('Firebase connected!')
      } catch (err) {
        setStatus('Error: ' + err.message)
      }
    }
    test()
  }, [])

  return (
    <div>
      <h1>Accelera Battery System</h1>
      <p>{status}</p>
    </div>
  )
}

export default App