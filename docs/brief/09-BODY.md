# 09: BODY

Mass gain and discipline. Accent: BODY colour. Banner: barbell + sunrise + 6:30 clock.

> **Don't hard-code medical rules.** All targets (water, calories, training start date) are editable. No "clearance gate" feature (Dharma removed it).

## Sub-pages
`Workout · Schedule · Weigh-in · Diet · Water · Progress · Library · Analytics`

### 9.1 Workout log (logged AFTER the session, not live)
- Pick the session (Full Body A / B; the rotation suggests which is next: A, B, A in week 1, then B, A, B…).
- For each exercise: sets × reps × weight (kg). **Pre-filled from the last time** that exercise was done, so logging takes about 30 seconds.
- **Progression hint (rule-based, no AI):** if all sets hit the top of the rep range last time → suggest the smallest weight jump; otherwise suggest +1 rep.
- Duration, notes, and a "20-min minimum session" flag (counts for the weekly grade).
- Templates (A and B) are editable; exercises can be added or swapped. Weeks 5-12 move to a 4-day upper/lower split. Support multiple templates (Upper A/B, Lower A/B) for later.
- **No rest timer, no live tracking** (Dharma's choice).
- Personal records auto-detected (heaviest weight × reps).

### 9.2 Schedule
- Default **Mon / Wed / Fri, 6:30 AM**, pushed to the "ONE" calendar.
- **"Never miss twice":** a missed scheduled day shows a flag on Home: "Missed one. 20-minute minimum today." Two misses in a row → no episodes that week (reward rule) and the streak breaks.
- Deload reminder every 5th week (same exercises, about half the sets).

### 9.3 Weigh-in
- **Sunday**, empty stomach, same scale. One number.
- Graph: weight over time with target bands.
  - Baseline: **50 kg** at 167 cm (2026-10-11)
  - 12-week target: **53-55 kg**
  - 9-12 month target: **60-62 kg**
  - Healthy gain rate: **0.25-0.4 kg/week**
- Rule hints: gain below 0.25 kg/week for 2 weeks → "Add 200-300 kcal." Gain above 0.5 kg/week → "Mostly fat. Ease off a bit."
- All targets are editable.

### 9.4 Diet
- **Manual daily entry:** calories + protein (Dharma tracks by hand; there's no app import).
- Targets: **about 2,600 kcal**, **90-100 g protein** (editable).
- **One-tap meal templates** (editable), seeded from his plan: oats + peanut butter + jaggery; 3-4 eggs + rice/roti; rice + dal + soya/paneer/chicken + ghee; almonds + PB sandwich + chana; roti/rice + dal/chana + eggs/soya; PB or eggs before bed. Dharma fills in calorie/protein values per template the first time (log placeholders in NEEDS-FROM-DHARMA.md), or you prefill reasonable estimates **clearly marked as estimates**.
- Daily ring for calories and protein.

### 9.5 Water
- Quick-add buttons (+250 ml, +500 ml, custom). Daily total vs target.
- **The target is editable and has no hard-coded default claim.** Show the default as "set your target" until Dharma enters one (he'll set it with his doctor's advice).

### 9.6 Progress
- Monthly measurements (chest, waist, arms, thighs, shoulders; editable list).
- **Private progress photos** (front/side/back) in a **private** Supabase Storage bucket, viewed with signed URLs. Never public, never exported to the portfolio.
- Side-by-side compare (month vs month).

### 9.7 Library
Shared Library module. Topics: form for each exercise in the templates, nutrition for lean bulking (Indian diet), mobility/warm-up.

### 9.8 Analytics
- Contribution grid (BODY done-days: workout logged on schedule days; diet + water logged on others; define it in PLAN.md).
- Stat cards: current weight (+ weekly delta), sessions this week x/3, protein streak, PR count.
- Trend: weight graph with target band.
- Lagging in: e.g. "Protein: 4 of 7 days. Muscles are built in the kitchen."
