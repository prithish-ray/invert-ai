import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createDecision, synthesise, skipAgent } from '../api'
import AgentPanel from './AgentPanel'

const AGENTS = [
  {
    key: 'price',
    letter: 'P',
    label: 'Price Signal Separator',
    color: 'forest',
    tagline: 'Is this about the business or the price?',
  },
  {
    key: 'ruin',
    letter: 'R',
    label: 'Ruin Risk Assessor',
    color: 'red',
    tagline: 'Run the pre-mortem you keep deferring.',
  },
  {
    key: 'imitation',
    letter: 'I',
    label: 'Independence Verifier',
    color: 'purple',
    tagline: 'Is this your idea, or did you borrow it?',
  },
  {
    key: 'confirmation',
    letter: 'C',
    label: 'Confirmation Challenger',
    color: 'amber',
    tagline: 'The bear case. Every time.',
  },
  {
    key: 'ego',
    letter: 'E',
    label: 'Ego & Inertia Probe',
    color: 'blue',
    tagline: 'Conviction or inertia — which is it?',
  },
]

const AGENT_COLORS = {
  forest: { bg: 'bg-forest-500', light: 'bg-forest-50', border: 'border-forest-300', text: 'text-forest-700', badge: 'bg-forest-100 text-forest-800' },
  red:    { bg: 'bg-red-600',    light: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    badge: 'bg-red-100 text-red-800' },
  purple: { bg: 'bg-purple-600', light: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
  amber:  { bg: 'bg-amber-600',  light: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-800' },
  blue:   { bg: 'bg-blue-700',   light: 'bg-blue-50',   border: 'border-blue-300',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-800' },
}

const STEPS = { FORM: 'form', GATE: 'gate' }

export default function DecisionGate() {
  const navigate = useNavigate()
  const [step, setStep]           = useState(STEPS.FORM)
  const [decision, setDecision]   = useState(null)
  const [agentResults, setAgentResults] = useState({})  // key → { response, score, skipped }
  const [error, setError]         = useState('')
  const [synthLoading, setSynthLoading] = useState(false)

  const [form, setForm] = useState({
    ticker: '',
    decision_type: 'buy',
    thesis: '',
    emotional_state: 3,
  })

  // ── Form submit ─────────────────────────────────────────────────────────────
  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const d = await createDecision(form)
      setDecision(d)
      setStep(STEPS.GATE)
    } catch (err) {
      setError(err.message)
    }
  }

  // ── Agent callbacks (called by AgentPanel when it finishes) ────────────────
  const handleAgentComplete = (agentKey, result) => {
    setAgentResults(prev => ({ ...prev, [agentKey]: result }))
  }

  const handleAgentSkip = (agentKey) => {
    setAgentResults(prev => ({ ...prev, [agentKey]: { skipped: true } }))
  }

  // ── Auto-skip Ego agent for "buy" decisions ─────────────────────────────────
  // Agent E probes holding inertia / sunk-cost — irrelevant for new buy decisions.
  useEffect(() => {
    if (step === STEPS.GATE && decision?.decision_type === 'buy' && !agentResults['ego']) {
      skipAgent(decision.id, 'ego')
        .catch(() => {})  // best-effort; panel will also show as skipped locally
      setAgentResults(prev => ({ ...prev, ego: { skipped: true, autoSkipped: true } }))
    }
  }, [step, decision])

  // ── Synthesise ──────────────────────────────────────────────────────────────
  const allAgentsDone = AGENTS.every(a => agentResults[a.key])
  const completedCount = Object.keys(agentResults).length

  const handleSynthesise = async () => {
    setSynthLoading(true)
    setError('')
    try {
      const d = await synthesise(decision.id)
      // Navigate to the persistent session URL — memo survives tab switching
      navigate(`/session/${d.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSynthLoading(false)
    }
  }

  const handleReset = () => {
    setStep(STEPS.FORM)
    setDecision(null)
    setAgentResults({})
    setError('')
    setForm({ ticker: '', decision_type: 'buy', thesis: '', emotional_state: 3 })
  }

  // ── Gate view ───────────────────────────────────────────────────────────────
  if (step === STEPS.GATE) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900">Invert Session Active</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {decision.ticker && (
                  <span className="font-medium text-gray-700">{decision.ticker} · </span>
                )}
                <span className="capitalize">{decision.decision_type}</span>
              </p>
              <p className="text-sm text-gray-600 mt-2 italic truncate">"{decision.thesis}"</p>
            </div>
            <span className="ml-4 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full flex-shrink-0">
              {completedCount}/{AGENTS.length} done
            </span>
          </div>
          <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-forest-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / AGENTS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Agent panels — each manages its own conversation */}
        {AGENTS.map((agent) => (
          <AgentPanel
            key={agent.key}
            agent={agent}
            colors={AGENT_COLORS[agent.color]}
            decisionId={decision.id}
            onComplete={(result) => handleAgentComplete(agent.key, result)}
            onSkip={() => handleAgentSkip(agent.key)}
            isGloballyDisabled={false}
            autoSkipped={agentResults[agent.key]?.autoSkipped === true}
          />
        ))}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Synthesise */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-medium text-gray-800">Generate Decision Memo</p>
              <p className="text-sm text-gray-500">
                {allAgentsDone
                  ? 'All agents complete. Ready to synthesise.'
                  : `Complete or skip the remaining ${AGENTS.length - completedCount} agent${AGENTS.length - completedCount !== 1 ? 's' : ''} first.`}
              </p>
            </div>
            <button
              onClick={handleSynthesise}
              disabled={!allAgentsDone || synthLoading}
              className="w-full sm:w-auto flex-shrink-0 px-5 py-2.5 bg-forest-500 text-white rounded-lg text-sm
                         font-semibold hover:bg-forest-600 disabled:opacity-40
                         disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {synthLoading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
              )}
              {synthLoading ? 'Synthesising…' : 'Synthesise →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form view ───────────────────────────────────────────────────────────────
  const emotionLabels = ['', 'Calm', 'Slightly uneasy', 'Anxious', 'Stressed', 'Panicked / Euphoric']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Decision</h1>
        <p className="text-gray-500 mt-1">
          Before you act, run your decision through Charlie first.
        </p>
      </div>

      <form onSubmit={handleFormSubmit} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ticker / Company</label>
            <input
              type="text"
              value={form.ticker}
              onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
              placeholder="e.g. AAPL"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-forest-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Decision type</label>
            <select
              value={form.decision_type}
              onChange={e => setForm(f => ({ ...f, decision_type: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-forest-400 bg-white"
            >
              {['buy', 'sell', 'hold', 'add', 'pass'].map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your thesis{' '}
            <span className="text-gray-400 font-normal">— what's your reasoning?</span>
          </label>
          <textarea
            value={form.thesis}
            onChange={e => setForm(f => ({ ...f, thesis: e.target.value }))}
            required
            minLength={10}
            rows={5}
            placeholder="e.g. I'm thinking of selling because the stock is up 40% and I want to lock in gains before earnings…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-forest-400 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Emotional state right now{' '}
            <span className="ml-1 font-normal text-forest-600">
              {emotionLabels[form.emotional_state]}
            </span>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Calm</span>
            <input
              type="range" min={1} max={5}
              value={form.emotional_state}
              onChange={e => setForm(f => ({ ...f, emotional_state: parseInt(e.target.value) }))}
              className="flex-1 accent-forest-500"
            />
            <span className="text-xs text-gray-400">Panicked / Euphoric</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="w-full py-3 bg-forest-500 text-white rounded-lg font-semibold
                     hover:bg-forest-600 transition-colors"
        >
          Run it through Charlie →
        </button>
      </form>

      {/* PRICE legend */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          The five agents — each will challenge you until satisfied
        </p>
        <div className="space-y-2">
          {AGENTS.map(a => (
            <div key={a.key} className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center
                               text-white text-xs font-bold ${AGENT_COLORS[a.color].bg}`}>
                {a.letter}
              </span>
              <div>
                <span className="text-sm font-medium text-gray-800">{a.label}</span>
                <span className="text-xs text-gray-400 ml-2">{a.tagline}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
          Each agent may ask up to 2 follow-up questions before delivering its final judgment.
          You can run agents in any order, or skip any you choose.
        </p>
      </div>
    </div>
  )
}
