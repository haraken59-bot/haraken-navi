create or replace function public.confirm_navi_store(p_name text,p_latitude double precision,p_longitude double precision,p_confirmed boolean)
returns uuid language plpgsql security invoker set search_path=pg_catalog as $$
declare uid uuid:=auth.uid(); ids uuid[]; result uuid; title text:=btrim(p_name);
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if p_confirmed is distinct from true or title is null or length(title) not between 1 and 120
 or p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90 and p_longitude between -180 and 180)
 or (p_latitude=0 and p_longitude=0) then raise exception 'Invalid confirmed store'; end if;
 if title in ('やきとり日高','やきとりひだか') then title:='やきとり ひだか';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||lower(regexp_replace(title,'[[:space:]]','','g')),0));
 select array_agg(s.id) into ids from public.stores s where s.user_id=uid and not s.is_test
 and lower(regexp_replace(s.name,'[[:space:]]','','g'))=lower(regexp_replace(title,'[[:space:]]','','g'))
 and power((s.latitude-p_latitude)*111320,2)+power((s.longitude-p_longitude)*111320*cos(radians(p_latitude)),2)<=625;
 if cardinality(ids)>1 then raise exception 'Ambiguous store'; end if;
 if cardinality(ids)=1 then return ids[1]; end if;
 -- A same-name record without a reliable location must not be silently duplicated.
 if exists(select 1 from public.stores s where s.user_id=uid and not s.is_test and lower(regexp_replace(s.name,'[[:space:]]','','g'))=lower(regexp_replace(title,'[[:space:]]','','g'))) then raise exception 'Confirm existing store location first';end if;
 insert into public.stores(user_id,name,latitude,longitude,location_updated_at) values(uid,title,p_latitude,p_longitude,now()) returning id into result;
 return result;
end $$;
revoke all on function public.confirm_navi_store(text,double precision,double precision,boolean) from public,anon;
grant execute on function public.confirm_navi_store(text,double precision,double precision,boolean) to authenticated;

