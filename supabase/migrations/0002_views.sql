-- Views for Claude (via the Supabase connector) and the portfolio.
-- security_invoker = true: the caller's RLS applies, so each user only sees their own rows.

create or replace view public.daily_summary with (security_invoker = true) as
with days as (
  select user_id, due_date as date from public.tasks where deleted_at is null and due_date is not null
  union select user_id, date from public.focus_sessions where deleted_at is null
  union select user_id, date from public.daily_reviews where deleted_at is null
  union select user_id, date from public.xp_events where deleted_at is null
  union select user_id, date from public.workouts where deleted_at is null
  union select user_id, date from public.weigh_ins where deleted_at is null
  union select user_id, date from public.diet_logs where deleted_at is null
  union select user_id, date from public.water_logs where deleted_at is null
  union select user_id, date from public.meditation_sessions where deleted_at is null
  union select user_id, date from public.persona_daily where deleted_at is null
  union select user_id, published_at from public.posts where deleted_at is null and published_at is not null
)
select
  d.user_id,
  d.date,
  (select count(*) from public.tasks t where t.user_id = d.user_id and t.due_date = d.date and t.done_at is not null and t.deleted_at is null and t.section = 'career')::int as career_tasks_done,
  (select count(*) from public.tasks t where t.user_id = d.user_id and t.due_date = d.date and t.done_at is not null and t.deleted_at is null and t.section = 'mind')::int as mind_tasks_done,
  (select count(*) from public.tasks t where t.user_id = d.user_id and t.due_date = d.date and t.done_at is not null and t.deleted_at is null and t.section = 'body')::int as body_tasks_done,
  (select count(*) from public.tasks t where t.user_id = d.user_id and t.due_date = d.date and t.done_at is not null and t.deleted_at is null and t.section = 'persona')::int as persona_tasks_done,
  (select coalesce(sum(points), 0) from public.xp_events x where x.user_id = d.user_id and x.date = d.date and x.deleted_at is null)::int as xp,
  (select coalesce(sum(minutes), 0) from public.focus_sessions f where f.user_id = d.user_id and f.date = d.date and f.deleted_at is null)::int as focus_min,
  (select coalesce(sum(minutes), 0) from public.focus_sessions f where f.user_id = d.user_id and f.date = d.date and f.deleted_at is null and f.kind = 'block1')::int as python_block1_min,
  exists (select 1 from public.workouts w where w.user_id = d.user_id and w.date = d.date and w.deleted_at is null) as gym_done,
  (select w.weight_kg from public.weigh_ins w where w.user_id = d.user_id and w.date = d.date and w.deleted_at is null limit 1) as weight_kg,
  (select coalesce(sum(calories), 0) from public.diet_logs l where l.user_id = d.user_id and l.date = d.date and l.deleted_at is null)::int as calories,
  (select coalesce(sum(protein_g), 0) from public.diet_logs l where l.user_id = d.user_id and l.date = d.date and l.deleted_at is null)::int as protein_g,
  (select coalesce(sum(ml), 0) from public.water_logs l where l.user_id = d.user_id and l.date = d.date and l.deleted_at is null)::int as water_ml,
  (select c.rapid from public.chess_snapshots c where c.user_id = d.user_id and c.date <= d.date and c.deleted_at is null order by c.date desc limit 1) as chess_rapid,
  (select coalesce(sum(minutes), 0) from public.meditation_sessions m where m.user_id = d.user_id and m.date = d.date and m.deleted_at is null)::int as meditation_min,
  (select coalesce(max(english_min), 0) from public.persona_daily p where p.user_id = d.user_id and p.date = d.date and p.deleted_at is null)::int as speaking_min,
  (select count(*) from public.posts p where p.user_id = d.user_id and p.published_at = d.date and p.status = 'published' and p.deleted_at is null)::int as posts_published,
  (select g.pushes_today from public.github_snapshots g where g.user_id = d.user_id and g.date = d.date and g.deleted_at is null limit 1) as pushes,
  exists (select 1 from public.daily_reviews r where r.user_id = d.user_id and r.date = d.date and r.submitted_at is not null and r.deleted_at is null) as review_submitted
from days d;

comment on view public.daily_summary is 'One row per date with activity across all sections. Read this first to review a day.';

