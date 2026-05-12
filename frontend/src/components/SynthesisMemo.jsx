import { useState } from 'react'
import { updateOutcome, getResearchQuestions } from '../api'

const REC_CONFIG = {
  proceed:     { label: 'Proceed',     bg: 'bg-forest-500', text: 'text-white', icon: '✓' },
  pause:       { label: 'Pause',       bg: 'bg-amber-500',  text: 'text-white', icon: '⏸' },
  reconsider:  { label: 'Reconsider',  bg: 'bg-red-600',    text: 'text-white', icon: '✕' },
}

const SCORE_COLORS = ['bg-red-400','bg-orange-400','bg-amber-400','bg-yellow-300','bg-lime-400','bg-green-400','bg-emerald-500']

const DIMENSIONS = [
  { key: 'price',        letter: 'P', label: 'Price',        field: 'price_score' },
  { key: 'ruin',         letter: 'R', label: 'Ruin',         field: 'ruin_score' },
  { key: 'imitation',    letter: 'I', label: 'Imitation',    field: 'imitation_score' },
  { key: 'confirmation', letter: 'C', label: 'Confirmation', field: 'confirmation_score' },
  { key: 'ego',          letter: 'E', label: 'Ego',          field: 'ego_score' },
]

const DIM_COLORS = { P: '#2d6a4f', R: '#c0572b', I: '#6b3fa0', C: '#b8860b', E: '#1a5276' }

function ScoreBar({ score }) {
  if (score == null) return <span className="text-xs text-gray-400">—</span>
  const idx = Math.min(Math.floor(score), 6)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${SCORE_COLORS[idx]}`} style={{ width: `${score / 10 * 100}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right">{score}/10</span>
    </div>
  )
}

// ── Research PDF ────────────────────────────────────────────────────────────────

