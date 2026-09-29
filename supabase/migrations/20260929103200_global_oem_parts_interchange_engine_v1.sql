create table if not exists public.oem_parts (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  part_number text not null,
  part_number_normalized text generated always as (upper(regexp_replace(trim(part_number),'[^A-Z0-9]','','g'))) stored,
  part_name text not null,
  component text,
  assembly_group text,
  source_id uuid references public.technical_sources(id) on delete set null,
  source_page integer,
  raw_text text,
  source_format text not null default 'parts_catalog',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (manufacturer, part_number_normalized)
);

create table if not exists public.oem_part_applicability (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.oem_parts(id) on delete cascade,
  make text,
  model text,
  variant text,
  year_from smallint,
  year_to smallint,
  market text,
  vehicle_type text,
  engine_code text,
  transmission text,
  applicability_status text not null default 'documented' check (applicability_status in ('documented','candidate','excluded')),
  source_id uuid references public.technical_sources(id) on delete set null,
  source_page integer,
  raw_text text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.oem_part_measurements (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.oem_parts(id) on delete cascade,
  measurement_key text not null,
  value numeric,
  unit text,
  tolerance text,
  source_id uuid references public.technical_sources(id) on delete set null,
  source_page integer,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','corroborated','verified','rejected')),
  raw_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.oem_part_relations (
  id uuid primary key default gen_random_uuid(),
  from_part_id uuid not null references public.oem_parts(id) on delete cascade,
  to_part_id uuid not null references public.oem_parts(id) on delete cascade,
  relation_type text not null check (relation_type in ('shared_oem_part','explicit_interchange','supersedes','replaces','assembly_contains','candidate_interchange')),
  source_id uuid references public.technical_sources(id) on delete set null,
  source_page integer,
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','corroborated','verified','rejected')),
  reason text,
  created_at timestamptz not null default now(),
  unique (from_part_id,to_part_id,relation_type)
);

create index if not exists idx_oem_parts_pn on public.oem_parts(part_number_normalized);
create index if not exists idx_oem_parts_name on public.oem_parts using gin (to_tsvector('simple', coalesce(part_name,'') || ' ' || coalesce(component,'')));
create index if not exists idx_oem_part_app_vehicle on public.oem_part_applicability(make,model,year_from,year_to,engine_code);
create index if not exists idx_oem_part_relations_from on public.oem_part_relations(from_part_id);
create index if not exists idx_oem_part_relations_to on public.oem_part_relations(to_part_id);

alter table public.oem_parts enable row level security;
alter table public.oem_part_applicability enable row level security;
alter table public.oem_part_measurements enable row level security;
alter table public.oem_part_relations enable row level security;

drop policy if exists oem_parts_select_authenticated on public.oem_parts;
create policy oem_parts_select_authenticated on public.oem_parts for select to authenticated using (true);
drop policy if exists oem_part_app_select_authenticated on public.oem_part_applicability;
create policy oem_part_app_select_authenticated on public.oem_part_applicability for select to authenticated using (true);
drop policy if exists oem_part_measure_select_authenticated on public.oem_part_measurements;
create policy oem_part_measure_select_authenticated on public.oem_part_measurements for select to authenticated using (true);
drop policy if exists oem_part_rel_select_authenticated on public.oem_part_relations;
create policy oem_part_rel_select_authenticated on public.oem_part_relations for select to authenticated using (true);

revoke all on public.oem_parts, public.oem_part_applicability, public.oem_part_measurements, public.oem_part_relations from anon;
revoke insert, update, delete, truncate, references, trigger on public.oem_parts, public.oem_part_applicability, public.oem_part_measurements, public.oem_part_relations from authenticated;

create or replace function public.get_vehicle_part_intelligence(
  p_vehicle_id uuid,
  p_query text default null,
  p_part_number text default null,
  p_component text default null
) returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v public.vehicles%rowtype;
  q text := lower(trim(coalesce(p_query,'')));
  pn text := upper(regexp_replace(trim(coalesce(p_part_number,'')),'[^A-Z0-9]','','g'));
  result jsonb;
begin
  select * into v from public.vehicles where id=p_vehicle_id and owner_id=auth.uid();
  if not found then raise exception 'Vehicle tidak ditemukan atau bukan milik user'; end if;

  with matches as (
    select distinct p.id,p.manufacturer,p.part_number,p.part_name,p.component,p.assembly_group,
      a.make,a.model,a.variant,a.year_from,a.year_to,a.market,a.vehicle_type,a.engine_code,a.transmission,
      a.applicability_status,a.source_page,
      ts.title source_title,ts.url source_url,ts.source_format,
      case
        when pn<>'' and p.part_number_normalized=pn then 100
        when lower(p.part_name) like '%'||q||'%' then 70
        when lower(coalesce(p.component,'')) like '%'||q||'%' then 60
        else 0
      end as match_score
    from public.oem_parts p
    join public.oem_part_applicability a on a.part_id=p.id
    left join public.technical_sources ts on ts.id=coalesce(a.source_id,p.source_id)
    where a.applicability_status='documented'
      and (a.make is null or lower(a.make)=lower(coalesce(v.brand,'')))
      and (a.model is null or lower(a.model)=lower(coalesce(v.model,'')))
      and (v.year is null or a.year_from is null or v.year>=a.year_from)
      and (v.year is null or a.year_to is null or v.year<=a.year_to)
      and (a.engine_code is null or lower(a.engine_code)=lower(coalesce(v.metadata->>'engine_code','')))
      and (
        (pn='' and q='') or
        (pn<>'' and p.part_number_normalized=pn) or
        (q<>'' and (lower(p.part_name) like '%'||q||'%' or lower(coalesce(p.component,'')) like '%'||q||'%'))
      )
      and (p_component is null or lower(coalesce(p.component,'')) like '%'||lower(p_component)||'%')
    order by match_score desc,p.part_number
    limit 100
  ),
  relations as (
    select r.relation_type,r.verification_status,r.confidence,r.reason,
      fp.manufacturer from_part_manufacturer,fp.part_number from_part_number,fp.part_name from_part_name,
      tp.part_number to_part_number,tp.part_name to_part_name,
      ts.url source_url,ts.title source_title
    from public.oem_part_relations r
    join public.oem_parts fp on fp.id=r.from_part_id
    join public.oem_parts tp on tp.id=r.to_part_id
    left join public.technical_sources ts on ts.id=r.source_id
    where r.verification_status in ('verified','corroborated')
      and (
        (pn<>'' and (fp.part_number_normalized=pn or tp.part_number_normalized=pn))
        or (pn='' and q<>'' and (lower(fp.part_name) like '%'||q||'%' or lower(tp.part_name) like '%'||q||'%'))
      )
    limit 100
  )
  select jsonb_build_object(
    'vehicle',jsonb_build_object(
      'id',v.id,'make',v.brand,'model',v.model,'variant',v.variant,'year',v.year,
      'vehicle_type',v.vehicle_type,'vin_or_frame',v.chassis_number,'engine_number',v.engine_number,
      'engine_code',v.metadata->>'engine_code'
    ),
    'matches',coalesce((select jsonb_agg(to_jsonb(m) order by m.match_score desc) from matches m),'[]'::jsonb),
    'relations',coalesce((select jsonb_agg(to_jsonb(r)) from relations r),'[]'::jsonb),
    'rules',jsonb_build_object(
      'exact_oem_part_number_is_strong_evidence',true,
      'same_family_is_not_compatibility',true,
      'different_part_number_requires_fitment_evidence',true,
      'never_guess',true
    )
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_vehicle_part_intelligence(uuid,text,text,text) from public;
grant execute on function public.get_vehicle_part_intelligence(uuid,text,text,text) to authenticated;
