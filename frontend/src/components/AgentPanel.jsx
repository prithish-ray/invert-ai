import { useState, useRef, useEffect } from 'react'
import { converseAgent, skipAgent } from '../api'

const MAX_QUESTIONS = 2

export default function AgentPanel({ agent, colors, decisionId, onComplete, onSkip, isGloballyDisabled, autoSkipped = false }) {
  // idle | opening | questioning | user_turn | concluding | complete | skipped
  const [phase, setPhase]         = useState(autoSkipped ? 'skipped' : 'idle')
  const [messages, setMessages]   = useState([])   // { from: 'agent'|'user', text: string }
  const [userInput, setUserInput] = useState('')
  const [questionsAsked, setQuestionsAsked] = useState(0)
  const [score, setScore]         = useState(null)
  const [error, setError]         = useState('')
  const bottomRef                 = useRef(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, phase])

  const isActive   = phase !== 'idle' && phase !== 'complete' && phase !== 'skipped'
  const isThinking = phase === 'opening' || phase === 'concluding'
  const isWaiting  = phase === 'questioning'   // waiting for user input

  // ── Call the backend for one conversation turn ──────────────────────────────
  const callAgent = async (userMessage = null) => {
    setError('')
    const thinkingPhase = userMessage === null ? 'opening' : 'concluding'
    setPhase(thinkingPhase)

    try {
      const res = await converseAgent(decisionId, agent.key, userMessage)

      if (res.status === 'question') {
        setMessages(prev => [...prev, { from: 'agent', text: res.content }])
        setQuestionsAsked(res.questions_asked)
        setPhase('questioning')
      } else {
        // complete
        setMessages(prev => [...prev, { from: 'agent', text: res.content }])
        setScore(res.score)
        setPhase('complete')
        onComplete({ response: res.content, score: res.score, skipped: false })
      }
    } catch (err) {
      setError(err.message)
      setPhase(phase === 'opening' ? 'idle' : 'questioning')
    }
  }

  // ── Start the interrogation ─────────────────────────────────────────────────
  const handleStart = () => {
    setMessages([])
    setQuestionsAsked(0)
    setScore(null)
    callAgent(null)
  }

  // ── Submit user reply ───────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e?.preventDefault()
    const trimmed = userInput.trim()
    if (!trimmed || isThinking) return
    setMessages(prev => [...prev, { from: 'user', text: trimmed }])
    setUserInput('')
    callAgent(trimmed)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // ── Skip ────────────────────────────────────────────────────────────────────
  const handleSkip = async () => {
    try {
      await skipAgent(decisionId, agent.key)
      setPhase('skipped')
      onSkip()
    } catch (err) {
      setError(err.message)
    }
  }

  const progressPct = questionsAsked / MAX_QUESTIONS * 100

  return (
    <div className={`rounded-xl border overflow-hidden transition-all
      ${phase === 'complete' ? colors.border : phase === 'skipped' ? 'border-gray-200' : 'border-gray-200'}
      bg-white`}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-4 sm:px-5 py-3 gap-2
        ${phase === 'complete' && !isThinking ? colors.light : 'bg-white'}`}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
                            text-white font-bold text-xs sm:text-sm flex-shrink-0 ${colors.bg}`}>
            {agent.letter}
          </span>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{agent.label}</p>
            <p className="text-xs text-gray-400 hidden sm:block">{agent.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Score badge */}
          {score != null && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
              {score}/10
            </span>
          )}

          {/* Status / action buttons */}
          {phase === 'idle' && (
            <div className="flex gap-1.5 sm:gap-2">
              <button
                onClick={handleStart}
                disabled={isGloballyDisabled}
                className={`px-2.5 sm:px-4 py-1.5 text-xs font-semibold rounded-lg text-white
                            ${colors.bg} hover:opacity-90
                            disabled:opacity-40 disabled:cursor-not-allowed transition-opacity`}
              >
                <span className="sm:hidden">Begin</span>
                <span className="hidden sm:inline">Begin conversation</span>
              </button>
              <button
                onClick={handleSkip}
                disabled={isGloballyDisabled}
                className="px-2.5 sm:px-3 py-1.5 text-xs text-gray-500 rounded-lg border border-gray-200
                           hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                Skip
              </button>
            </div>
          )}

          {(phase === 'opening' || phase === 'concluding') && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <svg className="animate-spin h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                        stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="hidden sm:inline">{phase === 'opening' ? 'Opening…' : 'Deliberating…'}</span>
            </span>
          )}

          {phase === 'complete' && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                Done
              </span>
              <button
                onClick={handleStart}
                className="px-2.5 sm:px-3 py-1.5 text-xs text-gray-500 rounded-lg border border-gray-200
                           hover:bg-gray-50 transition-colors"
              >
                Re-run
              </button>
            </div>
          )}

          {phase === 'skipped' && (
            <span className="text-xs text-gray-400 px-2 py-0.5 rounded-full bg-gray-100">
              Skipped
            </span>
          )}
        </div>
      </div>

      {/* ── Question progress bar (shown when interrogation is active) ────── */}
      {isActive && questionsAsked > 0 && (
        <div className="px-5 pt-1 pb-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${colors.bg}`}
                style={{ width: `${progressPct}%`, opacity: 0.6 }}
              />
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {questionsAsked}/{MAX_QUESTIONS} questions
            </span>
          </div>
        </div>
      )}

      {/* ── Conversation thread ─────────────────────────────────────────────── */}
      {(messages.length > 0 || phase === 'skipped') && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3 max-h-96 overflow-y-auto">

          {phase === 'skipped' && (
            <p className="text-xs text-gray-400 italic">
              {autoSkipped
                ? 'Not applicable for Buy decisions — this agent probes holding inertia and sunk-cost bias in existing positions.'
                : 'Agent skipped. Skipped agents are recorded in your Bias Fingerprint.'}
            </p>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.from === 'agent' ? (
                <div className="flex items-start gap-2 max-w-[90%]">
                  <span className={`mt-1 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center
                                    text-white text-xs font-bold ${colors.bg}`}>
                    {agent.letter}
                  </span>
                  <div className={`rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm
                                   leading-relaxed whitespace-pre-wrap ${colors.light}
                                   border ${colors.border}`}>
                    {msg.text}
                  </div>
                </div>
              ) : (
                <div className="max-w-[80%] bg-gray-100 rounded-2xl rounded-tr-sm
                                px-4 py-2.5 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {msg.text}
                </div>
              )}
            </div>
          ))}

          {/* Thinking indicator inside thread */}
          {isThinking && messages.length > 0 && (
            <div className="flex items-start gap-2">
              <span className={`mt-1 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center
                                text-white text-xs font-bold ${colors.bg}`}>
                {agent.letter}
              </span>
              <div className={`rounded-2xl rounded-tl-sm px-4 py-3 ${colors.light} border ${colors.border}`}>
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]"/>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]"/>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]"/>
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* ── User reply input (shown when agent has asked a question) ─────── */}
      {phase === 'questioning' && (
        <div className={`border-t ${colors.border} px-4 py-3 bg-white`}>
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <textarea
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Your reply… (Enter to send, Shift+Enter for new line)"
              rows={2}
              autoFocus
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-offset-0
                         focus:ring-gray-300 resize-none leading-relaxed"
            />
            <button
              type="submit"
              disabled={!userInput.trim()}
              className={`px-4 py-2 rounded-xl text-white text-sm font-semibold
                          ${colors.bg} hover:opacity-90
                          disabled:opacity-30 disabled:cursor-not-allowed transition-opacity`}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="px-5 py-2 border-t border-red-100 bg-red-50">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}
