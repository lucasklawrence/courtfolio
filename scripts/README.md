# scripts

## `import-health`

`npm run import-health -- path/to/export.zip`

Reads an Apple Health `export.zip` (the file you get from Health → Profile → Export All Health Data on iOS) and writes `public/data/cardio.json` — the dataset the Gym detail views consume via `getCardioData()` (`lib/data/cardio.ts`).

The wrapper does two things:

1. Spawns `python scripts/preprocess-health.py <export.zip> public/data/cardio.json` to produce the JSON.
2. Validates the result against a Zod mirror of `CardioData` (`types/cardio.ts`) so any drift between the Python script and the TypeScript type fails loudly here, not at runtime in the dashboard.

### Optional flags

- `--max-hr=185` — your max heart rate (BPM), used to bucket samples into the five Z1–Z5 zones. Defaults to 185 (matches `DEFAULT_MAX_HR` in `constants/hr-zones.ts`). Pass a measured max from a treadmill test if you have one.

### What lands in `cardio.json`

Just the three things `CardioData` defines:

- `sessions` — stair / running / walking workouts with avg HR, max HR, time-in-zone breakdown, and cardiac efficiency aggregated from the raw HR sample stream
- `resting_hr_trend` — one point per measurement
- `vo2max_trend` — one point per measurement

Everything else from the Apple Health export (HRV, walking HR average, body mass, step counts, sleep, active energy, plus non-tracked workout types like cycling and rowing) is dropped. Bring fields back when a chart consumes them.

### Privacy

`public/data/cardio.json` is **gitignored** because Apple Health exports include personal medical metrics. The empty `public/data/.gitkeep` keeps the directory in the repo without committing the data. Re-run the import on each deploy (or commit a sanitized fixture for previews if you want one).

### Requirements

- Python 3.9+ on `PATH` (override with `PYTHON=…` if needed)
- The repo's `node_modules` (zod is used by the validator)
