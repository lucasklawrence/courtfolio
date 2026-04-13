'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PUSH_UP_SUBTYPES, PULL_UP_SUBTYPES } from '@/constants/gymData'
import type { WorkoutType } from '@/constants/gymData'

type Props = {
  onClose: () => void
  onSaved: () => void
}

type SetRow = { reps: string; weightLbs: string }

const EXERCISES = {
  lift: ['Squat', 'Bench Press', 'Deadlift', 'Overhead Press', 'Row', 'Other'],
  bodyweight: ['Push-up', 'Pull-up', 'Dip', 'Other'],
  run: ['Run'],
  other: ['Other'],
}

const GRIP_OPTIONS: Record<string, string[]> = {
  'Push-up': ['Regular', 'Wide', 'Close'],
  'Pull-up': ['Overhand', 'Underhand', 'Neutral', 'Wide', 'Close'],
}

const FORM_OPTIONS: Record<string, string[]> = {
  'Push-up': [...PUSH_UP_SUBTYPES],
  'Pull-up': ['Dead Hang', 'Kipping', 'Weighted'],
}

function SetBuilder({
  sets, onChange,
}: {
  sets: SetRow[]
  onChange: (sets: SetRow[]) => void
}) {
  function update(i: number, field: keyof SetRow, val: string) {
    const next = sets.map((s, idx) => (idx === i ? { ...s, [field]: val } : s))
    onChange(next)
  }
  function addSet() {
    onChange([...sets, { reps: '', weightLbs: '' }])
  }
  function removeSet(i: number) {
    onChange(sets.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      {sets.map((set, i) => (
        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '10px', color: '#555', width: '20px' }}>#{i + 1}</span>
          <input
            type="number"
            placeholder="Reps"
            value={set.reps}
            onChange={e => update(i, 'reps', e.target.value)}
            min={1}
            style={{ ...inputStyle, width: '80px' }}
          />
          <input
            type="number"
            placeholder="lbs (opt)"
            value={set.weightLbs}
            onChange={e => update(i, 'weightLbs', e.target.value)}
            min={0}
            step={2.5}
            style={{ ...inputStyle, width: '100px' }}
          />
          <button onClick={() => removeSet(i)} style={ghostBtn}>✕</button>
        </div>
      ))}
      <button onClick={addSet} style={{ ...ghostBtn, fontSize: '12px', marginTop: '2px' }}>
        + Add Set
      </button>
    </div>
  )
}