function ResearchPDF({ questions, decision }) {
  const ticker = decision?.ticker || 'Investment'
  const date   = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const handlePrint = () => {
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Invert — Further Research Questionnaire: ${ticker}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', serif; color: #1a1a1a; padding: 48px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
    .header { border-bottom: 2px solid #2d6a4f; padding-bottom: 20px; margin-bottom: 32px; }
    .brand { font-size: 13px; color: #2d6a4f; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
    h1 { font-size: 22px; font-weight: bold; color: #1a1a1a; margin-bottom: 6px; }
    .meta { font-size: 12px; color: #666; }
    .thesis-box { background: #f8f8f8; border-left: 3px solid #2d6a4f; padding: 12px 16px; margin-bottom: 28px; font-style: italic; font-size: 13px; color: #444; }
    .priority { background: #fff8e1; border: 1px solid #f5c542; border-radius: 6px; padding: 14px 18px; margin-bottom: 28px; }
    .priority-label { font-size: 10px; font-weight: bold; color: #b8860b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
    .priority-text { font-size: 14px; font-weight: bold; color: #1a1a1a; }
    .section { margin-bottom: 28px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .dim-badge { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; color: white; flex-shrink: 0; }
    .section-title { font-size: 15px; font-weight: bold; color: #1a1a1a; }
    .concern { font-size: 12px; color: #666; margin-bottom: 10px; font-style: italic; padding-left: 36px; }
    ol { padding-left: 52px; }
    ol li { font-size: 13px; margin-bottom: 8px; color: #222; }
    .sources { margin-top: 32px; padding-top: 20px; border-top: 1px solid #ddd; }
    .sources-title { font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 10px; }
    .sources ul { padding-left: 20px; }
    .sources li { font-size: 12px; color: #444; margin-bottom: 5px; }
    .ai-prompt { margin-top: 28px; background: #f0faf4; border: 1px solid #a8e0c0; border-radius: 6px; padding: 16px; page-break-inside: avoid; }
    .ai-prompt-label { font-size: 10px; font-weight: bold; color: #2d6a4f; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
    .ai-prompt-text { font-size: 12px; color: #1a1a1a; background: white; border: 1px solid #ddd; border-radius: 4px; padding: 12px; font-family: monospace; line-height: 1.5; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center; }
    @media print { body { padding: 28px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Invert · Further Research Questionnaire</div>
    <h1>${ticker} — ${decision?.decision_type ? decision.decision_type.charAt(0).toUpperCase() + decision.decision_type.slice(1) : ''} Decision</h1>
    <div class="meta">Generated ${date} · Before you act, run your decision through Charlie first.</div>
  </div>

  <div class="thesis-box">"${decision?.thesis || ''}"</div>

  ${questions.priority_action ? `
  <div class="priority">
    <div class="priority-label">Priority Action</div>
    <div class="priority-text">${questions.priority_action}</div>
  </div>` : ''}

  ${(questions.sections || []).map(s => `
  <div class="section">
    <div class="section-header">
      <div class="dim-badge" style="background:${DIM_COLORS[s.dimension] || '#666'}">${s.dimension}</div>
      <div class="section-title">${s.title}</div>
    </div>
    ${s.concern ? `<div class="concern">${s.concern}</div>` : ''}
    <ol>${(s.questions || []).map(q => `<li>${q}</li>`).join('')}</ol>
  </div>`).join('')}

  ${questions.data_sources?.length ? `
  <div class="sources">
    <div class="sources-title">Recommended Data Sources</div>
    <ul>${questions.data_sources.map(s => `<li>${s}</li>`).join('')}</ul>
  </div>` : ''}

  ${questions.ai_prompt_suggestion ? `
  <div class="ai-prompt">
    <div class="ai-prompt-label">Ready-to-use AI Research Agent Prompt</div>
    <div class="ai-prompt-text">${questions.ai_prompt_suggestion}</div>
  </div>` : ''}

  <div class="footer">Generated by Invert · Charlie doesn't let you skip the hard questions.</div>

  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`)
    win.document.close()
  }

  return (
    <div className="bg-white rounded-xl border border-forest-200 overflow-hidden">
      {/* Priority action */}
      {questions.priority_action && (
        <div className="px-5 py-4 bg-amber-50 border-b border-amber-100">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Priority Action</p>
          <p className="text-sm font-medium text-gray-900">{questions.priority_action}</p>
        </div>
      )}

      <div className="px-5 py-4 space-y-5">
        {/* Research sections */}
        {(questions.sections || []).map((section, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: DIM_COLORS[section.dimension] || '#666' }}
              >
                {section.dimension}
              </span>
              <span className="text-sm font-semibold text-gray-900">{section.title}</span>
            </div>
            {section.concern && (
              <p className="text-xs text-gray-500 italic ml-8 mb-2">{section.concern}</p>
            )}
            <ol className="ml-8 space-y-1.5">
              {(section.questions || []).map((q, qi) => (
                <li key={qi} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-gray-400 flex-shrink-0">{qi + 1}.</span>
                  <span>{q}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}

        {/* Data sources */}
        {questions.data_sources?.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recommended Data Sources</p>
            <ul className="space-y-1">
              {questions.data_sources.map((src, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-2">
                  <span className="text-gray-300">·</span>{src}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI prompt */}
        {questions.ai_prompt_suggestion && (
          <div className="bg-forest-50 border border-forest-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider mb-2">
              Ready-to-use AI Research Agent Prompt
            </p>
            <p className="text-xs text-gray-700 font-mono leading-relaxed bg-white border border-gray-200 rounded p-3 select-all">
              {questions.ai_prompt_suggestion}
            </p>
            <p className="text-xs text-gray-400 mt-2">Click the prompt text to select all, then paste into your AI research tool.</p>
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-forest-500 text-white text-sm font-semibold rounded-lg
                     hover:bg-forest-600 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF
        </button>
      </div>
    </div>
  )
}

// ── Main SynthesisMemo component ───────────────────────────────────────────────

export default function SynthesisMemo({ memo, decision, onReset }) {
  const [outcomeForm, setOutcomeForm]     = useState({ outcome: '', outcome_rating: 3, outcome_notes: '' })
  const [outcomeSaved, setOutcomeSaved]   = useState(false)
  const [outcomeError, setOutcomeError]   = useState('')
  const [showOutcome, setShowOutcome]     = useState(false)

  const [researchQuestions, setResearchQuestions] = useState(null)
  const [researchLoading, setResearchLoading]     = useState(false)
  const [researchError, setResearchError]         = useState('')
  const [showResearch, setShowResearch]           = useState(false)

  const rec    = memo?.recommendation || 'pause'
  const config = REC_CONFIG[rec] || REC_CONFIG.pause

  // ── Print the main recommendation memo as PDF ──────────────────────────────
  const handlePrintMemo = () => {
    const ticker = decision?.ticker || 'Investment'
    const date   = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const recLabel = config.label
    const recColor = rec === 'proceed' ? '#2d6a4f' : rec === 'reconsider' ? '#c0392b' : '#d97706'

    const scoresHtml = DIMENSIONS.map(({ letter, label, field }) => {
      const score = decision?.[field]
      const pct   = score != null ? (score / 10) * 100 : 0
      const color = DIM_COLORS[letter]
      return `
        <div style="margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <span style="width:60px;font-size:12px;font-weight:600;color:#555">${letter} · ${label}</span>
            <div style="flex:1;height:8px;background:#eee;border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${color};border-radius:4px"></div>
            </div>
            <span style="font-size:12px;font-weight:700;color:#222;width:36px;text-align:right">${score != null ? `${score}/10` : '—'}</span>
          </div>
          ${memo?.[`${letter.toLowerCase() === 'p' ? 'price' : letter.toLowerCase() === 'r' ? 'ruin' : letter.toLowerCase() === 'i' ? 'imitation' : letter.toLowerCase() === 'c' ? 'confirmation' : 'ego'}_summary`]
            ? `<p style="font-size:11px;color:#666;margin-left:74px;margin-top:2px">${memo[`${letter.toLowerCase() === 'p' ? 'price' : letter.toLowerCase() === 'r' ? 'ruin' : letter.toLowerCase() === 'i' ? 'imitation' : letter.toLowerCase() === 'c' ? 'confirmation' : 'ego'}_summary`]}</p>`
            : ''}
        </div>`
    }).join('')

    const risksHtml = (memo?.key_risks || []).map(r =>
      `<li style="font-size:13px;color:#333;margin-bottom:6px">${r}</li>`
    ).join('')

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Invert — Decision Memo: ${ticker}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Georgia',serif; color:#1a1a1a; padding:48px; max-width:800px; margin:0 auto; line-height:1.6; }
    .brand { font-size:12px; color:#2d6a4f; font-weight:bold; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:8px; }
    .header { border-bottom:2px solid #2d6a4f; padding-bottom:20px; margin-bottom:28px; }
    h1 { font-size:22px; font-weight:bold; color:#1a1a1a; margin-bottom:4px; }
    .meta { font-size:12px; color:#666; }
    .rec-banner { background:${recColor}; color:white; padding:16px 20px; border-radius:8px; margin-bottom:24px; }
    .rec-label { font-size:11px; text-transform:uppercase; letter-spacing:0.1em; opacity:0.85; margin-bottom:4px; }
    .rec-title { font-size:20px; font-weight:bold; }
    .rec-rationale { font-size:13px; opacity:0.9; margin-top:8px; line-height:1.5; }
    .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px; }
    .card { border:1px solid #ddd; border-radius:8px; padding:16px; }
    .card-label { font-size:10px; font-weight:bold; text-transform:uppercase; letter-spacing:0.08em; color:#666; margin-bottom:8px; }
    .card-text { font-size:13px; color:#333; line-height:1.5; }
    .scores { border:1px solid #ddd; border-radius:8px; padding:16px; margin-bottom:24px; }
    .section-title { font-size:10px; font-weight:bold; text-transform:uppercase; letter-spacing:0.08em; color:#666; margin-bottom:12px; }
    .risks { border:1px solid #ddd; border-radius:8px; padding:16px; margin-bottom:24px; }
    ul { padding-left:20px; }
    .footer { margin-top:40px; padding-top:16px; border-top:1px solid #eee; font-size:11px; color:#999; text-align:center; }
    .thesis-box { background:#f8f8f8; border-left:3px solid #2d6a4f; padding:10px 14px; margin-bottom:24px; font-style:italic; font-size:13px; color:#444; }
    @media print { body { padding:28px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Invert · Decision Memo</div>
    <h1>${ticker}${decision?.decision_type ? ` — ${decision.decision_type.charAt(0).toUpperCase() + decision.decision_type.slice(1)}` : ''}</h1>
    <div class="meta">Generated ${date} · Before you act, run your decision through Charlie first.</div>
  </div>
  <div class="thesis-box">"${decision?.thesis || ''}"</div>
  <div class="rec-banner">
    <div class="rec-label">Invert Recommendation</div>
    <div class="rec-title">${recLabel}</div>
    ${memo?.recommendation_rationale ? `<div class="rec-rationale">${memo.recommendation_rationale}</div>` : ''}
  </div>
  <div class="grid">
    <div class="card">
      <div class="card-label">Reflective Mind</div>
      <div class="card-text">${memo?.reflective_mind || ''}</div>
    </div>
    <div class="card" style="background:#fffdf0;border-color:#f5e090">
      <div class="card-label" style="color:#b8860b">Emotional Patterns Detected</div>
      <div class="card-text">${memo?.emotional_patterns || ''}</div>
    </div>
  </div>
  <div class="scores">
    <div class="section-title">P.R.I.C.E. Scores</div>
    ${scoresHtml}
  </div>
  ${risksHtml ? `<div class="risks"><div class="section-title">Key Risks to Monitor</div><ul>${risksHtml}</ul></div>` : ''}
  <div class="footer">Generated by Invert · Charlie doesn't let you skip the hard questions.</div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`)
    win.document.close()
  }

  const handleSaveOutcome = async () => {
    if (!outcomeForm.outcome) return
    try {
      await updateOutcome(decision.id, outcomeForm)
      setOutcomeSaved(true)
    } catch (err) {
      setOutcomeError(err.message)
    }
  }

  const handleGenerateResearch = async () => {
    if (researchQuestions) { setShowResearch(true); return }
    setResearchLoading(true)
    setResearchError('')
    try {
      const q = await getResearchQuestions(decision.id)
      setResearchQuestions(q)
      setShowResearch(true)
    } catch (err) {
      setResearchError(err.message)
    } finally {
      setResearchLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Recommendation banner */}
      <div className={`rounded-xl p-5 ${config.bg} ${config.text}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Invert Recommendation</p>
            <p className="text-xl font-bold">{config.label}</p>
          </div>
        </div>
        {memo?.recommendation_rationale && (
          <p className="mt-3 text-sm opacity-90 leading-relaxed">{memo.recommendation_rationale}</p>
        )}
      </div>

      {/* Reflective vs Emotional */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reflective Mind</p>
          <p className="text-sm text-gray-700 leading-relaxed">{memo?.reflective_mind}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Emotional Patterns Detected</p>
          <p className="text-sm text-gray-700 leading-relaxed">{memo?.emotional_patterns}</p>
        </div>
      </div>

      {/* P.R.I.C.E. scores */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">P.R.I.C.E. Scores</p>
        <div className="space-y-3">
          {DIMENSIONS.map(({ letter, label, field, key }) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-500 w-14 sm:w-16 flex-shrink-0">{letter} · {label}</span>
                <div className="flex-1"><ScoreBar score={decision?.[field]} /></div>
              </div>
              {memo?.[`${key}_summary`] && (
                <p className="text-xs text-gray-500 ml-16 leading-relaxed">{memo[`${key}_summary`]}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Key risks */}
      {memo?.key_risks?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Key Risks to Monitor</p>
          <ul className="space-y-2">
            {memo.key_risks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-sm text-gray-700">{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
        <button
          onClick={() => setShowOutcome(v => !v)}
          className="flex-1 py-2.5 border border-forest-300 text-forest-700 rounded-lg text-sm
                     font-medium hover:bg-forest-50 transition-colors"
        >
          Log Outcome
        </button>
        <button
          onClick={handlePrintMemo}
          className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm
                     font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF
        </button>
        <button
          onClick={handleGenerateResearch}
          disabled={researchLoading}
          className="flex-1 py-2.5 bg-forest-500 text-white rounded-lg text-sm font-semibold
                     hover:bg-forest-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {researchLoading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
          )}
          {researchLoading ? 'Building questionnaire…' : showResearch ? 'Hide Research' : 'Further Research →'}
        </button>
        <button
          onClick={onReset}
          className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm
                     font-medium hover:bg-gray-50 transition-colors"
        >
          New Decision
        </button>
      </div>

      {/* Research error */}
      {researchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
          {researchError}
        </div>
      )}

      {/* Research questionnaire */}
      {showResearch && researchQuestions && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-900">Further Research Questionnaire</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Gaps and questions identified during your Invert session.
                Download as PDF to feed into an AI research agent.
              </p>
            </div>
          </div>
          <ResearchPDF questions={researchQuestions} decision={decision} />
        </div>
      )}

      {/* Outcome form */}
      {showOutcome && !outcomeSaved && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p className="font-medium text-gray-800 text-sm">What did you actually do?</p>
          <div className="flex gap-2">
            {['proceeded', 'paused', 'reversed'].map(o => (
              <button key={o}
                onClick={() => setOutcomeForm(f => ({ ...f, outcome: o }))}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors capitalize
                            ${outcomeForm.outcome === o
                              ? 'bg-forest-500 text-white border-forest-500'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >{o}</button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              How did it turn out? <span className="text-forest-600 font-normal">{outcomeForm.outcome_rating}/5</span>
            </label>
            <input type="range" min={1} max={5} value={outcomeForm.outcome_rating}
              onChange={e => setOutcomeForm(f => ({ ...f, outcome_rating: parseInt(e.target.value) }))}
              className="w-full accent-forest-500" />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>Bad decision</span><span>Great decision</span>
            </div>
          </div>
          <textarea value={outcomeForm.outcome_notes}
            onChange={e => setOutcomeForm(f => ({ ...f, outcome_notes: e.target.value }))}
            placeholder="Any notes on what happened…" rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-forest-400 resize-none" />
          {outcomeError && <p className="text-red-600 text-sm">{outcomeError}</p>}
          <button onClick={handleSaveOutcome} disabled={!outcomeForm.outcome}
            className="w-full py-2.5 bg-forest-500 text-white rounded-lg text-sm font-semibold
                       hover:bg-forest-600 disabled:opacity-40 transition-colors">
            Save Outcome
          </button>
        </div>
      )}

      {outcomeSaved && (
        <div className="bg-forest-50 border border-forest-200 text-forest-700 text-sm rounded-lg p-3">
          Outcome saved — this feeds into your Bias Fingerprint.
        </div>
      )}
    </div>
  )
}
