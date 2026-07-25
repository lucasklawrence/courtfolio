/**
 * Unit tests for the migration drift check (#334 follow-up).
 *
 * Only the pure comparison is covered — reading the ledger needs a live
 * service-role connection, so it stays out of the unit suite.
 */
import { describe, expect, it } from 'vitest'

import { diffMigrations, migrationName } from './check-migration-drift.mjs'

describe('migrationName', () => {
  it('strips the version prefix and the extension', () => {
    expect(migrationName('20260430120000_cardio_tables.sql')).toBe('cardio_tables')
  })

  it('keeps underscores inside the name itself', () => {
    expect(migrationName('20260704120000_otf_sessions_class_type.sql')).toBe(
      'otf_sessions_class_type'
    )
  })

  it('leaves a name with no version prefix alone', () => {
    expect(migrationName('adhoc_fix.sql')).toBe('adhoc_fix')
  })
})

describe('diffMigrations', () => {
  it('reports in-sync when both sides carry the same names', () => {
    // Deliberately different orders: the filename stamp and the applied version
    // are unrelated, so only set membership can be compared.
    const result = diffMigrations(['cardio_tables', 'otf_sessions'], ['otf_sessions', 'cardio_tables'])
    expect(result).toEqual({ pending: [], untracked: [], inSync: true })
  })

  it('flags a committed migration that was never applied', () => {
    // The #271 shape: the file lands but the ledger never records it.
    const result = diffMigrations(['cardio_tables', 'weight_room_achievements'], ['cardio_tables'])
    expect(result.pending).toEqual(['weight_room_achievements'])
    expect(result.untracked).toEqual([])
    expect(result.inSync).toBe(false)
  })

  it('flags an applied migration with no file, which the repo cannot rebuild', () => {
    // The movement_benchmarks shape.
    const result = diffMigrations(['cardio_tables'], ['create_movement_benchmarks', 'cardio_tables'])
    expect(result.untracked).toEqual(['create_movement_benchmarks'])
    expect(result.pending).toEqual([])
    expect(result.inSync).toBe(false)
  })

  it('reports both directions at once', () => {
    const result = diffMigrations(['a', 'b'], ['b', 'c'])
    expect(result.pending).toEqual(['a'])
    expect(result.untracked).toEqual(['c'])
    expect(result.inSync).toBe(false)
  })

  it('treats empty repo and ledger as in sync', () => {
    expect(diffMigrations([], []).inSync).toBe(true)
  })
})
