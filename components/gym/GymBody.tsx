'use client'

import React, { useState, useCallback } from 'react'
import { SvgLayoutContainer } from '@/components/common/SvgLayoutContainer'
import { GymSvg } from './GymSvg'
import { ZoneWorkoutLog } from './zones/ZoneWorkoutLog'
import { ZonePRBoard } from './zones/ZonePRBoard'
import { ZoneBodyWeight } from './zones/ZoneBodyWeight'
import { ZoneStats } from './zones/ZoneStats'
import { LoginModal } from './LoginModal'
import { AddWorkoutModal } from './AddWorkoutModal'
import { CourtZone } from '@/components/court/CourtZone'
import { SafeSvgHtml } from '@/components/common/SafeSvgHtml'
import {
  WORKOUTS,
  computePRs,
  computeBodyweightPRs,
  getBodyWeightEntries,
  getWorkoutsForPeriod,
} from '@/constants/gymData'
import type { Period } from '@/constants/gymData'
import { useAuth } from '@/utils/hooks/useAuth'
import Link from 'next/link'

export function GymBody() {
  const [period, setPeriod] = useState<Period>('weekly')
  const [showLogin, setShowLogin] = useState(false)
  const [showAddWorkout, setShowAddWorkout] = useState(false)
  const { user, signOut } = useAuth()

  // When a workout is saved we'll eventually refetch from Supabase here
  const handleWorkoutSaved = useCallback(() => {
    // TODO: trigger refetch when Supabase data layer is live
  }, [])

  const filteredWorkouts = getWorkoutsForPeriod(WORKOUTS, period)
  const prs = computePRs(WORKOUTS)
  const bodyweightPRs = computeBodyweightPRs(WORKOUTS)
  const bodyWeightEntries = getBodyWeightEntries(WORKOUTS)
  const today = new Date().toISOString().slice(0, 10)

  const zoneContent = {
    // Left panel — Workout Log
    'workout-log': (
      <CourtZone x={150} y={80} width={455} height={755}>
        <ZoneWorkoutLog
          workouts={filteredWorkouts}
          period={period}
          onPeriodChange={setPeriod}
          allWorkouts={WORKOUTS}
          today={today}
        />
      </CourtZone>
    ),

    // Center panel — PR Board
    'pr-board': (
      <CourtZone x={625} y={58} width={486} height={777}>
        <ZonePRBoard prs={prs} bodyweightPRs={bodyweightPRs} />
      </CourtZone>
    ),

    // Right panel — Body Weight
    'body-weight': (
      <CourtZone x={1131} y={80} width={380} height={755}>
        <ZoneBodyWeight entries={bodyWeightEntries} />
      </CourtZone>
    ),

    // Auth + Add button — top right corner
    'auth-controls': (
      <CourtZone x={1360} y={10} width={160} height={40}>
        <SafeSvgHtml>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            {user ? (
              <>
                <button
                  onClick={() => setShowAddWorkout(true)}
                  style={{
                    padding: '5px 12px', fontSize: '11px', fontWeight: '700',
                    backgroundColor: '#e07b39', color: 'white', border: 'none',
                    borderRadius: '999px', cursor: 'pointer',
                  }}
                >
                  + Log
                </button>
                <button
                  onClick={signOut}
                  title="Sign out"
                  style={{
                    padding: '5px 8px', fontSize: '11px',
                    backgroundColor: '#1a1a1a', color: '#666', border: '1px solid #2a2a2a',
                    borderRadius: '999px', cursor: 'pointer',
                  }}
                >
                  🔓
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                title="Admin login"
                style={{
                  padding: '5px 8px', fontSize: '11px',
                  backgroundColor: '#1a1a1a', color: '#555', border: '1px solid #2a2a2a',
                  borderRadius: '999px', cursor: 'pointer',
                }}
              >
                🔒
              </button>
            )}
          </div>
        </SafeSvgHtml>
      </CourtZone>
    ),

    // Back button
    'back-button': (
      <CourtZone x={640} y={870} width={256} height={46}>
        <SafeSvgHtml>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
            <Link
              href="/"
              style={{
                padding: '6px 18px', fontSize: '12px', borderRadius: '999px',
                backgroundColor: '#111', color: 'white', textDecoration: 'none',
                whiteSpace: 'nowrap', border: '1px solid #333',
              }}
              onMouseOver={e => ((e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#e07b39')}
              onMouseOut={e => ((e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#111')}
            >
              🏀 Back to Home Court
            </Link>
          </div>
        </SafeSvgHtml>
      </CourtZone>
    ),
  }

  return (
    <>
      <SvgLayoutContainer>
        <GymSvg zoneContent={zoneContent} />
        {/* Stats overlay — rendered as HTML over the SVG */}
        <ZoneStats workouts={WORKOUTS} />
      </SvgLayoutContainer>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showAddWorkout && (
        <AddWorkoutModal
          onClose={() => setShowAddWorkout(false)}
          onSaved={handleWorkoutSaved}
        />
      )}
    </>
  )
}
