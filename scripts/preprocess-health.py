#!/usr/bin/env python3
"""
Apple Health export → courtfolio cardio.json preprocessor (PRD §7.3).

Reads an Apple Health `export.zip` (or raw `export.xml`) and writes a
compact JSON file matching the `CardioData` interface in
`types/cardio.ts`. The output is what the Gym detail views read at
runtime via `getCardioData()` (`lib/data/cardio.ts`).

What we keep (per `CardioData`):
  - Cardio sessions (stair / running / walking only, per the v1 Gym
    detail views), each with avg/max HR, time-in-zone breakdown, and
    cardiac efficiency aggregated from the raw heart-rate sample stream.
  - Resting heart-rate trend (one point per measurement).
  - VO2max trend (one point per measurement).

What we drop (in the old script but not in `CardioData` yet):
  - HRV, walking HR average, body mass, step counts, sleep, active
    energy. Bring these back when a chart needs them.

The Node wrapper (`scripts/import-health.mjs`) validates the output
against a Zod mirror of `CardioData`, so a divergence between the
Python output shape and the TypeScript type fails loudly at import
time instead of silently breaking the dashboard at runtime.

Usage (called by the Node wrapper, but works standalone):
    python preprocess-health.py <input.zip|input.xml> <output.json> [--max-hr=185]
"""

from __future__ import annotations

import json
import os
import re
import sys
import zipfile
from datetime import datetime, timezone

# Windows defaults stdout to cp1252 under Python 3.8 — `→` and other
# Unicode glyphs in our log lines crash the run. Force UTF-8 so the
# script works the same on macOS / Linux / Windows. Safe no-op on
# already-UTF-8 streams.
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:  # pragma: no cover — older streams without reconfigure
        pass

# Mirror of constants/hr-zones.ts — keep in sync. Z5's upper bound is
# inclusive in JS; here we use `<=` for the same reason. A sample at
# exactly 100% maxHR ends up in Z5 instead of falling through.
HR_ZONES: list[tuple[int, float, float]] = [
    (1, 0.50, 0.60),
    (2, 0.60, 0.70),
    (3, 0.70, 0.80),
    (4, 0.80, 0.90),
    (5, 0.90, 1.00),
]
DEFAULT_MAX_HR = 185

# Activity type filter — only these three Gym surfaces exist in v1.
# Anything else (cycling, hiking, elliptical, rowing, swimming) is
# dropped with a logged warning rather than coerced into one of these.
ACTIVITY_MAP: dict[str, str] = {
    'HKWorkoutActivityTypeStairClimbing': 'stair',
    'HKWorkoutActivityTypeStairs': 'stair',
    'HKWorkoutActivityTypeStepperMachine': 'stair',
    'HKWorkoutActivityTypeStairStepper': 'stair',
    'HKWorkoutActivityTypeRunning': 'running',
    'HKWorkoutActivityTypeWalking': 'walking',
}

# Cap the inferred dwell time between consecutive HR samples. Apple
# Health samples are ~1/min when sedentary, ~10s during workouts; if
# the gap is huge (e.g. watch off), don't credit a single sample with
# an unreasonable amount of time-in-zone.
MAX_DWELL_SECONDS = 30.0


def log(msg: str, end: str = '\n') -> None:
    print(f"  {msg}", end=end, flush=True)


def parse_iso(value: str) -> datetime | None:
    """
    Apple Health timestamps look like `2026-04-15 08:32:18 -0700` — space
    between date/time, space-prefixed offset, no colon in the offset.
    Python 3.8's `fromisoformat` rejects that shape, so use `strptime`
    with `%z` (which does accept `±HHMM` since 3.7).
    """
    try:
        return datetime.strptime(value, '%Y-%m-%d %H:%M:%S %z')
    except (ValueError, TypeError):
        return None


def zone_for_bpm(bpm: float, max_hr: int) -> int | None:
    """Bucket a single BPM sample into Z1–Z5. Returns None for sub-Z1 (resting)."""
    if max_hr <= 0:
        return None
    pct = bpm / max_hr
    for zone_id, lo, hi in HR_ZONES:
        is_last = zone_id == 5
        if pct >= lo and (pct <= hi if is_last else pct < hi):
            return zone_id
    if pct > 1:
        return 5  # sensor glitch — clamp to the top zone
    return None


