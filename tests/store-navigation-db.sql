begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.app_store_links where app_key='hidaka-order' limit 1),true);
set local role authenticated;
do $test$
declare sid uuid; got uuid; testid uuid; rejected boolean;
begin
 if auth.uid() is null then raise exception 'No fixture owner';end if;
 sid:=public.confirm_navi_store('架空検証店舗-20261018',33.500001,130.300001,true);
 got:=public.confirm_navi_store('架空検証店舗-20261018',33.500001,130.300001,true);
 if sid<>got then raise exception 'duplicate';end if;
 perform public.set_store_navigation_settings(sid,array['焼き鳥','居酒屋'],'both','{}',null);
 if not exists(select 1 from public.get_navi_store_catalog() where id=sid and usage_mode='both' and genres=array['焼き鳥','居酒屋']) then raise exception 'metadata roundtrip';end if;
 rejected:=false;begin perform public.set_store_navigation_settings(sid,array['未対応'],'eat',array['焼き鳥','居酒屋'],'both');exception when others then rejected:=true;end;if not rejected then raise exception 'genre validation';end if;
 rejected:=false;begin perform public.set_store_navigation_settings(sid,'{}','drink','{}',null);exception when others then rejected:=true;end;if not rejected then raise exception 'CAS';end if;
 rejected:=false;begin perform public.confirm_navi_store('架空',91,130,true);exception when others then rejected:=true;end;if not rejected then raise exception 'coordinates';end if;
 rejected:=false;begin perform public.confirm_navi_store('架空',33,130,false);exception when others then rejected:=true;end;if not rejected then raise exception 'confirmation';end if;
 select id into testid from public.stores where is_test limit 1;
 rejected:=false;begin perform public.set_store_navigation_settings(testid,'{}',null,'{}',null);exception when others then rejected:=true;end;if not rejected then raise exception 'test store';end if;
 if exists(select 1 from public.get_shochu_keep_navigation_reference(true) r join public.stores s on s.id=r.store_id where s.is_test) then raise exception 'test bottle leak';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 if exists(select 1 from public.get_navi_store_catalog() where id=sid) then raise exception 'other read';end if;
 rejected:=false;begin perform public.set_store_navigation_settings(sid,'{}','eat',array['焼き鳥','居酒屋'],'both');exception when others then rejected:=true;end;if not rejected then raise exception 'other write';end if;
end $test$;
reset role;
set local role anon;
do $anon$ declare rejected boolean:=false;begin
 begin perform public.get_navi_store_catalog();exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'anon read';end if;
 rejected:=false;begin perform public.confirm_navi_store('架空',33,130,true);exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'anon write';end if;
end $anon$;
reset role;
rollback;
select '12 checks PASS; all fixture writes rolled back' as result;
