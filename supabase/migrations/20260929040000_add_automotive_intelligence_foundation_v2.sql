-- Vehicle Lifebook v2.0.0 — Digital Twin / EV / Engine / Diagnostics / Calculations / Evidence
-- Idempotent production migration. Existing vehicle/event history is preserved.

create table if not exists public.vehicle_configurations (
  vehicle_id uuid primary key references public.vehicles(id) on delete cascade,
  vin text, engine_code text, engine_type text not null default 'unknown', fuel_type text,
  displacement_cc numeric check(displacement_cc is null or displacement_cc>0),
  cylinders integer check(cylinders is null or cylinders>0), aspiration text,
  compression_ratio numeric check(compression_ratio is null or compression_ratio>0),
  transmission_type text, transmission_gears integer check(transmission_gears is null or transmission_gears>0),
  drive_layout text, curb_weight_kg numeric check(curb_weight_kg is null or curb_weight_kg>0),
  battery_kwh numeric check(battery_kwh is null or battery_kwh>0), motor_type text,
  motor_peak_kw numeric check(motor_peak_kw is null or motor_peak_kw>=0),
  system_voltage_v numeric check(system_voltage_v is null or system_voltage_v>0),
  ecu_type text,bms_type text,factory_specs jsonb not null default '{}'::jsonb,
  current_state jsonb not null default '{}'::jsonb,
  source_status text not null default 'user_entered' check(source_status in('user_entered','verified','mixed')),
  notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_components (
  id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  parent_component_id uuid references public.vehicle_components(id) on delete set null,
  system text not null, component_type text not null, name text not null, part_number text, manufacturer text, serial_number text,
  status text not null default 'installed' check(status in('installed','removed','failed','stored','unknown')),
  installed_at timestamptz,removed_at timestamptz,specifications jsonb not null default '{}'::jsonb,notes text,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_modifications (
  id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  system text not null,title text not null,modification_type text not null default 'other',
  part_numbers text[] not null default '{}'::text[],
  compatibility_status text not null default 'unknown' check(compatibility_status in('unknown','compatible','conditional','incompatible','verified')),
  risk_level text not null default 'unknown' check(risk_level in('unknown','low','medium','high','critical')),
  target_effect text,baseline jsonb not null default '{}'::jsonb,calculation jsonb not null default '{}'::jsonb,
  installation_notes text,test_plan text,
  validation_status text not null default 'not_tested' check(validation_status in('not_tested','planned','passed','failed','conditional')),
  installed_at timestamptz,removed_at timestamptz,
  evidence_status text not null default 'insufficient' check(evidence_status in('insufficient','partial','adequate','verified')),
  notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create table if not exists public.evidence_sources (
  id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users(id) on delete cascade,
  source_type text not null check(source_type in('oem_manual','service_manual','parts_catalog','technical_bulletin','datasheet','measurement','inspection','invoice','photo','video','user_statement','other')),
  title text not null,publisher text,url text,document_ref text,revision text,published_at date,
  retrieved_at timestamptz not null default now(),trust_level text not null default 'unknown' check(trust_level in('unknown','low','medium','high','oem')),
  content_hash text,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
);

create table if not exists public.vehicle_evidence (
  id uuid primary key default gen_random_uuid(),vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  source_id uuid not null references public.evidence_sources(id) on delete restrict,
  component_id uuid references public.vehicle_components(id) on delete set null,event_id uuid references public.vehicle_events(id) on delete set null,
  claim text not null,observation text,confidence numeric not null default .5 check(confidence between 0 and 1),
  verification_status text not null default 'unverified' check(verification_status in('unverified','corroborated','verified','rejected')),
  observed_at timestamptz,metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now()
);

create table if not exists public.vehicle_measurements (
  id uuid primary key default gen_random_uuid(),vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  component_id uuid references public.vehicle_components(id) on delete set null,event_id uuid references public.vehicle_events(id) on delete set null,
  measurement_type text not null,value numeric,unit text not null,min_spec numeric,max_spec numeric,target_value numeric,
  instrument text,condition_text text,measured_at timestamptz not null default now(),
  source_id uuid references public.evidence_sources(id) on delete set null,
  status text not null default 'unassessed' check(status in('unassessed','within_spec','out_of_spec','borderline')),
  notes text,created_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now()
);

create table if not exists public.diagnostic_cases (
  id uuid primary key default gen_random_uuid(),vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  title text not null,symptom text not null,conditions jsonb not null default '{}'::jsonb,suspected_system text,
  suspected_component_id uuid references public.vehicle_components(id) on delete set null,root_cause text,
  diagnosis_status text not null default 'open' check(diagnosis_status in('open','testing','root_cause_found','repaired','validated','closed','inconclusive')),
  confidence numeric not null default 0 check(confidence between 0 and 1),
  safety_level text not null default 'normal' check(safety_level in('normal','caution','stop_use','high_voltage')),
  opened_at timestamptz not null default now(),closed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,notes text
);

create table if not exists public.diagnostic_steps (
  id uuid primary key default gen_random_uuid(),case_id uuid not null references public.diagnostic_cases(id) on delete cascade,
  sequence_no integer not null check(sequence_no>0),hypothesis text not null,test_name text not null,
  expected_result text,actual_result text,measurement_id uuid references public.vehicle_measurements(id) on delete set null,
  evidence_id uuid references public.vehicle_evidence(id) on delete set null,conclusion text,
  status text not null default 'planned' check(status in('planned','passed','failed','inconclusive','skipped')),
  created_at timestamptz not null default now(),unique(case_id,sequence_no)
);

create table if not exists public.vehicle_calculations (
  id uuid primary key default gen_random_uuid(),vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  calculation_type text not null,formula_version text not null,inputs jsonb not null,outputs jsonb not null,
  assumptions jsonb not null default '{}'::jsonb,source_ids uuid[] not null default '{}'::uuid[],
  deterministic boolean not null default true,created_by uuid not null references auth.users(id) on delete restrict,created_at timestamptz not null default now()
);

create table if not exists public.validation_records (
  id uuid primary key default gen_random_uuid(),vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  modification_id uuid references public.vehicle_modifications(id) on delete set null,
  diagnostic_case_id uuid references public.diagnostic_cases(id) on delete set null,
  calculation_id uuid references public.vehicle_calculations(id) on delete set null,
  validation_type text not null,baseline jsonb not null default '{}'::jsonb,test_conditions jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,verdict text not null default 'pending' check(verdict in('pending','pass','fail','conditional','inconclusive')),
  validated_at timestamptz,validated_by uuid not null references auth.users(id) on delete restrict,notes text,created_at timestamptz not null default now()
);

create index if not exists vehicle_components_vehicle_system_idx on public.vehicle_components(vehicle_id,system);
create index if not exists vehicle_modifications_vehicle_idx on public.vehicle_modifications(vehicle_id,created_at desc);
create index if not exists vehicle_evidence_vehicle_idx on public.vehicle_evidence(vehicle_id,created_at desc);
create index if not exists vehicle_measurements_vehicle_idx on public.vehicle_measurements(vehicle_id,measured_at desc);
create index if not exists diagnostic_cases_vehicle_idx on public.diagnostic_cases(vehicle_id,opened_at desc);
create index if not exists diagnostic_steps_case_idx on public.diagnostic_steps(case_id,sequence_no);
create index if not exists vehicle_calculations_vehicle_idx on public.vehicle_calculations(vehicle_id,created_at desc);
create index if not exists validation_records_vehicle_idx on public.validation_records(vehicle_id,created_at desc);

alter table public.vehicle_configurations enable row level security;
alter table public.vehicle_components enable row level security;
alter table public.vehicle_modifications enable row level security;
alter table public.evidence_sources enable row level security;
alter table public.vehicle_evidence enable row level security;
alter table public.vehicle_measurements enable row level security;
alter table public.diagnostic_cases enable row level security;
alter table public.diagnostic_steps enable row level security;
alter table public.vehicle_calculations enable row level security;
alter table public.validation_records enable row level security;

drop policy if exists vehicle_configuration_owner_all on public.vehicle_configurations;
create policy vehicle_configuration_owner_all on public.vehicle_configurations for all to authenticated
using(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())))
with check(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())));