def parse_workouts(xml_text: str) -> list[dict]:
    """Extract cardio workouts in our three tracked activities, with raw start/end."""
    open_re = re.compile(r'<Workout\s([^>]+)>')
    block_re = re.compile(r'<Workout\s[^>]*startDate="([^"]*)"[^>]*>([\s\S]*?)</Workout>')

    by_start: dict[str, dict] = {}
    skipped_types: dict[str, int] = {}

    for m in open_re.finditer(xml_text):
        attrs = m.group(1)

        def get(name: str) -> str | None:
            am = re.search(rf'{name}="([^"]*)"', attrs)
            return am.group(1) if am else None

        wtype = get('workoutActivityType')
        start = get('startDate')
        end = get('endDate')
        if not wtype or not start or not end:
            continue

        activity = ACTIVITY_MAP.get(wtype)
        if not activity:
            skipped_types[wtype] = skipped_types.get(wtype, 0) + 1
            continue

        duration = float(get('duration') or 0)
        duration_unit = (get('durationUnit') or 'min').lower()
        if duration_unit == 'min':
            duration_seconds = duration * 60
        elif duration_unit == 'sec':
            duration_seconds = duration
        elif duration_unit == 'hr':
            duration_seconds = duration * 3600
        else:
            duration_seconds = duration * 60  # assume minutes if unknown

        by_start[start] = {
            'date': start,
            'activity': activity,
            'duration_seconds': round(duration_seconds, 2),
            'distance_meters': None,
            'avg_hr': None,
            'max_hr': None,
            'pace_seconds_per_km': None,
            'hr_seconds_in_zone': None,
            'meters_per_heartbeat': None,
            '_start_dt': parse_iso(start),
            '_end_dt': parse_iso(end),
        }

    # Distance comes from a nested <MetadataEntry> or sibling Record inside the block.
    for m in block_re.finditer(xml_text):
        start = m.group(1)
        content = m.group(2)
        w = by_start.get(start)
        if not w:
            continue

        dist_m = re.search(
            r'type="HKQuantityTypeIdentifierDistanceWalkingRunning"[^>]*sum="([^"]*)"', content
        )
        if dist_m:
            unit_m = re.search(
                r'type="HKQuantityTypeIdentifierDistanceWalkingRunning"[^>]*unit="([^"]*)"', content
            )
            unit = unit_m.group(1) if unit_m else 'km'
            val = float(dist_m.group(1))
            if unit == 'mi':
                meters = val * 1609.34
            elif unit == 'km':
                meters = val * 1000.0
            elif unit == 'm':
                meters = val
            else:
                meters = val * 1000.0  # unknown unit — assume km
            w['distance_meters'] = round(meters, 2)

    if skipped_types:
        for wtype, n in sorted(skipped_types.items(), key=lambda kv: -kv[1]):
            log(f"skipped {n:,} workout(s) of type {wtype}")

    return list(by_start.values())


def parse_hr_samples(xml_text: str) -> list[dict]:
    """Heart rate samples — `(datetime, bpm)`. Sorted by time."""
    log("Parsing heart-rate samples...", end='')
    # Match the whole Record open-tag, then pluck attributes individually.
    # Apple Health doesn't guarantee a stable attribute order across exports
    # (older devices put `type` first, newer ones put `sourceName` first), so
    # the strict positional form silently misses data.
    record_re = re.compile(
        r'<Record\b[^>]*type="HKQuantityTypeIdentifierHeartRate"[^>]*>'
    )
    samples: list[dict] = []
    for m in record_re.finditer(xml_text):
        record = m.group(0)
        date_m = re.search(r'\bstartDate="([^"]*)"', record)
        val_m = re.search(r'\bvalue="([^"]*)"', record)
        if not date_m or not val_m:
            continue
        dt = parse_iso(date_m.group(1))
        if dt is None:
            continue
        try:
            bpm = float(val_m.group(1))
        except ValueError:
            continue
        samples.append({'dt': dt, 'bpm': bpm})
    samples.sort(key=lambda s: s['dt'])
    log(f" {len(samples):,} found")
    return samples


def aggregate_session_hr(workout: dict, samples: list[dict], max_hr: int) -> None:
    """Walk the HR sample stream and fill in avg/max/time-in-zone/efficiency on `workout`."""
    start_dt = workout['_start_dt']
    end_dt = workout['_end_dt']
    if start_dt is None or end_dt is None:
        return

    in_window: list[tuple[datetime, float]] = []
    for s in samples:
        if s['dt'] < start_dt:
            continue
        if s['dt'] > end_dt:
            break
        in_window.append((s['dt'], s['bpm']))

    if not in_window:
        return

    bpms = [bpm for _, bpm in in_window]
    workout['avg_hr'] = round(sum(bpms) / len(bpms), 1)
    workout['max_hr'] = round(max(bpms), 1)

    # Walk consecutive samples; the dwell time is the gap to the next
    # (capped) and gets credited to the zone of the *current* sample.
    seconds_in_zone: dict[int, float] = {1: 0.0, 2: 0.0, 3: 0.0, 4: 0.0, 5: 0.0}
    total_heartbeats = 0.0
    for i, (dt, bpm) in enumerate(in_window):
        if i + 1 < len(in_window):
            gap = (in_window[i + 1][0] - dt).total_seconds()
        else:
            gap = (end_dt - dt).total_seconds()
        dwell = max(0.0, min(gap, MAX_DWELL_SECONDS))
        total_heartbeats += bpm * dwell / 60.0
        zone = zone_for_bpm(bpm, max_hr)
        if zone is not None:
            seconds_in_zone[zone] += dwell

    workout['hr_seconds_in_zone'] = {str(z): round(v, 1) for z, v in seconds_in_zone.items()}

    if workout['distance_meters'] and total_heartbeats > 0:
        workout['meters_per_heartbeat'] = round(workout['distance_meters'] / total_heartbeats, 4)


