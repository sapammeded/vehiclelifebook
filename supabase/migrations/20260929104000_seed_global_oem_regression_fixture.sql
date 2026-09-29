with src as (
  insert into public.technical_sources
    (source_type,source_format,title,publisher,manufacturer,model_scope,revision,url,document_ref,trust_level,retrieved_at,metadata)
  values
    ('oem_parts_catalog','pdf','Honda PCX160 2022 Parts Catalogue','PT Astra Honda Motor','Honda','PCX160','2022.10.20','https://2rom-prd-data.hondamotopub.com/pc/AHJ/PCX160/2022/_PC_PCX160.pdf','13K1ZB2AJ (18K1ZMI2)','official',now(),'{"market":"Indonesia","source_page":56,"regression_fixture":true}'::jsonb),
    ('oem_parts_catalog','pdf','Honda Vario 160 2022 Parts Catalogue','PT Astra Honda Motor','Honda','Vario 160','2022.01.10','https://2rom-prd-data.hondamotopub.com/pc/AHJ/VARIO%20160/2022/PC_VARIO160.pdf','13K2SA1AJ','official',now(),'{"market":"Indonesia","regression_fixture":true}'::jsonb)
  returning id,model_scope
),
pcx_src as (select id from src where model_scope='PCX160' limit 1),
vario_src as (select id from src where model_scope='Vario 160' limit 1),
p1 as (
  insert into public.oem_parts(manufacturer,part_number,part_name,component,assembly_group,source_id,source_page,raw_text,source_format,metadata)
  select 'Honda','22123-K0S-V00','ROLLER SET, WEIGHT (BANDO)','CVT / variator','E-16 DRIVE FACE',id,56,
    '22123-K0S-V00 ROLLER SET, WEIGHT(BANDO). Catalog does not state roller mass.',
    'parts_catalog','{"catalog_model":"PCX160","catalog_date":"2022-10-20","mass_verified":false}'::jsonb
  from pcx_src
  on conflict (manufacturer,part_number_normalized) do update set
    part_name=excluded.part_name,component=excluded.component,assembly_group=excluded.assembly_group,
    source_id=excluded.source_id,source_page=excluded.source_page,raw_text=excluded.raw_text,metadata=excluded.metadata
  returning id
),
p2 as (
  insert into public.oem_parts(manufacturer,part_number,part_name,component,assembly_group,source_id,source_page,raw_text,source_format,metadata)
  select 'Honda','22123-K97-B00','ROLLER SET, WEIGHT','CVT / variator','E-16 DRIVE FACE',id,56,
    '22123-K97-B00 ROLLER SET, WEIGHT. Catalog applicability: PCX160 CBS 2022.',
    'parts_catalog','{"catalog_model":"PCX160","catalog_date":"2022-10-20"}'::jsonb
  from pcx_src
  on conflict (manufacturer,part_number_normalized) do update set
    source_id=excluded.source_id,source_page=excluded.source_page,raw_text=excluded.raw_text,metadata=excluded.metadata
  returning id
),
p3 as (
  select id from public.oem_parts where manufacturer='Honda' and part_number_normalized='22123K0SV00' limit 1
),
a1 as (
  insert into public.oem_part_applicability(part_id,make,model,variant,year_from,year_to,market,vehicle_type,source_id,source_page,raw_text)
  select p.id,'Honda','PCX160','ABS',2022,2022,'Indonesia','motorcycle',s.id,56,'PCX160 ABS 2022(P) catalog row.'
  from p1 p cross join pcx_src s
  where not exists (select 1 from public.oem_part_applicability a where a.part_id=p.id and a.model='PCX160' and a.variant='ABS' and a.year_from=2022)
  returning id
),
a2 as (
  insert into public.oem_part_applicability(part_id,make,model,variant,year_from,year_to,market,vehicle_type,source_id,source_page,raw_text)
  select p.id,'Honda','PCX160','CBS',2022,2022,'Indonesia','motorcycle',s.id,56,'PCX160 CBS 2022(P) catalog row uses a different roller set part number.'
  from p2 p cross join pcx_src s
  where not exists (select 1 from public.oem_part_applicability a where a.part_id=p.id and a.model='PCX160' and a.variant='CBS' and a.year_from=2022)
  returning id
),
a3 as (
  insert into public.oem_part_applicability(part_id,make,model,variant,year_from,year_to,market,vehicle_type,source_id,source_page,raw_text)
  select p.id,'Honda','Vario 160','ABS/CBS',2022,2022,'Indonesia','motorcycle',s.id,56,'Vario 160 2022 catalog row lists 22123-K0S-V00 ROLLER SET, WEIGHT(BANDO).'
  from p3 p cross join vario_src s
  where not exists (select 1 from public.oem_part_applicability a where a.part_id=p.id and a.model='Vario 160' and a.year_from=2022)
  returning id
)
select (select count(*) from a1) pcx_abs, (select count(*) from a2) pcx_cbs, (select count(*) from a3) vario_shared;