-- Private storage buckets. Objects live under "<user_id>/..." and are only reachable by their owner (signed URLs).
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false), ('recordings', 'recordings', false), ('pyq', 'pyq', false)
on conflict (id) do update set public = false;

drop policy if exists "one_private_select" on storage.objects;
drop policy if exists "one_private_insert" on storage.objects;
drop policy if exists "one_private_update" on storage.objects;
drop policy if exists "one_private_delete" on storage.objects;

create policy "one_private_select" on storage.objects for select to authenticated
  using (bucket_id in ('progress-photos', 'recordings', 'pyq') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "one_private_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('progress-photos', 'recordings', 'pyq') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "one_private_update" on storage.objects for update to authenticated
  using (bucket_id in ('progress-photos', 'recordings', 'pyq') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "one_private_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('progress-photos', 'recordings', 'pyq') and (storage.foldername(name))[1] = (select auth.uid())::text);
