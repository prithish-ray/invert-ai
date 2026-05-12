import { useState, useEffect } from 'react'
import { getBiasProfile } from '../api'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts'

const DIM_LABELS = {
  price:        'P · Price',
  ruin:         'R · Ruin',
  imitation:    'I · Imitation',
  confirmation: 'C · Confirmation',
  ego:          'E · Ego',
}

const DIM_COLORS = {
  price:        '#2d6a4f',
  ruin:         '#c0572b',
  imitation:    '#6b3fa0',
  confirmation: '#b8860b',
  ego:          '#1a5276',
}

function ScoreBar({ dim, score, skipCount }) {
  const pct = score != null ? (score / 10) * 100 : 0
  const color = DIM_COLORS[dim]
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-gray-500 w-28 flex-shrink-0">
        {DIM_LABELS[dim]}
      </span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-10 text-right">
        {score != null ? `${score}/10` : '—'}
      </span>
      {skipCount > 0 && (
        <span className="text-xs text-red-400 w-16 text-right">
          {skipCount} skip{skipCount > 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

export default function BiasFingerprint() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    getBiasProfile()
      .then(setProfile)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const radarData = profile
    ? Object.entries(profile.avg_scores).map(([dim, score]) => ({
        subject: DIM_LABELS[dim].split(' · ')[1],
        score: score ?? 0,
        fullMark: 10,
      }))
    : []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bias Fingerprint</h1>
        <p className="text-gray-500 mt-1">
          Your personal behavioural profile, built from every Invert session.
        </p>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400 text-sm">Analysing your decisions…</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>
      )}

      {profile && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{profile.total_decisions}</p>
              <p className="text-xs text-gray-500 mt-1 leading-tight">Decisions logged</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 text-center">
              {profile.emotional_regret_rate != null ? (
                <>
                  <p className={`text-2xl sm:text-3xl font-bold ${profile.emotional_regret_rate > 50 ? 'text-red-600' : 'text-forest-600'}`}>
                    {profile.emotional_regret_rate}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-tight">High-emotion regret</p>
                </>
              ) : (
                <>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-300">—</p>
                  <p className="text-xs text-gray-400 mt-1 leading-tight">Log outcomes to unlock</p>
                </>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 text-center">
              {profile.imitation_rate != null ? (
                <>
                  <p className={`text-2xl sm:text-3xl font-bold ${profile.imitation_rate > 40 ? 'text-amber-600' : 'text-forest-600'}`}>
                    {profile.imitation_rate}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-tight">Mimetic influence</p>
                </>
              ) : (
                <>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-300">—</p>
                  <p className="text-xs text-gray-400 mt-1 leading-tight">More data needed</p>
                </>
              )}
            </div>
          </div>

          {/* Radar + score bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Radar chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                P.R.I.C.E. Radar
              </p>
              {profile.total_decisions === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                  No data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 10]} tick={false} axisLine={false} />
                    <Radar
                      name="Your scores"
                      dataKey="score"
                      stroke="#2d6a4f"
                      fill="#2d6a4f"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                    <Tooltip
                      formatter={(val) => [`${val}/10`, 'Avg score']}
                      contentStyle={{ fontSize: 12 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Score bars */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Average Scores
              </p>
              <div className="space-y-3">
                {Object.entries(profile.avg_scores).map(([dim, score]) => (
                  <ScoreBar
                    key={dim}
                    dim={dim}
                    score={score}
                    skipCount={profile.skip_counts[dim] || 0}
                  />
                ))}
              </div>

              {profile.weakest_dimension && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Weakest dimension:{' '}
                    <span className="font-semibold text-gray-800">
                      {DIM_LABELS[profile.weakest_dimension]}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Insights */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Personal Insights
            </p>
            <div className="space-y-3">
              {profile.insights.map((insight, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-forest-100 text-forest-700 flex-shrink-0
                                   flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <p
                    className="text-sm text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: insight.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {profile.total_decisions < 5 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                <strong>Building your fingerprint.</strong> Run {5 - profile.total_decisions} more decision
                {5 - profile.total_decisions !== 1 ? 's' : ''} through Invert for a fuller profile.
                The pattern analysis sharpens significantly after 10 sessions.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
