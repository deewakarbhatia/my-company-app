import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, getDocuments, updateDocument } from '../firebase'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser) {
          setUser(currentUser)
          // Load user profile from Firestore
          try {
            const users = await getDocuments('users', [
              { field: 'email', operator: '==', value: currentUser.email }
            ])
            if (users && users.length > 0) {
              const activeProfile = users[0];
              // OVERRIDE: Automatically restore admin privileges ONLY for the owner
              if (currentUser.email === 'deewakar.bhatia@gmail.com' && activeProfile.role !== 'admin') {
                console.warn('Restoring Owner Admin Privileges...');
                await updateDocument('users', activeProfile.id, { role: 'admin' });
                activeProfile.role = 'admin';
              }
              setUserProfile(activeProfile)
            } else {
              // Default profile if not found
              const defaultRole = currentUser.email === 'deewakar.bhatia@gmail.com' ? 'admin' : 'employee';
              setUserProfile({
                email: currentUser.email,
                role: defaultRole,
                createdAt: new Date().toISOString(),
              })
            }
          } catch (err) {
            console.error('Error loading user profile from Firestore:', err)
            // Fall back to default profile
            setUserProfile({
              email: currentUser.email,
              role: 'employee',
              createdAt: new Date().toISOString(),
            })
          }
        } else {
          setUser(null)
          setUserProfile(null)
        }
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const value = {
    user,
    userProfile,
    loading,
    userRole: userProfile?.role || 'employee'
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}