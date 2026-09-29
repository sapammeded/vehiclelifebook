create or replace function public.update_vehicle_event(
  p_event_id uuid,
  p_event_type text,
  p_event_date date,
  p_title text,
  p_description text default null,
  p_total_cost numeric default 0,
  p_odometer numeric default null,
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_vehicle_id uuid;
  v_item jsonb;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_event_type not in ('fuel','service','damage','part','inspection','expense','note') then raise exception 'INVALID_EVENT_TYPE'; end if;
  if coalesce(trim(p_title),'')='' then raise exception 'EVENT_TITLE_REQUIRED'; end if;
  if coalesce(p_total_cost,0)<0 then raise exception 'INVALID_TOTAL_COST'; end if;
  select vehicle_id into v_vehicle_id from public.vehicle_events where id=p_event_id and created_by=v_user_id for update;
  if v_vehicle_id is null then raise exception 'EVENT_NOT_FOUND_OR_FORBIDDEN'; end if;

  update public.vehicle_events
  set event_type=p_event_type,event_date=coalesce(p_event_date,current_date),title=trim(p_title),
      description=p_description,total_cost=coalesce(p_total_cost,0),odometer=p_odometer,updated_at=now()
  where id=p_event_id and created_by=v_user_id;

  delete from public.fuel_logs where event_id=p_event_id;
  delete from public.service_items where event_id=p_event_id;
  delete from public.service_logs where event_id=p_event_id;
  delete from public.damage_logs where event_id=p_event_id;
  delete from public.part_logs where event_id=p_event_id;
  delete from public.inspection_logs where event_id=p_event_id;
  delete from public.expense_logs where event_id=p_event_id;

  if p_event_type='fuel' then
    insert into public.fuel_logs(event_id,fuel_type,liters,unit_price,total_amount,station_name,receipt_number,notes)
    values(p_event_id,p_detail->>'fuel_type',nullif(p_detail->>'liters','')::numeric,nullif(p_detail->>'unit_price','')::numeric,
      coalesce(nullif(p_detail->>'total_amount','')::numeric,p_total_cost),p_detail->>'station_name',p_detail->>'receipt_number',p_detail->>'notes');
  elsif p_event_type='service' then
    insert into public.service_logs(event_id,service_type,workshop_name,technician_name,warranty_until,next_service_date,next_service_odometer,notes)
    values(p_event_id,coalesce(nullif(p_detail->>'service_type',''),'General Service'),p_detail->>'workshop_name',p_detail->>'technician_name',
      nullif(p_detail->>'warranty_until','')::date,nullif(p_detail->>'next_service_date','')::date,nullif(p_detail->>'next_service_odometer','')::numeric,p_detail->>'notes');
    if jsonb_typeof(p_detail->'items')='array' then
      for v_item in select value from jsonb_array_elements(p_detail->'items') loop
        insert into public.service_items(event_id,item_type,item_name,part_number,quantity,unit_price,notes)
        values(p_event_id,coalesce(v_item->>'item_type','job'),coalesce(v_item->>'item_name','Item'),v_item->>'part_number',
          coalesce(nullif(v_item->>'quantity','')::numeric,1),coalesce(nullif(v_item->>'unit_price','')::numeric,0),v_item->>'notes');
      end loop;
    end if;
  elsif p_event_type='damage' then
    insert into public.damage_logs(event_id,damage_location,damage_category,severity,status,symptoms,suspected_cause,repair_action,resolved_at,notes)
    values(p_event_id,p_detail->>'damage_location',p_detail->>'damage_category',coalesce(p_detail->>'severity','medium'),coalesce(p_detail->>'status','open'),
      p_detail->>'symptoms',p_detail->>'suspected_cause',p_detail->>'repair_action',nullif(p_detail->>'resolved_at','')::date,p_detail->>'notes');
  elsif p_event_type='part' then
    insert into public.part_logs(event_id,part_name,part_number,brand,quantity,unit_price,supplier_name,warranty_until,installation_date,notes)
    values(p_event_id,coalesce(p_detail->>'part_name','Part'),p_detail->>'part_number',p_detail->>'brand',coalesce(nullif(p_detail->>'quantity','')::numeric,1),
      coalesce(nullif(p_detail->>'unit_price','')::numeric,0),p_detail->>'supplier_name',nullif(p_detail->>'warranty_until','')::date,
      nullif(p_detail->>'installation_date','')::date,p_detail->>'notes');
  elsif p_event_type='inspection' then
    insert into public.inspection_logs(event_id,inspection_type,result,inspector_name,next_due_date,checklist,notes)
    values(p_event_id,coalesce(p_detail->>'inspection_type','General Inspection'),coalesce(p_detail->>'result','pass_with_note'),p_detail->>'inspector_name',
      nullif(p_detail->>'next_due_date','')::date,coalesce(p_detail->'checklist','[]'::jsonb),p_detail->>'notes');
  elsif p_event_type='expense' then
    insert into public.expense_logs(event_id,category,vendor_name,amount,payment_method,receipt_number,notes)
    values(p_event_id,coalesce(p_detail->>'category','Other'),p_detail->>'vendor_name',coalesce(nullif(p_detail->>'amount','')::numeric,p_total_cost),
      p_detail->>'payment_method',p_detail->>'receipt_number',p_detail->>'notes');
  end if;

  if p_odometer is not null then
    update public.vehicles set current_odometer=case when current_odometer is null then p_odometer when p_odometer>current_odometer then p_odometer else current_odometer end,
      updated_at=now() where id=v_vehicle_id and owner_id=v_user_id;
  end if;
  return p_event_id;
end;
$function$;

grant execute on function public.update_vehicle_event(uuid,text,date,text,text,numeric,numeric,jsonb) to authenticated;
