'use client'

import React, { useState } from 'react'
import { getWorkoutsForPeriod } from '@/constants/gymData'
import type { Workout, Period } from '@/constants/gymData'

type Props = {
  workouts: Workout[]
}

type StatSummary = {
  // Lifting
  liftSets: number
  liftReps: number
  liftVolumeLbs: number // total weight moved (reps × weight)
  // Bodyweight
  pushUpReps: number
  pullUpReps: number
  // Running
  runMiles: number
  runMinutes: number
  // Body weight entries
  workoutCount: number
}

function summarize(workouts: Workout[]): StatSummary {
  const s: StatSummary = {
    liftSets: 0, liftReps: 0, liftVolumeLbs: 0,
    pushUpReps: 0, pullUpReps: 0,
    runMiles: 0, runMinutes: 0,
    workoutCount: new Set(workouts.map(w => w.date)).size,
  }

  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (w.type === 'lift' && ex.sets) {
        for (const set of ex.sets) {
          s.liftSets++
          s.liftReps += set.reps
          s.liftVolumeLbs += set.reps * (set.weightLbs ?? 0)
        }
      }
      if (w.type === 'bodyweight' && ex.sets) {
        const reps = ex.sets.reduce((sum, s) => sum + s.reps, 0)
        if (ex.name === 'Push-up') s.pushUpReps += reps
        if (ex.name === 'Pull-up') s.pullUpReps += reps
      }
      if (w.type === 'run') {
        s.runMiles += ex.distanceMiles ?? 0
        s.runMinutes += ex.durationMinutes ?? 0
      }
    }
  }

  return s
}

const PERIODS: { label: string; value: Period }[] = [
  { label: 'Today', value: 'daily' },
  { label: 'Week', value: 'weekly' },
  { label: 'Month', value: 'monthly' },
]

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 10px' }}>
      <div style={{ fontSize: '18px', fontWeight: '800', color: '#e07b39', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '9px', color: '#888', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
      {sub && <div style={{ fontSize: '9px', color: '#555', marginTop: '1px' }}>{sub}</div>}
    </div>
  )
}

function Divider() {
  return <div style={{ width: '1px', backgroundColor: '#222', alignSelf: 'stretch', margin: '4px 0' }} />
}

export function ZoneStats({ workouts }: Props) {
  const [period, setPeriod] = useState<Period>('weekly')
  const filtered = getWorkoutsForPeriod(workouts, period)
  const s = summarize(filtered)

  const avgPace = s.runMiles > 0
    ? (() => {
        const p = s.runMinutes / s.runMiles
        return `${Math.floor(p)}:${Math.round((p % 1) * 60).toString().padStart(2, '0')}/mi`
      })()
    : null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '3%',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#0d0d0d',
        border: '1px solid #1e1e1e',
        borderRadius: '10px',
        padding: '8px 4px',
        gap: '0',
        fontFamily: "'Geist Sans', system-ui, sans-serif",
        color: 'white',
        zIndex: 50,
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      }}
    >
      {/* Period selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 12px', borderRight: '1px solid #222' }}>
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            style={{
              padding: '2px 8px', fontSize: '9px', borderRadius: '999px', border: 'none',
              cursor: 'pointer',
              backgroundColor: period === p.value ? '#e07b39' : 'transparent',
              color: period === p.value ? 'white' : '#555',
              fontWeight: period === p.value ? '700' : '400',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Days trained */}
      <Stat label="Days" value={`${s.workoutCount}`} />
      <Divider />

      {/* 💪 Bodyweight */}
      <Stat label="Push-ups" value={`${s.pushUpReps}`} />
      <Stat label="Pull-ups" value={`${s.pullUpReps}`} />
      <Divider />

      {/* 🏋️ Lifting */}
      <Stat label="Lift Reps" value={`${s.liftReps}`} sub={`${s.liftSets} sets`} />
      <Stat
        label="Volume"
        value={s.liftVolumeLbs >= 1000 ? `${(s.liftVolumeLbs / 1000).toFixed(1)}k` : `${s.liftVolumeLbs}`}
        sub="lbs moved"
      />
      <Divider />

      {/* 🏃 Running */}
      <Stat label="Miles" value={s.runMiles.toFixed(1)} sub={avgPace ?? undefined} />
    </div>
  )
}
