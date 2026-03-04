import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY

let app = null
let _auth = null
let _db = null

if (apiKey) {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }

  try {
    app = initializeApp(firebaseConfig)
    _auth = getAuth(app)
    _db = getFirestore(app)
  } catch (err) {
    console.warn('Failed to initialize Firebase:', err)
    app = null
    _auth = null
    _db = null
  }
} else {
  console.warn('VITE_FIREBASE_API_KEY not set - Firebase not configured')
}

export const auth = _auth
export const db = _db