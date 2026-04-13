'use client'

import React from 'react'
import { SafeSvgHtml } from '@/components/common/SafeSvgHtml'
import { DAILY_GOALS, getDailyRepTotals } from '@/constants/gymData'
import type { Workout, WorkoutExercise, Period } from '@/constants/gymData'

type Props = {
  workouts: Workout[]
  period: Period
  onPeriodChange: (p: Period) => void
  allWorkouts: Workout[] // full list for daily goal calculation
  today: string
}

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Today', value: 'daily' },
  { label: 'This Week', value: 'weekly' },
  { label: 'This Month', value: 'monthly' },
]

const TYPE_ICON: Record<string, string> = {
  lift: '🏋️',
  run: '🏃',
  bodyweight: '💪',
  other: '⚡',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
}

function formatPace(distanceMiles: number, durationMinutes: number) {
  const pace = durationMinutes / distanceMiles
  const mins = Math.floor(pace)
  const secs = Math.round((pace - mins) * 60)
  return `${mins}:${secs.toString().padStart(2, '0')}/mi`
}

/** Groups exercises by name within a single workout, merging sets by subtype */
function groupByName(exercises: Workout['exercises']) {
  const map = new Map<string, WorkoutExercise[]>()
  for (const ex of exercises) {
    if (!map.has(ex.name)) map.set(ex.name, [])
    map.get(ex.name)!.push(ex)
  }
  return map
}

function DailyGoalBar({ name, done, goal }: { name: string; done: number; goal: number }) {
  const pct = Math.min(100, Math.round((done / goal) * 100))
  const complete = done >= goal
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
        <span style={{ fontSize: '11px', fontWeight: '600', color: complete ? '#2ecc71' : '#e0e0e0' }}>
          {complete ? '✅' : '💪'} {name}
        </span>
        <span style={{ fontSize: '11px', color: complete ? '#2ecc71' : '#e07b39', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
          {done} / {goal}
        </span>
      </div>
      {/* Bar track */}
      <div style={{ height: '6px', backgroundColor: '#222', borderRadius: '3px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: complete ? '#2ecc71' : '#e07b39',
            borderRadius: '3px',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>
        {complete ? 'Goal reached!' : `${goal - done} to go`}
      </div>
    </div>
  )
}

export function ZoneWorkoutLog({ workouts, period, onPeriodChange, allWorkouts, today }: Props) {
  const dailyTotals = getDailyRepTotals(allWorkouts, today)
  const goalEntries = Object.entries(DAILY_GOALS)

  return (
    <SafeSvgHtml>
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#0d0d0d',
          border: '1px solid #2a2a2a',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'white',
          fontFamily: "'Geist Sans', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: '#1a1a1a',
            padding: '10px 14px 8px',
            borderBottom: '1px solid #2a2a2a',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>
            📋 Workout Log
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => onPeriodChange(p.value)}
                style={{
                  padding: '3px 10px',
                  fontSize: '10px',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: period === p.value ? '700' : '400',
                  backgroundColor: period === p.value ? '#e07b39' : '#2a2a2a',
                  color: period === p.value ? 'white' : '#999',
                  transition: 'all 0.15s',
                  letterSpacing: '0.5px',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Daily goal progress — always visible */}
        {goalEntries.length > 0 && (
          <div
            style={{
              padding: '10px 14px',
              borderBottom: '1px solid #1e1e1e',
              flexShrink: 0,
              backgroundColor: '#111',
            }}
          >
            <div style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>
              Today's Goals
            </div>
            {goalEntries.map(([name, goal]) => (
              <DailyGoalBar
                key={name}
                name={name}
                done={dailyTotals[name] ?? 0}
                goal={goal}
              />
            ))}
          </div>
        )}

        {/* Workout list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
          {workouts.length === 0 ? (
            <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', marginTop: '40px' }}>
              No workouts logged for this period.
            </div>
          ) : (
            workouts.map(workout => {
              const grouped = groupByName(workout.exercises)
              return (
                <div
                  key={workout.id}
                  style={{
                    marginBottom: '14px',
                    borderLeft: `2px solid ${workout.type === 'bodyweight' ? '#6c63ff' : '#e07b39'}`,
                    paddingLeft: '10px',
                  }}
                >
                  {/* Workout header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#e0e0e0' }}>
                      {TYPE_ICON[workout.type]} {formatDate(workout.date)}
                    </span>
                    {workout.bodyWeightLbs && (
                      <span style={{ fontSize: '10px', color: '#555' }}>
                        ⚖️ {workout.bodyWeightLbs} lbs
                      </span>
                    )}
                  </div>

                  {/* Exercises grouped by name */}
                  {Array.from(grouped.entries()).map(([name, variants]) => {
                    const totalReps = variants.reduce(
                      (sum, v) => sum + (v.sets?.reduce((s, set) => s + set.reps, 0) ?? 0),
                      0
                    )
                    const isGoalExercise = name in DAILY_GOALS

                    return (
                      <div key={name} style={{ marginBottom: '8px' }}>
                        {/* Exercise name + total */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                          <span style={{ fontSize: '10px', color: isGoalExercise ? '#a78bfa' : '#aaa', fontWeight: isGoalExercise ? '600' : '400' }}>
                            {name}
                          </span>
                          {isGoalExercise && totalReps > 0 && (
                            <span style={{ fontSize: '9px', color: '#6c63ff', fontVariantNumeric: 'tabular-nums' }}>
                              {totalReps} reps
                            </span>
                          )}
                        </div>

                        {/* Variants */}
                        {variants.map((v, vi) => (
                          <div key={vi} style={{ marginBottom: '4px', paddingLeft: '8px' }}>
                            {(v.variant?.grip || v.variant?.form) && (
                              <div style={{ display: 'flex', gap: '4px', marginBottom: '3px', flexWrap: 'wrap' }}>
                                {v.variant.grip && (
                                  <span style={{
                                    fontSize: '9px', color: '#7c6aed', backgroundColor: '#1a1530',
                                    border: '1px solid #2e2456', borderRadius: '3px', padding: '0 5px',
                                  }}>
                                    ✋ {v.variant.grip}
                                  </span>
                                )}
                                {v.variant.form && (
                                  <span style={{
                                    fontSize: '9px', color: '#3a8f5f', backgroundColor: '#0d1f17',
                                    border: '1px solid #1a3d2b', borderRadius: '3px', padding: '0 5px',
                                  }}>
                                    📐 {v.variant.form}
                                  </span>
                                )}
                              </div>
                            )}
                            {v.sets ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {v.sets.map((set, j) => (
                                  <span
                                    key={j}
                                    style={{
                                      fontSize: '10px',
                                      color: '#ccc',
                                      backgroundColor: '#1a1a1a',
                                      border: '1px solid #2a2a2a',
                                      borderRadius: '4px',
                                      padding: '1px 6px',
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    {set.weightLbs ? `${set.weightLbs}×${set.reps}` : `${set.reps}`}
                                  </span>
                                ))}
                              </div>
                            ) : v.distanceMiles != null && v.durationMinutes != null ? (
                              <div style={{ fontSize: '10px', color: '#ccc' }}>
                                {v.distanceMiles} mi · {v.durationMinutes} min ·{' '}
                                <span style={{ color: '#e07b39' }}>
                                  {formatPace(v.distanceMiles, v.durationMinutes)}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      </div>
    </SafeSvgHtml>
  )
}
