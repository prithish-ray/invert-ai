import { useState } from 'react'
import { login, register, loginDemo, saveAuth } from '../api'

export default function AuthPage({ onAuth }) {
  const [tab, setTab]           = useState('login')   // 'login' | 'register'
  const [form, setForm]         = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (tab === 'register') {
      if (form.password !== form.confirm) {
        setError('Passwords do not match.')
        return
      }
      if (form.password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
      }
    }

    setLoading(true)
    try {
      const data = tab === 'login'
        ? await login(form.email, form.password)
        : await register(form.name, form.email, form.password)

      saveAuth(data.token, { id: data.user_id, name: data.name, email: data.email })
      onAuth({ id: data.user_id, name: data.name, email: data.email })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDemo = async () => {
    setError('')
    setDemoLoading(true)
    try {
      const data = await loginDemo()
      saveAuth(data.token, { id: data.user_id, name: data.name, email: data.email })
      onAuth({ id: data.user_id, name: data.name, email: data.email })
    } catch (err) {
      setError(err.message)
    } finally {
      setDemoLoading(false)
    }
  }

  const inputClass = `w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
    focus:outline-none focus:ring-2 focus:ring-forest-400`

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      {/* Brand */}
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Invert</h1>
        <p className="text-gray-500 mt-2 text-sm">
          Before you act, run your decision through Charlie first.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-full max-w-sm p-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
          {[['login', 'Sign In'], ['register', 'Create Account']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setError('') }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                required
                placeholder="Charlie Munger"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              required
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              required
              placeholder={tab === 'register' ? 'At least 8 characters' : ''}
              className={inputClass}
            />
          </div>

          {tab === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                value={form.confirm}
                onChange={set('confirm')}
                required
                className={inputClass}
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || demoLoading}
            className="w-full py-2.5 bg-forest-500 text-white rounded-lg font-semibold text-sm
                       hover:bg-forest-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            )}
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Demo account divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <button
          onClick={handleDemo}
          disabled={loading || demoLoading}
          className="w-full py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium
                     hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {demoLoading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          )}
          {demoLoading ? 'Loading…' : 'Try Demo Account'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          Shared account — don't enter real positions
        </p>
      </div>

      <p className="text-xs text-gray-400 mt-5 text-center">
        Your journal and bias profile are private to your account.
      </p>
    </div>
  )
}
