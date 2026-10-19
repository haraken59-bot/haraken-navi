-- TEST-ONLY TRANSACTION. REVIEW BEFORE RUNNING ON A SHARED DATABASE.
-- Inserts 80 temporary test records into public.stores, calls ONLY the
-- navi_internal.guest_known_stores_unvisited_test function, then ROLLBACK.
-- The owner is selected from existing public.stores. No existing rows changed.
-- If any statement errors, manually issue ROLLBACK in the same SQL session.
BEGIN;
DO $test$
DECLARE
 owner uuid;
 center_lat float8 := 32.74;
 center_lng float8 := 129.88;
 result_count integer;
 nearest_count integer;
 wrong_count integer;
BEGIN
 SELECT user_id INTO owner FROM public.stores WHERE user_id IS NOT NULL LIMIT 1;
 IF owner IS NULL THEN RAISE EXCEPTION 'No owner available'; END IF;
 INSERT INTO public.stores(user_id,name,latitude,longitude,location_updated_at,is_test,notes)
 SELECT owner, 'HKN_80_DISTANCE_TEST_' || lpad(n::text,3,'0'),
 center_lat + (81-n)*0.00001,center_lng,now(),false,'temporary transaction-only regression'
 FROM generate_series(1,80) n;
 WITH selected AS (
 SELECT name FROM navi_internal.guest_known_stores_unvisited_test(owner,center_lat,center_lng,500)
 )
 SELECT count(*),
 count(*) FILTER (WHERE name LIKE 'HKN_80_DISTANCE_TEST_%'),
 count(*) FILTER (WHERE name LIKE 'HKN_80_DISTANCE_TEST_%' AND
   substring(name from '([0-9]{3})$')::integer < 31)
 INTO result_count,nearest_count,wrong_count FROM selected;
 IF result_count<>50 OR nearest_count<>50 OR wrong_count<>0 THEN
  RAISE EXCEPTION 'nearest-50 failed: total %, test %, wrong %',
   result_count,nearest_count,wrong_count;
 END IF;
 RAISE NOTICE 'PASS: test function selected the nearest 50 from 80 reverse-ordered test stores';
END
$test$;
ROLLBACK;
-- After rollback, independently verify:
-- SELECT count(*) FROM public.stores WHERE name LIKE 'HKN_80_DISTANCE_TEST_%';
