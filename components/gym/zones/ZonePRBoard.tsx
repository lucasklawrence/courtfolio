'use client'

import React from 'react'
import { SafeSvgHtml } from '@/components/common/SafeSvgHtml'
import type { PR, BodyweightPR } from '@/constants/gymData'

type Props = {
  prs: PR[]
  bodyweightPRs: BodyweightPR[]
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function getTier(weightLbs: number, allWeights: number[]): string {
  const max = Math.max(...allWeights)
  const ratio = weightLbs / max
  if (ratio >= 0.9) return '#d4af37'
  if (ratio >= 0.7) return '#b0b0b0'
  return '#cd7f32'
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        margin: '14px 0 8px',
      }}
    >
      <div style={{ flex: 1, height: '1px', backgroundColor: '#c8c8c0' }} />
      <span style={{
        fontSize: '9px',
        color: '#999',
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        fontFamily: "'Geist Sans', system-ui, sans-serif",
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', backgroundColor: '#c8c8c0' }} />
    </div>
  )
}

function VariantTags({ grip, form }: { grip?: string; form?: string }) {
  if (!grip && !form) return null
  return (
    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '1px' }}>
      {grip && (
        <span style={{
          fontSize: '8px', color: '#7c6aed', backgroundColor: '#f0eeff',
          border: '1px solid #d4cfff', borderRadius: '3px', padding: '0 4px',
        }}>
          ✋ {grip}
        </span>
      )}
      {form && (
        <span style={{
          fontSize: '8px', color: '#2a7a50', backgroundColor: '#eef7f2',
          border: '1px solid #b8e0cc', borderRadius: '3px', padding: '0 4px',
        }}>
          📐 {form}
        </span>
      )}
    </div>
  )
}

export function ZonePRBoard({ prs, bodyweightPRs }: Props) {
  const allWeights = prs.map(p => p.weightLbs)

  // Group bodyweight PRs by exercise
  const bwByExercise = bodyweightPRs.reduce<Record<string, BodyweightPR[]>>((acc, pr) => {
    if (!acc[pr.exercise]) acc[pr.exercise] = []
    acc[pr.exercise].push(pr)
    return acc
  }, {})

  return (
    <SafeSvgHtml>
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#f4f4f0',
          borderRadius: '4px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Patrick Hand', 'Geist Sans', cursive, sans-serif",
        }}
      >
        {/* Board header */}
        <div style={{ backgroundColor: '#1c3354', padding: '12px 18px 10px', flexShrink: 0 }}>
          <div style={{
            fontSize: '16px', fontWeight: '700', color: '#f4f4f0', textAlign: 'center',
            letterSpacing: '4px', textTransform: 'uppercase',
            fontFamily: "'Geist Sans', system-ui, sans-serif",
          }}>
            🏆 PR Board
          </div>
          <div style={{
            fontSize: '10px', color: '#7a9cc4', textAlign: 'center', marginTop: '2px',
            fontFamily: "'Geist Sans', system-ui, sans-serif", letterSpacing: '1.5px',
          }}>
            Personal Records — All Time
          </div>
        </div>

        {/* Whiteboard surface */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>

          {/* ── Weighted lifts ── */}
          {prs.length > 0 && (
            <>
              <SectionDivider label="Weighted Lifts" />
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px',
                borderBottom: '1px solid #ddddd8', paddingBottom: '5px', marginBottom: '4px',
                fontSize: '9px', color: '#aaa',
                fontFamily: "'Geist Sans', system-ui, sans-serif",
                textTransform: 'uppercase', letterSpacing: '1px',
              }}>
                <span>Exercise</span>
                <span style={{ textAlign: 'right' }}>Best</span>
                <span style={{ textAlign: 'right' }}>Date</span>
              </div>
              {prs.map((pr, i) => {
                const tierColor = getTier(pr.weightLbs, allWeights)
                return (
                  <div key={pr.exercise} style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px',
                    alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #e8e8e4',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        backgroundColor: tierColor, flexShrink: 0,
                        boxShadow: `0 0 4px ${tierColor}`,
                      }} />
                      <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: i < 3 ? '700' : '500' }}>
                        {pr.exercise}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#1c3354', whiteSpace: 'nowrap' }}>
                      {pr.weightLbs} lbs
                      <span style={{ fontSize: '10px', color: '#888', fontWeight: '400', marginLeft: '3px' }}>
                        ×{pr.reps}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '9px', color: '#999', whiteSpace: 'nowrap', fontFamily: "'Geist Sans', system-ui, sans-serif" }}>
                      {formatDate(pr.date)}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* ── Bodyweight PRs by exercise ── */}
          {Object.entries(bwByExercise).map(([exercise, records]) => (
            <div key={exercise}>
              <SectionDivider label={`${exercise} — Max Reps`} />
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px',
                borderBottom: '1px solid #ddddd8', paddingBottom: '5px', marginBottom: '4px',
                fontSize: '9px', color: '#aaa',
                fontFamily: "'Geist Sans', system-ui, sans-serif",
                textTransform: 'uppercase', letterSpacing: '1px',
              }}>
                <span>Grip · Form</span>
                <span style={{ textAlign: 'right' }}>Reps</span>
                <span style={{ textAlign: 'right' }}>Date</span>
              </div>
              {records.map((pr, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px',
                  alignItems: 'start', padding: '5px 0', borderBottom: '1px solid #e8e8e4',
                }}>
                  <div>
                    <VariantTags grip={pr.variant.grip} form={pr.variant.form} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '15px', fontWeight: '800', color: '#6c63ff', whiteSpace: 'nowrap' }}>
                    {pr.maxReps}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '9px', color: '#999', whiteSpace: 'nowrap', fontFamily: "'Geist Sans', system-ui, sans-serif" }}>
                    {formatDate(pr.date)}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {prs.length === 0 && Object.keys(bwByExercise).length === 0 && (
            <div style={{ color: '#aaa', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
              No PRs yet. Get to work! 💪
            </div>
          )}

          {/* Marker tray */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '18px', justifyContent: 'flex-end' }}>
            {['#3498db', '#e74c3c', '#2ecc71', '#000'].map((color, i) => (
              <div key={i} style={{ width: '28px', height: '8px', borderRadius: '4px', backgroundColor: color, opacity: 0.4 }} />
            ))}
          </div>
        </div>
      </div>
    </SafeSvgHtml>
  )
}