export function AddWorkoutModal({ onClose, onSaved }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  const [date, setDate] = useState(today)
  const [type, setType] = useState<WorkoutType>('bodyweight')
  const [bodyWeight, setBodyWeight] = useState('')
  const [exerciseName, setExerciseName] = useState('Push-up')
  const [grip, setGrip] = useState('')
  const [form, setForm] = useState('')
  const [sets, setSets] = useState<SetRow[]>([{ reps: '', weightLbs: '' }])
  const [distanceMiles, setDistanceMiles] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isBodyweight = type === 'bodyweight'
  const isRun = type === 'run'
  const gripOptions = GRIP_OPTIONS[exerciseName] ?? []
  const formOptions = FORM_OPTIONS[exerciseName] ?? []

  // Reset exercise-specific fields when type changes
  function handleTypeChange(t: WorkoutType) {
    setType(t)
    setExerciseName(EXERCISES[t][0])
    setGrip('')
    setForm('')
    setSets([{ reps: '', weightLbs: '' }])
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    const supabase = createClient()

    try {
      // 1. Upsert workout for this date+type (or create new)
      const { data: workout, error: wErr } = await supabase
        .from('workouts')
        .insert({
          date,
          type,
          body_weight_lbs: bodyWeight ? parseFloat(bodyWeight) : null,
        })
        .select('id')
        .single()

      if (wErr) throw wErr

      // 2. Insert exercise
      const { data: exercise, error: eErr } = await supabase
        .from('workout_exercises')
        .insert({
          workout_id: workout.id,
          name: exerciseName,
          variant_grip: grip || null,
          variant_form: form || null,
          distance_miles: isRun && distanceMiles ? parseFloat(distanceMiles) : null,
          duration_minutes: isRun && durationMinutes ? parseInt(durationMinutes) : null,
        })
        .select('id')
        .single()

      if (eErr) throw eErr

      // 3. Insert sets
      if (!isRun) {
        const validSets = sets.filter(s => s.reps !== '')
        if (validSets.length === 0) throw new Error('Add at least one set')

        const { error: sErr } = await supabase.from('exercise_sets').insert(
          validSets.map((s, i) => ({
            exercise_id: exercise.id,
            reps: parseInt(s.reps),
            weight_lbs: s.weightLbs ? parseFloat(s.weightLbs) : null,
            sort_order: i,
          }))
        )
        if (sErr) throw sErr
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '10px',
        padding: '24px 28px', width: '420px', maxHeight: '90vh', overflowY: 'auto',
        fontFamily: "'Geist Sans', system-ui, sans-serif", color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '16px', fontWeight: '700' }}>➕ Log Workout</div>
          <button onClick={onClose} style={ghostBtn}>✕</button>
        </div>

        {/* Date */}
        <Field label="Date">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
        </Field>

        {/* Type */}
        <Field label="Type">
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['bodyweight', 'lift', 'run', 'other'] as WorkoutType[]).map(t => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                style={{
                  padding: '4px 12px', borderRadius: '999px', fontSize: '11px', border: 'none',
                  cursor: 'pointer',
                  backgroundColor: type === t ? '#e07b39' : '#2a2a2a',
                  color: type === t ? 'white' : '#999',
                  fontWeight: type === t ? '600' : '400',
                }}
              >
                {t === 'bodyweight' ? '💪' : type === 'lift' ? '🏋️' : type === 'run' ? '🏃' : '⚡'}{' '}
                {t}
              </button>
            ))}
          </div>
        </Field>

        {/* Exercise */}
        <Field label="Exercise">
          <select
            value={exerciseName}
            onChange={e => { setExerciseName(e.target.value); setGrip(''); setForm('') }}
            style={inputStyle}
          >
            {EXERCISES[type].map(ex => (
              <option key={ex} value={ex}>{ex}</option>
            ))}
          </select>
        </Field>

        {/* Grip + Form (bodyweight only) */}
        {isBodyweight && gripOptions.length > 0 && (
          <Field label="Grip">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {gripOptions.map(g => (
                <button
                  key={g}
                  onClick={() => setGrip(grip === g ? '' : g)}
                  style={{
                    padding: '3px 10px', borderRadius: '999px', fontSize: '11px', border: '1px solid',
                    cursor: 'pointer',
                    borderColor: grip === g ? '#7c6aed' : '#2a2a2a',
                    backgroundColor: grip === g ? '#1a1530' : '#1a1a1a',
                    color: grip === g ? '#a78bfa' : '#777',
                  }}
                >
                  ✋ {g}
                </button>
              ))}
            </div>
          </Field>
        )}

        {isBodyweight && formOptions.length > 0 && (
          <Field label="Form">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {formOptions.map(f => (
                <button
                  key={f}
                  onClick={() => setForm(form === f ? '' : f)}
                  style={{
                    padding: '3px 10px', borderRadius: '999px', fontSize: '11px', border: '1px solid',
                    cursor: 'pointer',
                    borderColor: form === f ? '#2a7a50' : '#2a2a2a',
                    backgroundColor: form === f ? '#0d1f17' : '#1a1a1a',
                    color: form === f ? '#3a8f5f' : '#777',
                  }}
                >
                  📐 {f}
                </button>
              ))}
            </div>
          </Field>
        )}

        {/* Run fields */}
        {isRun && (
          <>
            <Field label="Distance (miles)">
              <input type="number" value={distanceMiles} onChange={e => setDistanceMiles(e.target.value)}
                placeholder="3.1" step={0.1} min={0} style={inputStyle} />
            </Field>
            <Field label="Duration (minutes)">
              <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)}
                placeholder="28" min={0} style={inputStyle} />
            </Field>
          </>
        )}

        {/* Sets */}
        {!isRun && (
          <Field label="Sets">
            <SetBuilder sets={sets} onChange={setSets} />
          </Field>
        )}

        {/* Body weight */}
        <Field label="Body Weight (lbs, optional)">
          <input type="number" value={bodyWeight} onChange={e => setBodyWeight(e.target.value)}
            placeholder="185" step={0.5} min={0} style={{ ...inputStyle, width: '120px' }} />
        </Field>

        {error && (
          <div style={{ fontSize: '11px', color: '#e74c3c', marginTop: '8px' }}>{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginTop: '20px', width: '100%', padding: '11px',
            backgroundColor: saving ? '#333' : '#e07b39',
            color: 'white', border: 'none', borderRadius: '6px',
            fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save Workout'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', boxSizing: 'border-box',
  backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '6px',
  color: 'white', fontSize: '13px', outline: 'none',
}

const ghostBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#555', cursor: 'pointer',
  fontSize: '14px', padding: '2px 6px', borderRadius: '4px',
}
