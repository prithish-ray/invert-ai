import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getJournal, getNotes, addNote, deleteNote, updateOutcome } from '../api'

const REC_COLORS = {
  proceed:    'bg-forest-100 text-forest-800',
  pause:      'bg-amber-100 text-amber-800',
  reconsider: 'bg-red-100 text-red-800',
}

const OUTCOME_COLORS = {
  proceeded: 'text-forest-600',
  paused:    'text-amber-600',
  reversed:  'text-red-600',
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DecisionCard({ decision, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes]       = useState([])
  const [noteText, setNoteText] = useState('')
  const [showOutcome, setShowOutcome] = useState(false)
  const [outcomeForm, setOutcomeForm] = useState({
    outcome: decision.outcome || '',
    outcome_rating: decision.outcome_rating || 3,
    outcome_notes: decision.outcome_notes || '',
  })
  const [outcomeSaved, setOutcomeSaved] = useState(!!decision.outcome)

  useEffect(() => {
    if (expanded) {
      getNotes(decision.id).then(setNotes).catch(() => {})
    }
  }, [expanded, decision.id])

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    const note = await addNote(decision.id, noteText.trim())
    setNotes(n => [...n, note])
    setNoteText('')
  }

  const handleDeleteNote = async (noteId) => {
    await deleteNote(decision.id, noteId)
    setNotes(n => n.filter(x => x.id !== noteId))
  }

  const handleSaveOutcome = async () => {
    if (!outcomeForm.outcome) return
    await updateOutcome(decision.id, outcomeForm)
    setOutcomeSaved(true)
    setShowOutcome(false)
    onRefresh()
  }

  const memo = decision.synthesis_memo
  const avgScore = [
    decision.price_score, decision.ruin_score, decision.imitation_score,
    decision.confirmation_score, decision.ego_score,
  ].filter(s => s != null)
  const avg = avgScore.length > 0 ? (avgScore.reduce((a, b) => a + b, 0) / avgScore.length).toFixed(1) : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Card header */}
      <button
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              {decision.ticker && (
                <span className="font-semibold text-gray-900">{decision.ticker}</span>
              )}
              <span className="capitalize text-sm text-gray-600">{decision.decision_type}</span>
              {decision.recommendation && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${REC_COLORS[decision.recommendation] || 'bg-gray-100 text-gray-600'}`}>
                  {decision.recommendation}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(decision.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {avg && (
            <div className="text-right">
              <p className="text-xs text-gray-400">Avg score</p>
              <p className="text-sm font-semibold text-gray-700">{avg}/10</p>
            </div>
          )}
          {decision.outcome && (
            <span className={`text-xs font-medium capitalize ${OUTCOME_COLORS[decision.outcome] || ''}`}>
              {decision.outcome}
              {decision.outcome_rating && ` · ${decision.outcome_rating}/5`}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-4">
          {/* Thesis */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Original Thesis</p>
            <p className="text-sm text-gray-700 italic">"{decision.thesis}"</p>
          </div>

          {/* View full memo link */}
          {memo && (
            <div className="flex justify-end">
              <Link
                to={`/session/${decision.id}`}
                className="text-xs font-semibold text-forest-600 hover:text-forest-700 flex items-center gap-1"
              >
                View Invert Recommendation →
              </Link>
            </div>
          )}

          {/* Synthesis memo summary */}
          {memo && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 mb-1">Reflective Mind</p>
                <p className="text-xs text-gray-600 leading-relaxed">{memo.reflective_mind}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-amber-600 mb-1">Emotional Patterns</p>
                <p className="text-xs text-gray-600 leading-relaxed">{memo.emotional_patterns}</p>
              </div>
            </div>
          )}

          {/* PRICE scores mini bar */}
          {avg && (
            <div className="flex gap-2">
              {['price', 'ruin', 'imitation', 'confirmation', 'ego'].map(dim => {
                const score = decision[`${dim}_score`]
                const letters = { price: 'P', ruin: 'R', imitation: 'I', confirmation: 'C', ego: 'E' }
                return (
                  <div key={dim} className="flex-1 text-center">
                    <div className="text-xs text-gray-400 mb-1">{letters[dim]}</div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-forest-400 rounded-full"
                        style={{ width: score != null ? `${(score / 10) * 100}%` : '0%' }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{score != null ? score : '—'}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Outcome section */}
          {!outcomeSaved ? (
            <div>
              <button
                onClick={() => setShowOutcome(v => !v)}
                className="text-sm text-forest-600 hover:text-forest-700 font-medium"
              >
                {showOutcome ? 'Cancel' : '+ Log outcome'}
              </button>
              {showOutcome && (
                <div className="mt-3 space-y-3 bg-gray-50 rounded-lg p-4">
                  <div className="flex gap-2">
                    {['proceeded', 'paused', 'reversed'].map(o => (
                      <button
                        key={o}
                        onClick={() => setOutcomeForm(f => ({ ...f, outcome: o }))}
                        className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors capitalize
                                    ${outcomeForm.outcome === o
                                      ? 'bg-forest-500 text-white border-forest-500'
                                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Rating: {outcomeForm.outcome_rating}/5</label>
                    <input type="range" min={1} max={5} value={outcomeForm.outcome_rating}
                      onChange={e => setOutcomeForm(f => ({ ...f, outcome_rating: parseInt(e.target.value) }))}
                      className="w-full accent-forest-500" />
                  </div>
                  <textarea
                    value={outcomeForm.outcome_notes}
                    onChange={e => setOutcomeForm(f => ({ ...f, outcome_notes: e.target.value }))}
                    placeholder="Notes…"
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none
                               focus:outline-none focus:ring-1 focus:ring-forest-400"
                  />
                  <button
                    onClick={handleSaveOutcome}
                    disabled={!outcomeForm.outcome}
                    className="px-4 py-1.5 bg-forest-500 text-white rounded-lg text-xs font-semibold
                               hover:bg-forest-600 disabled:opacity-40 transition-colors"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-forest-50 border border-forest-200 rounded-lg p-3">
              <p className="text-xs text-forest-700 font-medium">
                Outcome: <span className="capitalize">{decision.outcome}</span>
                {decision.outcome_rating && ` · ${decision.outcome_rating}/5`}
              </p>
              {decision.outcome_notes && (
                <p className="text-xs text-forest-600 mt-1">{decision.outcome_notes}</p>
              )}
            </div>
          )}

          {/* Journal notes */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</p>
            {notes.map(note => (
              <div key={note.id} className="flex items-start gap-2 mb-2">
                <p className="flex-1 text-xs text-gray-600 bg-gray-50 rounded px-3 py-2">
                  {note.note}
                  <span className="ml-2 text-gray-400">{formatDate(note.created_at)}</span>
                </p>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-xs mt-2"
                >✕</button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                placeholder="Add a note…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs
                           focus:outline-none focus:ring-1 focus:ring-forest-400"
              />
              <button
                onClick={handleAddNote}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs hover:bg-gray-200 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Journal() {
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const load = () => {
    setLoading(true)
    getJournal()
      .then(setDecisions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Decision Journal</h1>
        <p className="text-gray-500 mt-1">
          Every decision you've run through the Gate — with outcomes and notes.
        </p>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">Loading journal…</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      {!loading && decisions.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-500 text-sm">No decisions yet.</p>
          <p className="text-gray-400 text-xs mt-1">Run the Decision Gate to start your journal.</p>
        </div>
      )}

      {decisions.map(d => (
        <DecisionCard key={d.id} decision={d} onRefresh={load} />
      ))}
    </div>
  )
}