def derive_pace(workout: dict) -> None:
    """`pace_seconds_per_km = duration_seconds / km`. Only meaningful for running/walking."""
    if workout['activity'] == 'stair':
        return
    distance = workout['distance_meters']
    duration = workout['duration_seconds']
    if not distance or distance <= 0 or not duration or duration <= 0:
        return
    km = distance / 1000.0
    workout['pace_seconds_per_km'] = round(duration / km, 2)


def parse_simple_trend(xml_text: str, hk_type: str) -> list[dict]:
    """Generic helper for one-value-per-record trend types (resting HR, VO2max)."""
    pattern = re.compile(
        rf'<Record\b[^>]*type="{re.escape(hk_type)}"[^>]*>'
    )
    out: list[dict] = []
    for m in pattern.finditer(xml_text):
        record = m.group(0)
        date_m = re.search(r'\bstartDate="([^"]*)"', record)
        val_m = re.search(r'\bvalue="([^"]*)"', record)
        if not date_m or not val_m:
            continue
        try:
            value = float(val_m.group(1))
        except ValueError:
            continue
        # Trim time-of-day for trend display — one point per calendar day is plenty.
        date_str = date_m.group(1).split(' ')[0]
        out.append({'date': date_str, 'value': round(value, 2)})
    return out


def build_cardio_data(xml_text: str, max_hr: int) -> dict:
    workouts = parse_workouts(xml_text)
    log(f"Parsed {len(workouts):,} cardio workouts (stair/running/walking)")

    samples = parse_hr_samples(xml_text)

    log("Aggregating per-session HR / time-in-zone / efficiency...")
    for w in workouts:
        aggregate_session_hr(w, samples, max_hr)
        derive_pace(w)

    # Strip private parsing fields before serializing.
    sessions = []
    for w in workouts:
        sessions.append({k: v for k, v in w.items() if not k.startswith('_')})

    log("Parsing resting HR trend...", end='')
    resting = parse_simple_trend(xml_text, 'HKQuantityTypeIdentifierRestingHeartRate')
    log(f" {len(resting):,} points")

    log("Parsing VO2max trend...", end='')
    vo2 = parse_simple_trend(xml_text, 'HKQuantityTypeIdentifierVO2Max')
    log(f" {len(vo2):,} points")

    return {
        'imported_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'sessions': sessions,
        'resting_hr_trend': resting,
        'vo2max_trend': vo2,
    }


def read_xml(input_path: str) -> str:
    if input_path.lower().endswith('.zip'):
        log("Opening ZIP archive...")
        with zipfile.ZipFile(input_path, 'r') as zf:
            xml_name = next(
                (n for n in zf.namelist() if n.lower().endswith('export.xml')),
                None,
            )
            if xml_name is None:
                xml_name = next(
                    (n for n in zf.namelist() if n.lower().endswith('.xml')),
                    None,
                )
            if xml_name is None:
                raise SystemExit("  No export.xml found in ZIP.")
            log(f"Reading {xml_name}...")
            return zf.read(xml_name).decode('utf-8')

    log("Reading XML file...")
    with open(input_path, 'r', encoding='utf-8') as f:
        return f.read()


def main() -> None:
    args = sys.argv[1:]
    max_hr = DEFAULT_MAX_HR
    positional: list[str] = []
    for a in args:
        if a.startswith('--max-hr='):
            try:
                max_hr = int(a.split('=', 1)[1])
            except ValueError:
                raise SystemExit(f"Invalid --max-hr value: {a}")
        else:
            positional.append(a)

    if len(positional) < 2:
        print("Usage: python preprocess-health.py <export.zip|export.xml> <output.json> [--max-hr=185]")
        sys.exit(1)

    input_path, output_path = positional[0], positional[1]
    if not os.path.exists(input_path):
        raise SystemExit(f"  Input not found: {input_path}")

    file_size = os.path.getsize(input_path) / 1024 / 1024
    print(f"\n{'=' * 50}")
    print(f"  Apple Health → courtfolio cardio.json")
    print(f"{'=' * 50}")
    print(f"  Input:  {input_path} ({file_size:.1f} MB)")
    print(f"  Output: {output_path}")
    print(f"  Max HR: {max_hr} BPM")
    print()

    xml_text = read_xml(input_path)
    log(f"XML size: {len(xml_text) / 1024 / 1024:.0f} MB")

    data = build_cardio_data(xml_text, max_hr)

    os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))

    out_size = os.path.getsize(output_path) / 1024
    print(f"\n{'=' * 50}")
    print(f"  Done!")
    print(f"  Output: {output_path} ({out_size:.0f} KB)")
    print(f"  Sessions:           {len(data['sessions']):,}")
    print(f"  Resting HR points:  {len(data['resting_hr_trend']):,}")
    print(f"  VO2max points:      {len(data['vo2max_trend']):,}")
    print(f"{'=' * 50}\n")


if __name__ == '__main__':
    main()
