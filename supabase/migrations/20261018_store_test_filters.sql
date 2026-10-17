CREATE OR REPLACE FUNCTION public.food_facts(confirmed_only boolean DEFAULT false)
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
select case when confirmed_only then jsonb_build_object('id',h.id,'review_status',h.review_status,'field_provenance',h.field_provenance,'source_type',h.source_type,'ai_confidence',h.ai_confidence)||h.confirmed_values else to_jsonb(h) end from public.food_history h join public.meals m on m.id=h.id and m.user_id=h.user_id where h.user_id=auth.uid() and not exists(select 1 from public.meal_details d join public.stores s on s.id=d.store_id and s.user_id=d.user_id where d.meal_id=m.id and s.is_test) and coalesce(m.navi_metadata->>'is_test','false')<>'true' and coalesce(m.navi_metadata->>'exclude_from_learning','false')<>'true' $function$

CREATE OR REPLACE FUNCTION public.get_shochu_keep_navigation_reference(p_include_finished boolean DEFAULT false)
 RETURNS TABLE(bottle_id uuid, store_id uuid, store_name text, area text, latitude double precision, longitude double precision, closed_weekdays smallint[], is_basic_closed_today boolean, brand text, remaining_percent smallint, kept_at date, last_visited_on date, days_since_last_visit integer, status text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  with japan_today as (
    select
      (current_timestamp at time zone 'Asia/Tokyo')::date as today,
      extract(dow from (current_timestamp at time zone 'Asia/Tokyo'))::smallint as weekday
  ),
  latest_visits as (
    select
      visit.store_id,
      max(visit.visited_on)::date as last_visited_on
    from public.store_visits as visit
    where visit.user_id = (select auth.uid())
    group by visit.store_id
  )
  select
    bottle.id as bottle_id,
    store.id as store_id,
    store.name as store_name,
    store.area,
    store.latitude,
    store.longitude,
    coalesce(store.closed_weekdays, '{}'::smallint[]) as closed_weekdays,
    japan_today.weekday = any(coalesce(store.closed_weekdays, '{}'::smallint[])) as is_basic_closed_today,
    bottle.brand,
    bottle.current_remaining as remaining_percent,
    bottle.kept_at::date as kept_at,
    visit_reference.last_visited_on,
    case
      when visit_reference.last_visited_on is null then null
      else (japan_today.today - visit_reference.last_visited_on)::integer
    end as days_since_last_visit,
    bottle.status
  from public.bottles as bottle
  inner join public.stores as store
    on store.id = bottle.store_id
   and store.user_id = bottle.user_id
  left join latest_visits
    on latest_visits.store_id = bottle.store_id
  cross join japan_today
  cross join lateral (
    select latest_visits.last_visited_on as last_visited_on
  ) as visit_reference
  where bottle.user_id = (select auth.uid())
    and store.user_id = (select auth.uid()) and not store.is_test
    and (
      p_include_finished
      or (bottle.status = 'active' and bottle.current_remaining > 0)
    )
  order by
    visit_reference.last_visited_on desc nulls last,
    store.name,
    bottle.brand;
$function$;

CREATE OR REPLACE FUNCTION navi_internal.guest_usage(owner_id uuid, candidate_ids text[])
 RETURNS TABLE(id text, used boolean, revisited boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
 SET statement_timeout TO '3s'
AS $function$
  SELECT m.navi_metadata->'latest_choice'->>'id' AS id,
    true AS used,
    count(DISTINCT (m.eaten_at AT TIME ZONE 'Asia/Tokyo')::date) >= 2 AS revisited
  FROM public.meals m
  JOIN public.meal_details d ON d.meal_id=m.id AND d.user_id=m.user_id
  LEFT JOIN public.stores s ON s.id=d.store_id AND s.user_id=m.user_id
  WHERE owner_id IS NOT NULL AND cardinality(candidate_ids) BETWEEN 1 AND 100
    AND m.user_id=owner_id AND NOT coalesce(s.is_test,false)
    AND coalesce(m.navi_metadata->>'is_test','false')='false'
    AND coalesce(m.navi_metadata->>'exclude_from_learning','false')='false'
    AND m.eaten_at <= statement_timestamp()
    AND m.navi_metadata->'latest_choice'->>'id' = ANY(candidate_ids)
    AND m.navi_metadata->'latest_choice'->>'id' ~ '^hotpepper:[A-Za-z0-9_-]{1,80}$'
    -- Actual current record must match the chosen external store. Never use recommendation alone.
    AND nullif(navi_internal.store_name_key(coalesce(s.name,d.unlinked_store_name)),'') = navi_internal.store_name_key(m.navi_metadata->'latest_choice'->>'name')
    AND nullif(navi_internal.store_name_key(m.navi_metadata->>'actual_visit'),'') = navi_internal.store_name_key(m.navi_metadata->'latest_choice'->>'name')
  GROUP BY m.navi_metadata->'latest_choice'->>'id';
$function$;

CREATE OR REPLACE FUNCTION navi_internal.guest_usage(owner_id uuid, candidate_ids text[], candidate_places jsonb)
 RETURNS TABLE(id text, used boolean, revisited boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
 SET statement_timeout TO '3s'
AS $function$
WITH places AS (
 SELECT p.* FROM jsonb_to_recordset(CASE WHEN jsonb_typeof(candidate_places)='array'
 AND jsonb_array_length(candidate_places)<=100 THEN candidate_places ELSE '[]'::jsonb END)
 AS p(id text,name text,latitude double precision,longitude double precision)
 WHERE owner_id IS NOT NULL AND cardinality(candidate_ids) BETWEEN 1 AND 100
 AND p.id=ANY(candidate_ids) AND p.id ~ '^hotpepper:[A-Za-z0-9_-]{1,80}$'
 AND p.latitude BETWEEN -90 AND 90 AND p.longitude BETWEEN -180 AND 180
 AND length(btrim(p.name)) BETWEEN 1 AND 200
), matches AS (
 SELECT p.id,s.id store_id,count(*) OVER(PARTITION BY p.id) external_matches,
 count(*) OVER(PARTITION BY s.id) internal_matches
 FROM places p JOIN public.stores s ON s.user_id=owner_id AND NOT s.is_test
 -- Whitespace only, no substring/fuzzy aliases. Both name and position required.
 AND navi_internal.store_name_key(s.name) =
 navi_internal.store_name_key(p.name)
 AND s.latitude BETWEEN -90 AND 90 AND s.longitude BETWEEN -180 AND 180
 AND power((s.latitude-p.latitude)*111320,2)
   +power((s.longitude-p.longitude)*111320*cos(radians(p.latitude)),2)<=625
), meal_days AS (
  SELECT m.navi_metadata->'latest_choice'->>'id' AS id,
    (m.eaten_at AT TIME ZONE 'Asia/Tokyo')::date AS visit_day
  FROM public.meals m
  JOIN public.meal_details d ON d.meal_id=m.id AND d.user_id=m.user_id
  LEFT JOIN public.stores s ON s.id=d.store_id AND s.user_id=m.user_id
  WHERE owner_id IS NOT NULL AND cardinality(candidate_ids) BETWEEN 1 AND 100
    AND m.user_id=owner_id AND NOT coalesce(s.is_test,false)
    AND coalesce(m.navi_metadata->>'is_test','false')='false'
    AND coalesce(m.navi_metadata->>'exclude_from_learning','false')='false'
    AND m.eaten_at <= statement_timestamp()
    AND m.navi_metadata->'latest_choice'->>'id' = ANY(candidate_ids)
    AND m.navi_metadata->'latest_choice'->>'id' ~ '^hotpepper:[A-Za-z0-9_-]{1,80}$'
    -- Actual current record must match the chosen external store. Never use recommendation alone.
    AND nullif(navi_internal.store_name_key(coalesce(s.name,d.unlinked_store_name)),'') = navi_internal.store_name_key(m.navi_metadata->'latest_choice'->>'name')
    AND nullif(navi_internal.store_name_key(m.navi_metadata->>'actual_visit'),'') = navi_internal.store_name_key(m.navi_metadata->'latest_choice'->>'name')

), visit_days AS (
 SELECT m.id,v.visited_on AS visit_day FROM matches m
 JOIN public.store_visits v ON v.store_id=m.store_id AND v.user_id=owner_id
 WHERE m.external_matches=1 AND m.internal_matches=1
 AND v.source='remaining_updated'
 AND v.visited_on <= (statement_timestamp() AT TIME ZONE 'Asia/Tokyo')::date
), days AS (
 SELECT * FROM meal_days UNION SELECT * FROM visit_days
)
SELECT id,true AS used,count(DISTINCT visit_day)>=2 AS revisited
FROM days GROUP BY id;
$function$;

CREATE OR REPLACE FUNCTION navi_internal.guest_known_stores(owner_id uuid, lat double precision, lng double precision, radius_m integer)
 RETURNS TABLE(store_id uuid, name text, latitude double precision, longitude double precision, used boolean, revisited boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
 SET statement_timeout TO '3s'
AS $function$
WITH nearby AS (
 SELECT s.id,s.name,s.latitude,s.longitude,
 power((s.latitude-lat)*111320,2)+power((s.longitude-lng)*111320*cos(radians(lat)),2) distance2
 FROM public.stores s
 WHERE owner_id IS NOT NULL AND s.user_id=owner_id AND NOT s.is_test
 AND lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180 AND radius_m BETWEEN 1 AND 3000
 AND s.latitude BETWEEN -90 AND 90 AND s.longitude BETWEEN -180 AND 180
 AND NOT(s.latitude=0 AND s.longitude=0) AND s.location_updated_at IS NOT NULL
 AND length(btrim(s.name)) BETWEEN 1 AND 200
 -- No structured closure flag exists; deny recorded closure markers conservatively.
 AND NOT (coalesce(s.notes,'') ~* '(閉店|閉業|廃業|permanently[ _-]*closed)' OR s.name ~ '(閉店|閉業|廃業)')
 AND power((s.latitude-lat)*111320,2)+power((s.longitude-lng)*111320*cos(radians(lat)),2)<=power(radius_m,2)
), days AS (
 SELECT v.store_id,v.visited_on visit_day FROM public.store_visits v JOIN nearby s ON s.id=v.store_id
 WHERE v.user_id=owner_id AND v.source='remaining_updated'
 AND v.visited_on <= (statement_timestamp() AT TIME ZONE 'Asia/Tokyo')::date
 UNION
 SELECT d.store_id,(m.eaten_at AT TIME ZONE 'Asia/Tokyo')::date
 FROM public.meals m JOIN public.meal_details d ON d.meal_id=m.id AND d.user_id=m.user_id
 JOIN nearby s ON s.id=d.store_id
 WHERE m.user_id=owner_id AND m.eaten_at<=statement_timestamp()
 AND coalesce(m.navi_metadata->>'is_test','false')='false'
 AND coalesce(m.navi_metadata->>'exclude_from_learning','false')='false'
 AND navi_internal.store_name_key(m.navi_metadata->>'actual_visit')=navi_internal.store_name_key(s.name)
)
SELECT s.id,s.name,s.latitude,s.longitude,true,count(DISTINCT d.visit_day)>=2
FROM nearby s JOIN days d ON d.store_id=s.id
GROUP BY s.id,s.name,s.latitude,s.longitude,s.distance2
ORDER BY s.distance2,s.id LIMIT 50;
$function$;


