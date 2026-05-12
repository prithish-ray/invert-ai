const BASE = '/api'

// ── Auth token helpers ─────────────────────────────────────────────────────────
export const getToken  = () => localStorage.getItem('invert_token')
export const getUser   = () => JSON.parse(localStorage.getItem('invert_user') || 'null')
export const saveAuth  = (token, user) => {
  localStorage.setItem('invert_token', token)
  localStorage.setItem('invert_user', JSON.stringify(user))
}
export const clearAuth = () => {
  localStorage.removeItem('invert_token')
  localStorage.removeItem('invert_user')
}

// ── Core request helper — always sends Bearer token ───────────────────────────
async function req(method, path, body) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  // 204 No Content
  if (res.status === 204) return null
  return res.json()
}

// ── Auth ───────────────────────────────────────────────────────────────────────
export const register   = (name, email, password) => req('POST', '/auth/register', { name, email, password })
export const login      = (email, password)        => req('POST', '/auth/login',    { email, password })
export const loginDemo  = ()                       => req('POST', '/auth/demo')
export const getMe      = ()                       => req('GET',  '/auth/me')

// ── Decisions ─────────────────────────────────────────────────────────────────
export const createDecision       = (data)                            => req('POST',  '/decisions', data)
export const getDecision          = (id)                              => req('GET',   `/decisions/${id}`)
export const listDecisions        = ()                                => req('GET',   '/decisions')
export const skipAgent            = (id, agent)                       => req('POST',  `/decisions/${id}/skip-agent/${agent}`)
export const synthesise           = (id)                              => req('POST',  `/decisions/${id}/synthesise`)
export const updateOutcome        = (id, data)                        => req('PATCH', `/decisions/${id}/outcome`, data)
export const getAgentRuns         = (id)                              => req('GET',   `/decisions/${id}/agent-runs`)
export const converseAgent        = (id, agent, userMessage = null)   => req('POST',  `/decisions/${id}/converse/${agent}`, { user_message: userMessage })
export const getResearchQuestions = (id)                              => req('POST',  `/decisions/${id}/research-questions`)

// ── Journal ───────────────────────────────────────────────────────────────────
export const getJournal  = ()              => req('GET',    '/journal')
export const getNotes    = (id)            => req('GET',    `/journal/${id}/notes`)
export const addNote     = (id, note)      => req('POST',   `/journal/${id}/notes`, { note })
export const deleteNote  = (id, noteId)    => req('DELETE', `/journal/${id}/notes/${noteId}`)

// ── Bias ──────────────────────────────────────────────────────────────────────
export const getBiasProfile = () => req('GET', '/bias')
