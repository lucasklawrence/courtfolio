/**
 * The dedupe is the part of the ingest alert that can go wrong expensively: a
 * mistake files a new issue every day a job stays red, which buries the tracker
 * and trains everyone to ignore the label. These pin the rules.
 */
import { describe, expect, it } from 'vitest'

import {
  alertTitle,
  decideAction,
  failureDetails,
  findOpenAlert,
  newAlertBody,
  tailLog,
} from './ingest-alert.mjs'
import { ingestRunRow } from './record-ingest-run.mjs'

describe('findOpenAlert', () => {
  const title = alertTitle('otbeat-ingest')

  it('finds the open issue with the exact title', () => {
    const issues = [
      { number: 7, title: 'ingest failure: staging-sync', state: 'open' },
      { number: 9, title, state: 'open' },
    ]
    expect(findOpenAlert(issues, title)?.number).toBe(9)
  })

  it('does not match a title that only contains the job name', () => {
    // `otbeat-ingest` is a prefix of a hypothetical `otbeat-ingest-v2`.
    const issues = [{ number: 3, title: 'ingest failure: otbeat-ingest-v2', state: 'open' }]
    expect(findOpenAlert(issues, title)).toBeNull()
  })

  it('ignores pull requests, which the issues API lists alongside issues', () => {
    const issues = [{ number: 4, title, state: 'open', pull_request: {} }]
    expect(findOpenAlert(issues, title)).toBeNull()
  })

  it('ignores closed issues, so a new incident gets a fresh thread', () => {
    const issues = [{ number: 5, title, state: 'closed' }]
    expect(findOpenAlert(issues, title)).toBeNull()
  })

  it('keeps using the oldest when duplicates already exist', () => {
    const issues = [
      { number: 12, title, state: 'open' },
      { number: 8, title, state: 'open' },
    ]
    expect(findOpenAlert(issues, title)?.number).toBe(8)
  })
})

describe('decideAction', () => {
  const open = { number: 1, title: 'x' }

  it('files a new issue on the first failure', () => {
    expect(decideAction('failure', null)).toBe('create')
  })

  it('comments, never files again, while an alert is open', () => {
    // Seven red days must produce one issue with seven comments.
    for (let day = 0; day < 7; day++) {
      expect(decideAction('failure', open)).toBe('comment')
    }
  })

  it('treats a cancelled job (timeout) as a failure', () => {
    expect(decideAction('cancelled', null)).toBe('create')
  })

  it('closes an open alert when the job recovers', () => {
    expect(decideAction('success', open)).toBe('close')
  })

  it('does nothing on success with no alert, or when the job was skipped', () => {
    expect(decideAction('success', null)).toBe('none')
    expect(decideAction('skipped', null)).toBe('none')
    expect(decideAction('skipped', open)).toBe('none')
  })
})

describe('tailLog', () => {
  it('strips Actions timestamps and colour codes and keeps the last lines', () => {
    const log = [
      '2026-11-22T15:55:10.0059685Z ',
      '2026-11-22T15:55:10.0060247Z > node scripts/sync-staging.mjs',
      '2026-11-22T15:55:10.0844549Z \u001b[31mfetch failed\u001b[0m',
      '2026-11-22T15:55:10.0975486Z ##[error]Process completed with exit code 2.',
    ].join('\n')
    expect(tailLog(log, 2)).toBe('fetch failed\n##[error]Process completed with exit code 2.')
  })

  it('caps one enormous line by length', () => {
    const tail = tailLog('x'.repeat(50_000))
    expect(tail.length).toBeLessThanOrEqual(6001)
    expect(tail.startsWith('…')).toBe(true)
  })
})

describe('alert bodies', () => {
  const run = {
    job: 'staging-sync',
    result: 'failure',
    runUrl: 'https://github.com/o/r/actions/runs/1',
    failedStep: 'Copy production data into staging',
    logTail: 'fetch failed',
  }

  it('links the run and names the failed step', () => {
    const body = newAlertBody(run)
    expect(body).toContain('[run log](https://github.com/o/r/actions/runs/1)')
    expect(body).toContain('Failed step: **Copy production data into staging**')
    expect(body).toContain('fetch failed')
  })

  it('cannot be broken out of its code fence by the log', () => {
    const body = failureDetails({ ...run, logTail: 'a\n```\n# injected heading' })
    expect(body.match(/```/g)).toHaveLength(2)
  })

  it('says so when the log could not be read', () => {
    expect(failureDetails({ ...run, logTail: null })).toContain('could not be read')
  })
})

describe('ingestRunRow', () => {
  it('links the row to its Actions run', () => {
    expect(
      ingestRunRow('otbeat-ingest', {
        GITHUB_SERVER_URL: 'https://github.com',
        GITHUB_REPOSITORY: 'o/r',
        GITHUB_RUN_ID: '42',
      })
    ).toEqual({ job: 'otbeat-ingest', run_url: 'https://github.com/o/r/actions/runs/42' })
  })

  it('leaves the link empty outside Actions', () => {
    expect(ingestRunRow('otbeat-ingest', {})).toEqual({ job: 'otbeat-ingest', run_url: null })
  })
})
