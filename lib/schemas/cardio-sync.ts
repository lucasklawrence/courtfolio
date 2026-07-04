/**
 * Apple Health auto-sync payload from the iPhone Shortcut.
 * One metric per day; null/undefined values are skipped (day had no data).
 */

import { z } from 'zod'

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
})

export type CardioSync = z.infer<typeof CardioSyncSchema>

/**
 * Batch endpoint payload — one or more days of data.
 */
export const CardioSyncBatchSchema = z.object({
  data: z.array(CardioSyncSchema),
})

export type CardioSyncBatch = z.infer<typeof CardioSyncBatchSchema>
