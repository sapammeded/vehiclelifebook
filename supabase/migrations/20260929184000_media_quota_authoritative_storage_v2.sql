-- Vehicle Lifebook: authoritative storage accounting + media index
create index if not exists idx_vehicle_media_uploaded_by
  on public.vehicle_media(uploaded_by);

create or replace function public.enforce_vehicle_media_quota()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_plan text;
  v_quota bigint;
  v_used bigint;
  v_actual_size bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if new.uploaded_by <> (select auth.uid()) then
    raise exception 'MEDIA_OWNER_MISMATCH';
  end if;

  select coalesce(plan,'demo')
    into v_plan
  from public.vehicle_profiles
  where user_id = new.uploaded_by
  for update;

  v_quota := case v_plan
    when 'owner' then 53687091200
    when 'pro' then 5368709120
    else 262144000
  end;

  select nullif(o.metadata->>'size','')::bigint
    into v_actual_size
  from storage.objects o
  where o.bucket_id = 'vehicle-evidence'
    and o.name = new.storage_path
    and o.owner_id = new.uploaded_by::text
  limit 1;

  if v_actual_size is null then
    raise exception 'MEDIA_OBJECT_NOT_FOUND';
  end if;

  new.file_size := v_actual_size;

  select coalesce(sum(nullif(o.metadata->>'size','')::bigint),0)::bigint
    into v_used
  from storage.objects o
  where o.bucket_id = 'vehicle-evidence'
    and o.owner_id = new.uploaded_by::text
    and o.name <> new.storage_path;

  if v_used + v_actual_size > v_quota then
    raise exception 'STORAGE_QUOTA_EXCEEDED: used=% bytes, incoming=% bytes, quota=% bytes',
      v_used, v_actual_size, v_quota
      using errcode='54000';
  end if;

  return new;
end;
$function$;

create or replace function public.get_my_storage_usage()
returns table(
  plan text,
  used_bytes bigint,
  quota_bytes bigint,
  remaining_bytes bigint,
  used_percent numeric
)
language sql
set search_path to ''
as $function$
  with p as (
    select coalesce(plan,'demo') as plan
    from public.vehicle_profiles
    where user_id=(select auth.uid())
  ),
  q as (
    select plan,
      case plan
        when 'owner' then 53687091200
        when 'pro' then 5368709120
        else 262144000
      end::bigint as quota_bytes
    from p
  ),
  u as (
    select coalesce(sum(nullif(o.metadata->>'size','')::bigint),0)::bigint as used_bytes
    from storage.objects o
    where o.bucket_id='vehicle-evidence'
      and o.owner_id=(select auth.uid())::text
  )
  select
    q.plan,
    u.used_bytes,
    q.quota_bytes,
    greatest(q.quota_bytes-u.used_bytes,0),
    round((u.used_bytes::numeric/nullif(q.quota_bytes,0))*100,2)
  from q cross join u;
$function$;

grant execute on function public.get_my_storage_usage() to authenticated;
