insert into public.oem_part_applicability(part_id,make,model,variant,year_from,year_to,market,vehicle_type,source_id,source_page,raw_text)
select p.id,'Honda','Vario 160','ABS/CBS',2022,2022,'Indonesia','motorcycle',s.id,56,'Vario 160 2022 catalog row lists 22123-K0S-V00 ROLLER SET, WEIGHT(BANDO).'
from public.oem_parts p
join public.technical_sources s on s.model_scope='Vario 160' and s.source_type='oem_parts_catalog'
where p.manufacturer='Honda' and p.part_number_normalized='22123K0SV00'
and not exists(select 1 from public.oem_part_applicability a where a.part_id=p.id and a.model='Vario 160' and a.year_from=2022);