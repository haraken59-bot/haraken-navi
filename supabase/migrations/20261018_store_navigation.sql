-- Additive shared-store metadata; existing IDs and sync columns stay unchanged.
alter table public.stores add column genres text[] not null default '{}',
 add column usage_mode text,
 add column is_test boolean not null default false;
alter table public.stores add constraint stores_genres_allowed check
 (genres <@ array['焼き鳥','居酒屋','焼肉','中華','和食','スナック','バー','その他']::text[] and array_position(genres,null) is null),
 add constraint stores_usage_mode_allowed check (usage_mode in ('both','eat','drink'));
create or replace function public.get_navi_store_catalog()
returns table(id uuid,name text,area text,latitude double precision,longitude double precision,genres text[],usage_mode text,is_test boolean,closed_weekdays smallint[])
language sql stable security invoker set search_path=pg_catalog as $$
 select s.id,s.name,s.area,s.latitude,s.longitude,s.genres,s.usage_mode,s.is_test,s.closed_weekdays
 from public.stores s where s.user_id=(select auth.uid()) order by s.name,s.id limit 1000
$$;
revoke all on function public.get_navi_store_catalog() from public,anon;
grant execute on function public.get_navi_store_catalog() to authenticated;
create or replace function public.set_store_navigation_settings(p_store_id uuid,p_genres text[],p_usage_mode text,p_expected_genres text[],p_expected_usage_mode text)
returns void language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_genres is null or not(p_genres <@ array['焼き鳥','居酒屋','焼肉','中華','和食','スナック','バー','その他']::text[]) or array_position(p_genres,null) is not null
 or cardinality(p_genres)>8 or (p_usage_mode is not null and p_usage_mode not in ('both','eat','drink')) then raise exception 'Invalid settings'; end if;
 update public.stores set genres=p_genres,usage_mode=p_usage_mode
 where id=p_store_id and user_id=auth.uid() and not is_test
 and genres is not distinct from p_expected_genres and usage_mode is not distinct from p_expected_usage_mode;
 if not found then raise exception 'Store unavailable or settings changed'; end if;
end $$;
revoke all on function public.set_store_navigation_settings(uuid,text[],text,text[],text) from public,anon;
grant execute on function public.set_store_navigation_settings(uuid,text[],text,text[],text) to authenticated;

