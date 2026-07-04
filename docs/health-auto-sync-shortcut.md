# Apple Health Auto-Sync Shortcut Setup

This guide walks you through building an Apple Shortcut on your iPhone 14 that automatically syncs your Apple Health data (HRV, walking HR, steps, sleep, active energy) to your personal Supabase database daily.

## Prerequisites

1. **Apple Shortcut app** installed on iPhone 14 (comes preloaded on iOS 17+)
2. **Health app** permission to read HRV, walking HR, step count, sleep, and active energy
3. **API key** set in your environment variables:
   - Add `HEALTH_AUTO_SYNC_API_KEY=<your-secret-key>` to `.env.local` (locally) and Vercel env vars
   - Generate a strong random key: `openssl rand -hex 32`
4. **Domain/URL** where your Next.js app is deployed (e.g. `https://yourdomain.com`)

## Shortcut Logic

The Shortcut will run daily at a fixed time (e.g., 2:00 AM) and:

1. **Get today's local date** (YYYY-MM-DD format)
2. **Query HealthKit** for each metric from the past 24 hours
3. **Aggregate to daily values**:
   - HRV: latest sample (or average if you prefer consistency)
   - Walking HR: latest sample (or average)
   - Steps: sum of all steps
   - Sleep: sum of all "Asleep" time blocks
   - Active energy: sum of all active energy samples
4. **POST to the endpoint** at `https://yourdomain.com/api/health/auto-sync`
5. **Handle success/failure** with a notification

## Building the Shortcut Step-by-Step

### 1. Create a new Shortcut

Open the **Shortcuts** app and tap **Create Shortcut**.

### 2. Add an Automation Trigger

1. Tap the **Automation** tab (bottom of the Shortcuts app)
2. Tap **+** to create a new personal automation
3. Select **Time of Day**
4. Set the time to **2:00 AM** (or your preferred time)
5. Toggle **Notify When Run** off (unless you want a notification)
6. Tap **Done**
7. Tap **Add Action** to start building the automation

### 3. Build the Shortcut Actions

Add the following actions in order:

#### 3.1: Get the current local date

```
Ask "What is today's date?" (YYYY-MM-DD)
   → Or use: Get current date, format as YYYY-MM-DD
   → Set variable "today" to result
```

Actually, use this simpler approach:

```
Get Current Date
Format: Custom Format (YYYY-MM-DD)
Set variable: "today"
```

Or use the **Get Dates from Text** action if you prefer:
```
Get Current Date
→ Format Date: "2026-07-04" style
→ Set variable: "today"
```

#### 3.2: Query HRV

```
Ask for [Heart Rate Variability] from Health
   Sample Type: Heart Rate Variability
   Timeframe: Last 1 Day
   Sort By: Most Recent
   → Take First Item
   → Set variable: "hrv_value"
```

If there's no result, the variable is empty; the endpoint will skip it.

#### 3.3: Query Walking HR

```
Ask for [Walking Heart Rate] from Health
   Sample Type: Walking Heart Rate Average
   Timeframe: Last 1 Day
   Sort By: Most Recent
   → Take First Item
   → Set variable: "walking_hr_value"
```

#### 3.4: Query Steps (sum)

```
Ask for [Steps] from Health
   Sample Type: Steps
   Timeframe: Last 1 Day
   → Get Total
   → Set variable: "steps_value"
```

#### 3.5: Query Sleep (sum)

```
Ask for [Sleep] from Health
   Sample Type: Sleep
   Timeframe: Last 1 Day
   → Get Total (this sums only "Asleep" time, not in-bed)
   → Set variable: "sleep_value"
```

#### 3.6: Query Active Energy (sum)

```
Ask for [Active Energy] from Health
   Sample Type: Active Energy
   Timeframe: Last 1 Day
   → Get Total
   → Set variable: "active_energy_value"
```

#### 3.7: Build the JSON Payload

```
Set variable "payload" to:
{
  "data": [
    {
      "date": today,
      "hrv_ms": hrv_value,
      "walking_hr_bpm": walking_hr_value,
      "steps": steps_value,
      "sleep_hours": sleep_value,
      "active_energy_kcal": active_energy_value
    }
  ]
}
```

Use the **Dictionary** action to construct this, or paste it as JSON text and convert with **Get Dictionary Value**.

#### 3.8: POST to the Endpoint

```
POST Request:
  URL: https://yourdomain.com/api/health/auto-sync
  Method: POST
  Headers:
    - Key: "X-Health-Sync-Key"
      Value: [your-api-key from env var]
    - Key: "Content-Type"
      Value: "application/json"
  Body: (raw JSON) payload
  → Set variable: "response"
```

#### 3.9: Handle Response (optional)

```
If response status = 200:
  Show Notification: "✅ Health synced at [today]"
Else:
  Show Notification: "❌ Health sync failed: [response]"
```

### 4: Test the Shortcut

1. **Run manually** first: tap the play button and watch the HealthKit prompts
2. **Grant permissions** when the Health app asks
3. **Check the endpoint logs** — `npm run dev` and check for POST requests
4. **Verify Supabase** — query one of the tables to confirm the data arrived

### 5: Enable Automation

Once testing passes:
1. Go back to the automation
2. Toggle **Ask Before Running** off (so it runs automatically)
3. Confirm the automation is scheduled

---

## Troubleshooting

**Shortcut won't run at 2 AM:**
- Check **Settings** > **Screen Time** — automations may be blocked by app limits
- Ensure your iPhone isn't in a heavily restricted Downtime window
- Automations run more reliably when the phone is unlocked and on WiFi

**HealthKit queries return no data:**
- Open the Health app and confirm data exists for that metric/day
- Grant the Shortcut permissions: **Settings** > **Health** > **Data Access & Devices** > **Shortcuts**

**Endpoint returns 401:**
- Double-check the API key in the header matches `HEALTH_AUTO_SYNC_API_KEY` in your .env
- Ensure the env var was deployed to Vercel: `vercel env list` or check the Vercel dashboard

**Endpoint returns 400 (validation error):**
- The JSON payload doesn't match the schema; check the response details
- Ensure date format is exactly `YYYY-MM-DD`
- Ensure numeric values are numbers, not strings

**Endpoint returns 500:**
- Database constraint violation (e.g., `value <= 0` for HRV)
- Supabase permission issue — check RLS policies (should be `anon, authenticated SELECT` + `service-role INSERT/UPDATE`)

---

## Metrics & Units

| Metric | Variable | Unit | Source |
| --- | --- | --- | --- |
| Heart Rate Variability | `hrv_ms` | milliseconds (SDNN) | Apple Watch |
| Walking Heart Rate | `walking_hr_bpm` | beats per minute | Apple Watch |
| Steps | `steps_value` | count | iPhone motion + Apple Watch |
| Sleep | `sleep_value` | hours (asleep only) | Apple Watch sleep tracking |
| Active Energy | `active_energy_value` | kilocalories | iPhone + Apple Watch |

---

## Daily Sync

Once the automation is active:
- The Shortcut runs at 2:00 AM every day
- Data from the past 24 hours is aggregated and sent
- Each metric is upserted into its corresponding Supabase table
- The trends are immediately visible in your dashboard (refresh to see updates)

No manual exports needed. 🎉
