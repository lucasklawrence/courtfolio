/**
 * Apple Health auto-sync payload from the iPhone Shortcut.
 * One metric per day; null/undefined values are skipped (day had no data).
 */

import { z } from 'zod'

/**
 * Canonical cardio metric → Supabase trend-table mapping. Single source
 * of truth for the write paths: the manual upsert endpoint
 * (`/api/admin/cardio/trends`) and the Apple Health auto-sync endpoint
 * (`/api/health/auto-sync`) both resolve tables through here, so renaming
 * a table touches one line instead of several inline literals. The read
 * path (`lib/data/cardio-shared.ts`) keys its own copy by `CardioData`
 * field name, but the table *values* are the same set.
 */
export const CARDIO_METRIC_TABLES = {
  hrv: 'cardio_hrv_trend',
  walking_hr: 'cardio_walking_hr_trend',
  steps: 'cardio_step_count_trend',
  sleep: 'cardio_sleep_trend',
  active_energy: 'cardio_active_energy_trend',
  body_mass: 'cardio_body_mass_trend',
} as const

/** A cardio lifestyle metric — one of the {@link CARDIO_METRIC_TABLES} keys. */
export type CardioMetric = keyof typeof CARDIO_METRIC_TABLES

export const CardioSyncSchema = z.object({
  /**
   * ISO date string (YYYY-MM-DD), local date the data was collected.
   */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /**
   * Heart rate variability (SDNN), milliseconds. Optional if not collected.
   */
  hrv_ms: z.number().positive().optional().nullable(),

  /**
   * Walking heart rate average, beats per minute. Optional if not collected.
   */
  walking_hr_bpm: z.number().positive().optional().nullable(),

  /**
   * Daily step count. Optional; zero is valid (rest day).
   */
  steps: z.number().nonnegative().optional().nullable(),

  /**
   * Total sleep duration, hours. Optional; zero is valid (no sleep recorded).
   */
  sleep_hours: z.number().nonnegative().optional().nullable(),

  /**
   * Daily active energy burned, kilocalories. Optional; zero is valid (sedentary day).
   */
  active_energy_kcal: z.number().nonnegative().optional().nullable(),

  /**
   * Morning bodyweight, pounds. Optional if not collected. Lets a future
   * source (e.g. a Bluetooth-scale Shortcut) sync weight through the same
   * endpoint; the current HRV/steps Shortcut simply omits it.
   */
  body_mass_lbs: z.number().positive().optional().nullable(),
})

export type CardioSync = z.infer<typeof CardioSyncSchema>

/**
 * Batch endpoint payload — one or more days of data.
 */
export const CardioSyncBatchSchema = z.object({
  data: z.array(CardioSyncSchema),
})

export type CardioSyncBatch = z.infer<typeof CardioSyncBatchSchema>