drop policy if exists vehicle_components_owner_all on public.vehicle_components;
create policy vehicle_components_owner_all on public.vehicle_components for all to authenticated
using(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())))
with check(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())));

drop policy if exists vehicle_modifications_owner_all on public.vehicle_modifications;
create policy vehicle_modifications_owner_all on public.vehicle_modifications for all to authenticated
using(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())))
with check(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())));

drop policy if exists evidence_sources_owner_rw on public.evidence_sources;
create policy evidence_sources_owner_rw on public.evidence_sources for all to authenticated
using(owner_id=(select auth.uid()) or owner_id is null)
with check(owner_id=(select auth.uid()));

drop policy if exists vehicle_evidence_owner_all on public.vehicle_evidence;
create policy vehicle_evidence_owner_all on public.vehicle_evidence for all to authenticated
using(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())))
with check(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())) and created_by=(select auth.uid()));

drop policy if exists vehicle_measurements_owner_all on public.vehicle_measurements;
create policy vehicle_measurements_owner_all on public.vehicle_measurements for all to authenticated
using(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())))
with check(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())) and created_by=(select auth.uid()));

drop policy if exists diagnostic_cases_owner_all on public.diagnostic_cases;
create policy diagnostic_cases_owner_all on public.diagnostic_cases for all to authenticated
using(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())))
with check(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())) and created_by=(select auth.uid()));

