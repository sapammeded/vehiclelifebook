-- Vehicle Lifebook: OEM part shared/interchange evidence query v2
-- Safe/idempotent. Does not delete history and does not infer compatibility from family/cc.

insert into public.oem_part_relations(from_part_id,to_part_id,relation_type,source_id,source_page,confidence,verification_status,reason)
select a.id,b.id,'shared_oem_part',coalesce(a.source_id,b.source_id),coalesce(a.source_page,b.source_page),1,'verified',
       'Exact same normalized OEM part number documented in separate model applicability records.'
from public.oem_parts a
join public.oem_parts b
  on a.id<b.id
 and a.manufacturer=b.manufacturer
 and a.part_number_normalized=b.part_number_normalized
where not exists (
  select 1 from public.oem_part_relations r
  where r.from_part_id=a.id and r.to_part_id=b.id and r.relation_type='shared_oem_part'
);

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
      case
        when pn<>'' and p.part_number_normalized=pn then 100
        when lower(p.part_name) like '%'||q||'%' then 70
        when lower(coalesce(p.component,'')) like '%'||q||'%' then 60
        else 0
      end as match_score
    from public.oem_parts p
    join public.oem_part_applicability a on a.part_id=p.id
    where a.applicability_status='documented'
      and (a.make is null or lower(a.make)=lower(coalesce(v.brand,'')))
      and (a.model is null or lower(a.model)=lower(coalesce(v.model,'')))
      and (v.year is null or a.year_from is null or v.year>=a.year_from)
      and (v.year is null or a.year_to is null or v.year<=a.year_to)
      and (a.engine_code is null or lower(a.engine_code)=lower(coalesce(v.metadata->>'engine_code','')))
      and (
        pn='' and q='' or
        (pn<>'' and p.part_number_normalized=pn) or
        (q<>'' and (lower(p.part_name) like '%'||q||'%' or lower(coalesce(p.component,'')) like '%'||q||'%'))
      )
      and (p_component is null or lower(coalesce(p.component,'')) like '%'||lower(p_component)||'%')
    order by match_score desc,p.part_number
    limit 100
  ),
  relations as (
    select r.relation_type,r.verification_status,r.confidence,r.reason,
      fp.part_number from_part_number,fp.part_name from_part_name,
      tp.part_number to_part_number,tp.part_name to_part_name
    from public.oem_part_relations r
    join public.oem_parts fp on fp.id=r.from_part_id
    join public.oem_parts tp on tp.id=r.to_part_id
    where r.verification_status in ('verified','corroborated')
      and (
        exists (select 1 from matches m where m.id=fp.id or m.id=tp.id)
        or (pn<>'' and (fp.part_number_normalized=pn or tp.part_number_normalized=pn))
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
