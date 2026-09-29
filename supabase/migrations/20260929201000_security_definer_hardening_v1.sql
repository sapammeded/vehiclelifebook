-- Security hardening for SECURITY DEFINER entitlement/license functions.
-- Keep search_path empty and qualify all public objects explicitly.

create or replace function public.ensure_vehicle_profile()
returns public.vehicle_profiles language plpgsql security definer set search_path to ''
as $function$
declare p public.vehicle_profiles;
begin
 if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into public.vehicle_profiles(user_id,plan) values((select auth.uid()),'demo') on conflict(user_id) do nothing;
 select * into p from public.vehicle_profiles where user_id=(select auth.uid());
 return p;
end $function$;

create or replace function public.get_my_entitlement()
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare p public.vehicle_profiles; l public.licenses;
begin
 if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into p from public.vehicle_profiles where user_id=(select auth.uid());
 if not found then insert into public.vehicle_profiles(user_id,plan) values((select auth.uid()),'demo') returning * into p; end if;
 if p.plan='owner' then return jsonb_build_object('plan','owner','configured_plan','owner','access_valid',true,'access_state','owner','license_id',null,'max_vehicles',999999,'max_events',999999); end if;
 if p.plan='demo' then return jsonb_build_object('plan','demo','configured_plan','demo','access_valid',true,'access_state','demo','license_id',null,'max_vehicles',1,'max_events',20); end if;
 if p.plan='pro' and p.license_id is not null then
  select * into l from public.licenses where id=p.license_id;
  if l.id is not null and l.status='active' and (l.expires_at is null or l.expires_at>now()) then
   return jsonb_build_object('plan','pro','configured_plan','pro','access_valid',true,'access_state','pro','license_id',l.license_code,'max_vehicles',l.max_vehicles,'max_events',l.max_events);
  end if;
  return jsonb_build_object('plan','demo','configured_plan','pro','access_valid',false,'access_state','expired_or_revoked','license_id',null,'max_vehicles',1,'max_events',20);
 end if;
 return jsonb_build_object('plan','demo','configured_plan',p.plan,'access_valid',false,'access_state','invalid','license_id',null,'max_vehicles',1,'max_events',20);
end $function$;

create or replace function public.activate_license(p_code text)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare l public.licenses;
begin
 if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
 if coalesce(trim(p_code),'')='' then raise exception 'LICENSE_CODE_REQUIRED'; end if;
 select * into l from public.licenses where upper(license_code)=upper(trim(p_code)) for update;
 if not found then raise exception 'LICENSE_NOT_FOUND'; end if;
 if l.status<>'active' then raise exception 'LICENSE_NOT_ACTIVE'; end if;
 if l.expires_at is not null and l.expires_at<=now() then update public.licenses set status='expired' where id=l.id; raise exception 'LICENSE_EXPIRED'; end if;
 if l.activated_by is not null and l.activated_by<>(select auth.uid()) then raise exception 'LICENSE_ALREADY_USED'; end if;
 update public.licenses set activated_by=(select auth.uid()),activated_at=coalesce(activated_at,now()) where id=l.id;
 insert into public.vehicle_profiles(user_id,plan,license_id) values((select auth.uid()),'pro',l.id)
 on conflict(user_id) do update set plan='pro',license_id=l.id,updated_at=now();
 return jsonb_build_object('plan','pro','license_id',l.license_code,'max_vehicles',l.max_vehicles,'max_events',l.max_events);
end $function$;

create or replace function public.owner_grant_license(p_code text,p_expires_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare l public.licenses;
begin
 if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.vehicle_profiles where user_id=(select auth.uid()) and plan='owner') then raise exception 'OWNER_ONLY'; end if;
 if coalesce(trim(p_code),'')='' then raise exception 'LICENSE_CODE_REQUIRED'; end if;
 if p_expires_at is not null and p_expires_at<=now() then raise exception 'INVALID_EXPIRY'; end if;
 insert into public.licenses(license_code,expires_at) values(upper(trim(p_code)),p_expires_at)
 on conflict(license_code) do update set status='active',expires_at=excluded.expires_at;
 select * into l from public.licenses where license_code=upper(trim(p_code));
 return jsonb_build_object('license_code',l.license_code,'status',l.status,'expires_at',l.expires_at);
end $function$;

grant execute on function public.ensure_vehicle_profile() to authenticated;
grant execute on function public.get_my_entitlement() to authenticated;
grant execute on function public.activate_license(text) to authenticated;
grant execute on function public.owner_grant_license(text,timestamptz) to authenticated;