drop policy if exists diagnostic_steps_owner_all on public.diagnostic_steps;
create policy diagnostic_steps_owner_all on public.diagnostic_steps for all to authenticated
using(exists(select 1 from public.diagnostic_cases c join public.vehicles v on v.id=c.vehicle_id where c.id=case_id and v.owner_id=(select auth.uid())))
with check(exists(select 1 from public.diagnostic_cases c join public.vehicles v on v.id=c.vehicle_id where c.id=case_id and v.owner_id=(select auth.uid())));

drop policy if exists vehicle_calculations_owner_all on public.vehicle_calculations;
create policy vehicle_calculations_owner_all on public.vehicle_calculations for all to authenticated
using(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())))
with check(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())) and created_by=(select auth.uid()));

drop policy if exists validation_records_owner_all on public.validation_records;
create policy validation_records_owner_all on public.validation_records for all to authenticated
using(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())))
with check(exists(select 1 from public.vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())) and validated_by=(select auth.uid()));

drop trigger if exists trg_vehicle_configurations_updated_at on public.vehicle_configurations;
create trigger trg_vehicle_configurations_updated_at before update on public.vehicle_configurations for each row execute function public.set_updated_at();
drop trigger if exists trg_vehicle_components_updated_at on public.vehicle_components;
create trigger trg_vehicle_components_updated_at before update on public.vehicle_components for each row execute function public.set_updated_at();
drop trigger if exists trg_vehicle_modifications_updated_at on public.vehicle_modifications;
create trigger trg_vehicle_modifications_updated_at before update on public.vehicle_modifications for each row execute function public.set_updated_at();

create or replace function public.get_vehicle_intelligence_context(p_vehicle_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
 if not exists(select 1 from public.vehicles where id=p_vehicle_id and owner_id=(select auth.uid())) then raise exception 'VEHICLE_ACCESS_DENIED'; end if;
 select jsonb_build_object(
  'vehicle',to_jsonb(v),'configuration',coalesce(to_jsonb(vc),'{}'::jsonb),
  'components',coalesce((select jsonb_agg(to_jsonb(c) order by c.system,c.name) from public.vehicle_components c where c.vehicle_id=p_vehicle_id),'[]'::jsonb),
  'modifications',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc) from public.vehicle_modifications m where m.vehicle_id=p_vehicle_id),'[]'::jsonb),
  'recent_measurements',coalesce((select jsonb_agg(to_jsonb(x) order by x.measured_at desc) from (select * from public.vehicle_measurements where vehicle_id=p_vehicle_id order by measured_at desc limit 50)x),'[]'::jsonb),
  'open_diagnostics',coalesce((select jsonb_agg(to_jsonb(d) order by d.opened_at desc) from (select * from public.diagnostic_cases where vehicle_id=p_vehicle_id and diagnosis_status not in('closed','validated') order by opened_at desc limit 20)d),'[]'::jsonb),
  'recent_calculations',coalesce((select jsonb_agg(to_jsonb(k) order by k.created_at desc) from (select * from public.vehicle_calculations where vehicle_id=p_vehicle_id order by created_at desc limit 20)k),'[]'::jsonb),
  'validations',coalesce((select jsonb_agg(to_jsonb(z) order by z.created_at desc) from (select * from public.validation_records where vehicle_id=p_vehicle_id order by created_at desc limit 20)z),'[]'::jsonb)
 ) into result from public.vehicles v left join public.vehicle_configurations vc on vc.vehicle_id=v.id where v.id=p_vehicle_id;
 return result;
end $$;
revoke all on function public.get_vehicle_intelligence_context(uuid) from public,anon;
grant execute on function public.get_vehicle_intelligence_context(uuid) to authenticated;
update public._vehicle_lifebook_system set schema_version='2.0.0' where id=true;
