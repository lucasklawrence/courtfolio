// TARGET PATH: src/ui/CoachClipboard.tsx
'use client'

import { useUserPrefs } from '../prefs/PreferencesProvider'

export function CoachClipboard() {
  const { prefs, updatePrefs } = useUserPrefs()

  return (
    <details className="fixed bottom-4 right-4 z-50 rounded bg-white p-3 shadow-sm">
      <summary className="cursor-pointer select-none text-sm font-semibold">
        Coach Clipboard
      </summary>
      <div className="mt-2">
        <label className="mb-1 block text-xs font-medium text-gray-600">Motion</label>
        <select
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          value={prefs.motion}
          onChange={event => updatePrefs({ motion: event.target.value as typeof prefs.motion })}
        >
          <option value="cinematic">Cinematic</option>
          <option value="quick">Quick</option>
          <option value="off">Off</option>
          <option value="system">System</option>
        </select>
      </div>
    </details>
  )
}
