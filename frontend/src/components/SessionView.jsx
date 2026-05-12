import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDecision } from '../api'
import SynthesisMemo from './SynthesisMemo'

export default function SessionView() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const [decision, setDecision] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!id) { navigate('/gate'); return }
    getDecision(id)
      .then(d => {
        if (!d.synthesis_memo) {
          // Session exists but synthesis not done — go back to gate
          navigate('/gate')
        } else {
          setDecision(d)
        }
      })
      .catch(() => setError('Session not found.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
      Loading session…
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
      {error}
    </div>
  )

  if (!decision) return null

  return (
    <SynthesisMemo
      memo={decision.synthesis_memo}
      decision={decision}
      onReset={() => navigate('/gate')}
    />
  )
}
