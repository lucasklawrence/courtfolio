'use client'

import React from 'react'
import { SafeSvgHtml } from '@/components/common/SafeSvgHtml'
import type { BodyWeightEntry } from '@/constants/gymData'

type Props = {
  entries: BodyWeightEntry[]
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Renders a simple sparkline SVG from body weight entries */
function MiniChart({ entries }: { entries: BodyWeightEntry[] }) {
  if (entries.length < 2) return null

  const W = 300
  const H = 80
  const PAD = 8

  const weights = entries.map(e => e.weightLbs)
  const minW = Math.min(...weights) - 2
  const maxW = Math.max(...weights) + 2

  const toX = (i: number) => PAD + (i / (entries.length - 1)) * (W - PAD * 2)
  const toY = (w: number) => H - PAD - ((w - minW) / (maxW - minW)) * (H - PAD * 2)

  const points = entries.map((e, i) => `${toX(i)},${toY(e.weightLbs)}`).join(' ')
  const areaPoints = [
    `${toX(0)},${H}`,
    ...entries.map((e, i) => `${toX(i)},${toY(e.weightLbs)}`),
    `${toX(entries.length - 1)},${H}`,
  ].join(' ')

  const last = entries[entries.length - 1]
  const prev = entries[entries.length - 2]
  const trend = last.weightLbs - prev.weightLbs

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '80px' }}>
        {/* Area fill */}
        <polygon points={areaPoints} fill="rgba(224, 123, 57, 0.15)" />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#e07b39"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {entries.map((e, i) => (
          <circle key={i} cx={toX(i)} cy={toY(e.weightLbs)} r="3" fill="#e07b39" />
        ))}
        {/* Latest dot highlight */}
        <circle
          cx={toX(entries.length - 1)}
          cy={toY(last.weightLbs)}
          r="5"
          fill="#e07b39"
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>

      {/* X-axis labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
        <span style={{ fontSize: '9px', color: '#555' }}>{formatDate(entries[0].date)}</span>
        <span
          style={{
            fontSize: '9px',
            color: trend <= 0 ? '#2ecc71' : '#e74c3c',
            fontWeight: '600',
          }}
        >
          {trend > 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)} lbs
        </span>
        <span style={{ fontSize: '9px', color: '#555' }}>{formatDate(last.date)}</span>
      </div>
    </div>
  )
}

export function ZoneBodyWeight({ entries }: Props) {
  const latest = entries[entries.length - 1]
  const oldest = entries[0]
  const totalChange = latest && oldest ? latest.weightLbs - oldest.weightLbs : 0

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
          <div
            style={{
              fontSize: '11px',
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}
          >
            ⚖️ Body Weight
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
          {/* Current weight hero */}
          {latest && (
            <div
              style={{
                textAlign: 'center',
                padding: '16px 0',
                borderBottom: '1px solid #1e1e1e',
                marginBottom: '14px',
              }}
            >
              <div style={{ fontSize: '36px', fontWeight: '800', color: '#e07b39', lineHeight: 1 }}>
                {latest.weightLbs}
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>lbs</div>
              <div style={{ fontSize: '10px', color: '#555', marginTop: '6px' }}>
                as of {formatDate(latest.date)}
              </div>
            </div>
          )}

          {/* Sparkline chart */}
          {entries.length >= 2 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '10px', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Trend
              </div>
              <MiniChart entries={entries} />
            </div>
          )}

          {/* Stats grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '14px',
            }}
          >
            <StatBox label="Entries" value={`${entries.length}`} />
            <StatBox
              label="Total Change"
              value={`${totalChange > 0 ? '+' : ''}${totalChange.toFixed(1)} lbs`}
              valueColor={totalChange <= 0 ? '#2ecc71' : '#e74c3c'}
            />
            {oldest && <StatBox label="Starting" value={`${oldest.weightLbs} lbs`} />}
            {latest && entries.length > 1 && (
              <StatBox label="Current" value={`${latest.weightLbs} lbs`} valueColor="#e07b39" />
            )}
          </div>

          {/* Entry list */}
          <div style={{ fontSize: '10px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            Log
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[...entries].reverse().map((entry, i) => (
              <div
                key={entry.date}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '5px 8px',
                  backgroundColor: i === 0 ? '#1e1e1e' : 'transparent',
                  borderRadius: '4px',
                }}
              >
                <span style={{ fontSize: '11px', color: '#888' }}>{formatDate(entry.date)}</span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: i === 0 ? '700' : '400',
                    color: i === 0 ? '#e07b39' : '#ccc',
                  }}
                >
                  {entry.weightLbs} lbs
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SafeSvgHtml>
  )
}

function StatBox({
  label,
  value,
  valueColor = '#e0e0e0',
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        backgroundColor: '#141414',
        border: '1px solid #222',
        borderRadius: '6px',
        padding: '8px 10px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '9px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', fontWeight: '700', color: valueColor }}>
        {value}
      </div>
    </div>
  )
}
