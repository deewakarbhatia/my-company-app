import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../firebase'

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationErrors = {}

    if (!email.trim()) {
      validationErrors.email = 'Email is required.'
    } else if (!validateEmail(email)) {
      validationErrors.email = 'Enter a valid email address.'
    }

    if (!password) {
      validationErrors.password = 'Password is required.'
    }

    setErrors(validationErrors)

    if (Object.keys(validationErrors).length === 0) {
      setLoading(true)
      try {
        await signInWithEmailAndPassword(auth, email, password)
        navigate('/dashboard')
      } catch (error) {
        setLoading(false)
        console.error('Login failed:', error)
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          setErrors({ general: 'Invalid email or password.' })
        } else if (error.code === 'auth/unauthorized-domain') {
          setErrors({ general: 'This app is not authorized for this domain. Add localhost to Firebase authorized domains.' })
        } else {
          setErrors({ general: `${error.message || 'An error occurred. Please try again.'} (${error.code || 'unknown'})` })
        }
      }
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
      navigate('/dashboard')
    } catch (error) {
      setLoading(false)
      console.error('Google sign-in failed:', error)
      if (error.code === 'auth/operation-not-allowed') {
        setErrors({ general: 'Google sign-in is not enabled in Firebase. Enable Google under Authentication → Sign-in method.' })
      } else if (error.code === 'auth/unauthorized-domain') {
        setErrors({ general: 'This app is not authorized for this domain. Add localhost to Firebase authorized domains.' })
      } else {
        setErrors({ general: `${error.message || 'Google sign-in failed. Please try again.'} (${error.code || 'unknown'})` })
      }
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20 sm:p-10">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Login</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">Sign in to your account</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Access the management dashboard and company systems.</p>
          <div className="mt-6 rounded-3xl bg-slate-50 dark:bg-slate-950/80 p-5 text-sm text-slate-700 dark:text-slate-300">
            <p className="font-medium text-slate-900 dark:text-slate-100">Quick actions</p>
            <p className="mt-3 leading-relaxed">
              Need an account? <Link to="/signup" className="font-semibold text-sky-400 hover:text-sky-300">Create one here</Link>.
            </p>
            <p className="mt-2 leading-relaxed">
              Forgot your password? <Link to="#" className="font-semibold text-sky-400 hover:text-sky-300">Reset it now</Link>.
            </p>
          </div>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {errors.general ? (
            <div className="rounded-3xl border border-rose-600/20 bg-rose-500/10 p-4 text-rose-300">
              {errors.general}
            </div>
          ) : null}
          <label className="block">
            <span className="text-sm text-slate-600 dark:text-slate-400">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="team@company.com"
              className="mt-2 w-full rounded-3xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            />
            {errors.email ? <p className="mt-2 text-sm text-rose-400">{errors.email}</p> : null}
          </label>
          <label className="block">
            <span className="text-sm text-slate-600 dark:text-slate-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-2 w-full rounded-3xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-slate-900 dark:text-slate-100 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
            />
            {errors.password ? <p className="mt-2 text-sm text-rose-400">{errors.password}</p> : null}
          </label>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-3 text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sky-500 focus:ring-sky-400"
              />
              Remember me
            </label>
            <a href="#" className="text-sm font-semibold text-sky-400 hover:text-sky-300">
              Forgot password?
            </a>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-3xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full rounded-3xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 transition hover:bg-slate-100 dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </section>
  )
}

export default Login
