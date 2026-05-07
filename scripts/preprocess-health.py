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
  - HRV (SDNN), walking HR average, body mass, step counts, sleep, and
    active energy daily trends — six lifestyle-metric series ported from
    cardio-dashboard (#75 slice C-data). Per-day aggregation policy
    varies by metric — see the per-metric helpers below.

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
from collections import defaultdict
from datetime import datetime, timezone
from typing import Callable, Optional

# Windows defaults stdout to cp1252 under Python 3.8 — `→` and other
# Unicode glyphs in our log lines crash the run. Force UTF-8 so the
# script works the same on macOS / Linux / Windows. Safe no-op on
# already-UTF-8 streams.
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except (ValueError, OSError) as exc:  # pragma: no cover — older streams reject reconfigure
        # Don't swallow silently — surface the failure so a future user
        # whose stream rejects UTF-8 can debug instead of seeing mojibake.
        print(f"  warning: could not reconfigure stdout/stderr to UTF-8: {exc}", file=sys.__stderr__)

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

    # `by_start` keys workouts by startDate so the distance-enrichment
    # block-pass can find them later. Two workouts with identical
    # second-precision startDates would clobber each other under a
    # single-value mapping, so we store a list per key and apply
    # enrichment to every entry in the bucket.
    by_start: dict[str, list[dict]] = {}
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

        start_dt = parse_iso(start)
        end_dt = parse_iso(end)
        if start_dt is None or end_dt is None:
            # Apple emitted an unparseable timestamp — skip rather than
            # write a session with a non-ISO `date` that would fail Zod
            # validation in the wrapper.
            skipped_types[f'{wtype} (bad timestamp)'] = (
                skipped_types.get(f'{wtype} (bad timestamp)', 0) + 1
            )
            continue

        by_start.setdefault(start, []).append({
            'date': start_dt.isoformat(),
            'activity': activity,
            'duration_seconds': round(duration_seconds, 2),
            'distance_meters': None,
            'avg_hr': None,
            'max_hr': None,
            'pace_seconds_per_km': None,
            'hr_seconds_in_zone': None,
            'hr_samples': None,
            'meters_per_heartbeat': None,
            '_start_dt': start_dt,
            '_end_dt': end_dt,
        })

    # Distance comes from a nested <MetadataEntry> or sibling Record inside the block.
    # If a startDate has multiple workouts (rare but possible), apply the
    # extracted distance/elevation to all of them — the block doesn't
    # carry any stable disambiguator we could use to pick just one.
    for m in block_re.finditer(xml_text):
        start = m.group(1)
        content = m.group(2)
        bucket = by_start.get(start)
        if not bucket:
            continue
        for w in bucket:
            apply_block_distance(w, content)

    flat = [w for bucket in by_start.values() for w in bucket]

    if skipped_types:
        for wtype, n in sorted(skipped_types.items(), key=lambda kv: -kv[1]):
            log(f"skipped {n:,} workout(s) of type {wtype}")

    return flat


def apply_block_distance(w: dict, content: str) -> None:
    """Pull distance / elevation aggregates from a single `<Workout>` block into `w` in place."""
    dist_m = re.search(
        r'type="HKQuantityTypeIdentifierDistanceWalkingRunning"[^>]*sum="([^"]*)"', content
    )
    if not dist_m:
        return
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
    """Walk the HR sample stream and fill in avg/max/time-in-zone/efficiency on `workout`.

    Also emits the raw in-window samples on `workout['hr_samples']` so the
    per-session detail page (#165) can render an HR curve over time. The
    aggregate columns (avg/max/zones) stay so existing charts that don't
    need the raw stream don't pay the JSON-size cost of re-deriving them.
    """
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

    # Deduplicate by timestamp before any downstream use. Apple Health
    # exports occasionally include two HR records at the exact same
    # `startDate` (multiple sources writing into the same workout window,
    # or a watch glitch). Left alone, those collide on the
    # `cardio_session_hr_samples` PK `(session_started_at, sample_at)`
    # and the import script's batched insert fails wholesale. Last-write-
    # wins matches the trend-row dedupe in `parse_simple_trend` and is
    # stable because `samples` is already sorted by `dt`.
    deduped: list[tuple[datetime, float]] = []
    for dt, bpm in in_window:
        if deduped and deduped[-1][0] == dt:
            deduped[-1] = (dt, bpm)
        else:
            deduped.append((dt, bpm))

    # Drop malformed BPM values (negative or NaN — `nan >= 0` is False, so
    # one filter handles both). The downstream Zod schema and Postgres
    # `bpm >= 0` CHECK both reject the row, and a single corrupt reading
    # would otherwise abort the entire import; skipping it locally keeps
    # the rest of the session usable. Defensive against weird exports —
    # Apple Watch itself doesn't emit negative HR.
    in_window = [(dt, bpm) for dt, bpm in deduped if bpm >= 0]
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

    # Emit the raw sample stream for the detail page. ISO format with
    # offset matches `session.date`, so the TypeScript side parses both
    # fields with the same code. Round BPM to one decimal — Apple Health
    # emits whole integers but the JS schema accepts numeric, and the
    # one-decimal slack costs nothing while leaving room for future
    # smoothing without a re-import.
    workout['hr_samples'] = [
        {'ts': dt.isoformat(), 'bpm': round(bpm, 1)} for dt, bpm in in_window
    ]

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


def parse_simple_trend(
    xml_text: str,
    hk_type: str,
    value_transform: Optional[Callable[[str, float], Optional[float]]] = None,
) -> list[dict]:
    """
    Generic helper for one-value-per-record trend types (resting HR,
    VO2max, HRV, walking HR, body mass). Collapses to one point per
    calendar day — when Apple emits multiple records for the same day
    (e.g. retroactive measurements from different sources), the latest
    record in document order wins.

    `value_transform` is an optional `(record_str, value) -> value`
    callback for per-record unit normalization (e.g. body mass kg → lb).
    Returning `None` skips the record entirely. Receives the full open
    tag so the callback can read sibling attributes like `unit="..."`.
    """
    pattern = re.compile(
        rf'<Record\b[^>]*type="{re.escape(hk_type)}"[^>]*>'
    )
    by_day: dict[str, float] = {}
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
        if value_transform is not None:
            transformed = value_transform(record, value)
            if transformed is None:
                continue
            value = transformed
        # Trim time-of-day; the trend chart shows one tick per day.
        date_str = date_m.group(1).split(' ')[0]
        by_day[date_str] = round(value, 2)
    return [{'date': day, 'value': value} for day, value in sorted(by_day.items())]


def parse_summed_trend(
    xml_text: str,
    hk_type: str,
    value_transform: Optional[Callable[[str, float], Optional[float]]] = None,
) -> list[dict]:
    """
    Trend helper for record types where Apple emits many small bursts
    per day (step counts, active energy) and we want the daily total.
    Sums every record by its local-date `startDate` rather than
    last-write-wins like {@link parse_simple_trend}.

    `value_transform` is the same shape as `parse_simple_trend`'s — used
    for per-record unit normalization (active energy is normally kcal
    but can arrive as kJ depending on the export source).
    """
    pattern = re.compile(
        rf'<Record\b[^>]*type="{re.escape(hk_type)}"[^>]*>'
    )
    by_day: dict[str, float] = defaultdict(float)
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
        if value_transform is not None:
            transformed = value_transform(record, value)
            if transformed is None:
                continue
            value = transformed
        date_str = date_m.group(1).split(' ')[0]
        by_day[date_str] += value
    return [{'date': day, 'value': round(v, 2)} for day, v in sorted(by_day.items())]


def parse_sleep_trend(xml_text: str) -> list[dict]:
    """
    Sleep trend — per-wake-day total of `Asleep*` time, in hours.

    Apple Health stores sleep as `<Record type="HKCategoryTypeIdentifier
    SleepAnalysis">` elements with categorical `value` like
    `HKCategoryValueSleepAnalysisAsleepCore`,
    `…AsleepDeep`, `…AsleepREM`, `…AsleepUnspecified` (post-iOS 16) or
    just `HKCategoryValueSleepAnalysisAsleep` (pre-iOS 16). `InBed` and
    `Awake` periods exist alongside but are *excluded* — "I got 7 hours
    of sleep" is the more useful metric than "I was in bed 8 hours."

    Day attribution: each block is bucketed by its `endDate`'s local
    date (the "wake day"). A block from 2026-04-15 23:00 to 2026-04-16
    07:00 belongs to 2026-04-16. This matches Apple Health's UI, which
    surfaces "today's sleep" as the night you just woke up from.
    """
    pattern = re.compile(
        r'<Record\b[^>]*type="HKCategoryTypeIdentifierSleepAnalysis"[^>]*>'
    )
    by_wake_day: dict[str, float] = defaultdict(float)
    for m in pattern.finditer(xml_text):
        record = m.group(0)
        val_m = re.search(r'\bvalue="([^"]*)"', record)
        if not val_m:
            continue
        category = val_m.group(1)
        # All asleep variants count toward the daily total. InBed / Awake
        # are intentionally excluded (asleep-only convention).
        if 'Asleep' not in category:
            continue
        start_m = re.search(r'\bstartDate="([^"]*)"', record)
        end_m = re.search(r'\bendDate="([^"]*)"', record)
        if not start_m or not end_m:
            continue
        start_dt = parse_iso(start_m.group(1))
        end_dt = parse_iso(end_m.group(1))
        if start_dt is None or end_dt is None:
            continue
        duration_seconds = (end_dt - start_dt).total_seconds()
        if duration_seconds <= 0:
            continue
        wake_day = end_m.group(1).split(' ')[0]
        by_wake_day[wake_day] += duration_seconds / 3600.0
    return [{'date': day, 'value': round(v, 2)} for day, v in sorted(by_wake_day.items())]


def _body_mass_to_lbs(record: str, value: float) -> Optional[float]:
    """
    Apple Health's body-mass record carries the user's preferred unit
    (`unit="lb"` or `unit="kg"`). Normalize everything to pounds at
    preprocess time so the dashboard renders without a unit-conversion
    step. Unknown units default to lb (Apple's US default) rather than
    silently dropping the record.
    """
    unit_m = re.search(r'\bunit="([^"]*)"', record)
    unit = (unit_m.group(1) if unit_m else 'lb').lower()
    if unit == 'kg':
        return value * 2.20462
    if unit in ('lb', 'lbs'):
        return value
    return value


def _active_energy_to_kcal(record: str, value: float) -> Optional[float]:
    """
    Apple Health's active-energy record is normally kcal (Cal in the
    UI) but some exports carry kJ. Normalize to kilocalories so the
    daily-total chart's units stay consistent across exports.
    """
    unit_m = re.search(r'\bunit="([^"]*)"', record)
    unit = (unit_m.group(1) if unit_m else 'kcal').lower()
    if unit == 'kj':
        return value / 4.184
    return value


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

    log("Parsing HRV (SDNN) trend...", end='')
    hrv = parse_simple_trend(xml_text, 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN')
    log(f" {len(hrv):,} points")

    log("Parsing walking HR trend...", end='')
    walking_hr = parse_simple_trend(
        xml_text, 'HKQuantityTypeIdentifierWalkingHeartRateAverage'
    )
    log(f" {len(walking_hr):,} points")

    log("Parsing body mass trend...", end='')
    body_mass = parse_simple_trend(
        xml_text, 'HKQuantityTypeIdentifierBodyMass', value_transform=_body_mass_to_lbs
    )
    log(f" {len(body_mass):,} points (lbs)")

    log("Parsing step count trend...", end='')
    step_count = parse_summed_trend(xml_text, 'HKQuantityTypeIdentifierStepCount')
    log(f" {len(step_count):,} days")

    log("Parsing sleep trend...", end='')
    sleep = parse_sleep_trend(xml_text)
    log(f" {len(sleep):,} nights")

    log("Parsing active energy trend...", end='')
    active_energy = parse_summed_trend(
        xml_text,
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        value_transform=_active_energy_to_kcal,
    )
    log(f" {len(active_energy):,} days (kcal)")

    return {
        'imported_at': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'sessions': sessions,
        'resting_hr_trend': resting,
        'vo2max_trend': vo2,
        'hrv_trend': hrv,
        'walking_hr_trend': walking_hr,
        'body_mass_trend': body_mass,
        'step_count_trend': step_count,
        'sleep_trend': sleep,
        'active_energy_trend': active_energy,
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
    print("  Apple Health → courtfolio cardio.json")
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
    print("  Done!")
    print(f"  Output: {output_path} ({out_size:.0f} KB)")
    print(f"  Sessions:           {len(data['sessions']):,}")
    print(f"  Resting HR points:  {len(data['resting_hr_trend']):,}")
    print(f"  VO2max points:      {len(data['vo2max_trend']):,}")
    print(f"  HRV points:         {len(data['hrv_trend']):,}")
    print(f"  Walking HR points:  {len(data['walking_hr_trend']):,}")
    print(f"  Body mass points:   {len(data['body_mass_trend']):,}")
    print(f"  Step count days:    {len(data['step_count_trend']):,}")
    print(f"  Sleep nights:       {len(data['sleep_trend']):,}")
    print(f"  Active energy days: {len(data['active_energy_trend']):,}")
    print(f"{'=' * 50}\n")


if __name__ == '__main__':
    main()
