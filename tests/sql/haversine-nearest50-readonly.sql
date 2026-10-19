-- READ ONLY: no stores inserted, no function replaced, no production changes.
-- Run in Supabase SQL Editor to validate Haversine nearest-50 ranking and
-- north/south/east/west 499/500/501m boundary expectations.
DO $test$
DECLARE picked int[]; bad_count int;
BEGIN
 WITH generated AS (
  SELECT n,32.74::float8+(81-n)*0.00001 AS latitude,129.88::float8 longitude
  FROM generate_series(1,80) n
 ), distances AS (
  SELECT n,12742000*asin(least(1.0,sqrt(
   power(sin(radians(latitude-32.74)/2),2)
   +cos(radians(32.74))*cos(radians(latitude))
    *power(sin(radians(longitude-129.88)/2),2)
  ))) distance_m FROM generated
 )
 SELECT array_agg(n ORDER BY n) INTO picked FROM (
  SELECT n FROM distances WHERE distance_m<=500
  ORDER BY distance_m,n LIMIT 50
 ) nearest;
 IF cardinality(picked)<>50 OR picked[1]<>31 OR picked[50]<>80 THEN
  RAISE EXCEPTION 'nearest 50 incorrect: %',picked;
 END IF;

 WITH v AS (
  SELECT m,dir FROM (VALUES (499.0::float8),(500.0),(501.0)) t(m)
  CROSS JOIN (VALUES ('north'),('south'),('east'),('west')) d(dir)
 ), pts AS (
  SELECT m,dir,
  CASE WHEN dir='north' THEN 32.74+degrees(m/6371000.0)
       WHEN dir='south' THEN 32.74-degrees(m/6371000.0)
       ELSE 32.74 END latitude,
  CASE WHEN dir='east' THEN 129.88+degrees(m/(6371000.0*cos(radians(32.74))))
       WHEN dir='west' THEN 129.88-degrees(m/(6371000.0*cos(radians(32.74))))
       ELSE 129.88 END longitude
  FROM v
 ), distances AS (
  SELECT m,12742000*asin(least(1.0,sqrt(
   power(sin(radians(latitude-32.74)/2),2)
   +cos(radians(32.74))*cos(radians(latitude))
    *power(sin(radians(longitude-129.88)/2),2)
  ))) distance_m FROM pts
 )
 SELECT count(*) INTO bad_count FROM distances
 WHERE (distance_m<=500) IS DISTINCT FROM (m<=500);
 IF bad_count<>0 THEN RAISE EXCEPTION 'boundary mismatches: %',bad_count; END IF;
 RAISE NOTICE 'PASS: 80 candidates -> nearest 50 (31..80); 12 directional boundaries';
END
$test$;