create or replace view public.weekly_summary with (security_invoker = true) as
with s as (select *, date_trunc('week', date)::date as wk from public.daily_summary)
select
  s.user_id,
  s.wk as week_start,
  sum(s.career_tasks_done + s.mind_tasks_done + s.body_tasks_done + s.persona_tasks_done)::int as tasks_done,
  sum(s.xp)::int as xp,
  sum(s.focus_min)::int as focus_min,
  sum(s.python_block1_min)::int as python_block1_min,
  (count(*) filter (where s.python_block1_min >= 90))::int as block1_days,
  (count(*) filter (where s.gym_done))::int as gym_sessions,
  max(s.weight_kg) filter (where s.weight_kg is not null) as weight_kg,
  round(avg(nullif(s.calories, 0)))::int as avg_calories,
  round(avg(nullif(s.protein_g, 0)))::int as avg_protein_g,
  sum(s.meditation_min)::int as meditation_min,
  sum(s.speaking_min)::int as speaking_min,
  sum(s.posts_published)::int as posts_published,
  sum(coalesce(s.pushes, 0))::int as pushes,
  (count(*) filter (where s.review_submitted))::int as reviews_submitted,
  (select g.grade from public.weekly_grades g where g.user_id = s.user_id and g.week_start = s.wk and g.deleted_at is null limit 1) as grade
from s
group by s.user_id, s.wk;

comment on view public.weekly_summary is 'Per ISO week (Monday start) totals plus the weekly grade.';

-- Public stats: only fields whose flag in settings.public_stat_flags is true.
-- Never body data, journal, contacts, recordings or photos (they are not even candidates).
create or replace function public.public_stats_for(uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  with s as (
    select public_stat_flags as flags, derived_stats as derived from public.settings where user_id = uid and deleted_at is null limit 1
  ),
  today as (select (now() at time zone 'Asia/Kolkata')::date as d),
  candidates as (
    select jsonb_build_object(
      'lock_in_day', (select (select d from today) - p.lock_in_start_date + 1 from public.profile p where p.user_id = uid and p.lock_in_start_date is not null and p.deleted_at is null limit 1),
      'overall_streak', (select (derived ->> 'overall_streak')::int from s),
      'level', (select (derived ->> 'level')::int from s),
      'current_focus', (select derived ->> 'current_focus' from s),
      'python_hours_week', (select round(coalesce(sum(minutes), 0) / 60.0, 1) from public.focus_sessions where user_id = uid and kind = 'block1' and deleted_at is null and date >= date_trunc('week', (select d from today))::date),
      'github_pushes_week', (select coalesce(sum(pushes_today), 0) from public.github_snapshots where user_id = uid and deleted_at is null and date >= date_trunc('week', (select d from today))::date),
      'chess_rapid', (select rapid from public.chess_snapshots where user_id = uid and deleted_at is null and rapid is not null order by date desc limit 1),
      'posts_month', (select count(*) from public.posts where user_id = uid and status = 'published' and deleted_at is null and published_at >= date_trunc('month', (select d from today))::date),
      'books_finished', (select count(*) from public.books where user_id = uid and status = 'finished' and deleted_at is null),
      'workouts_month', (select count(*) from public.workouts where user_id = uid and deleted_at is null and date >= date_trunc('month', (select d from today))::date),
      'grid', (select derived -> 'grid' from s)
    ) as c
  )
  select coalesce(
    (select jsonb_object_agg(e.k, e.v)
       from candidates, jsonb_each(candidates.c) as e(k, v)
      where coalesce(((select flags from s) ->> e.k)::boolean, false) and e.v is not null and e.v <> 'null'::jsonb),
    '{}'::jsonb);
$fn$;

revoke all on function public.public_stats_for(uuid) from public, anon, authenticated;
grant execute on function public.public_stats_for(uuid) to service_role;

-- Owner-readable view of exactly what the portfolio will see.
create or replace function public.my_public_stats()
returns jsonb language sql stable security definer set search_path = public
as $fn$ select public.public_stats_for(auth.uid()) $fn$;
revoke all on function public.my_public_stats() from public, anon;
grant execute on function public.my_public_stats() to authenticated;

create or replace view public.public_stats with (security_invoker = true) as
select auth.uid() as user_id, public.my_public_stats() as stats;

comment on view public.public_stats is 'What the portfolio widget can see (flagged stats only).';

grant select on public.daily_summary, public.weekly_summary, public.public_stats to authenticated;
revoke all on public.daily_summary, public.weekly_summary, public.public_stats from anon;
