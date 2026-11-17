// Temporary stage diagnostics. Only these literal strings may reach the logger.
const ALLOWED = new Set([
  'discover_entered','discover_params_ok','discover_complete','discover_failed',
  'geocode_cache_check','geocode_cache_hit','hotpepper_cache_check','hotpepper_cache_hit',
  'nominatim_lease_acquired','hotpepper_lease_acquired',
  'nominatim_request_started','nominatim_request_ok','nominatim_request_failed',
  'hotpepper_request_started','hotpepper_request_ok','hotpepper_request_failed',
  'nominatim_fetch_network_failed','nominatim_fetch_timeout','nominatim_http_non_ok',
  'nominatim_http_400','nominatim_http_401','nominatim_http_403','nominatim_http_404','nominatim_http_other_4xx',
  'nominatim_http_4xx','nominatim_http_429','nominatim_http_5xx',
  'nominatim_user_agent_header_set','nominatim_accept_header_set',
  'nominatim_response_content_type_json','nominatim_response_content_type_text','nominatim_response_has_retry_after',
  'nominatim_response_parse_failed','nominatim_response_empty','nominatim_response_ok',
  'db_state_failed','cache_failed','lease_failed','config_missing',
]);
export function stageLogger(log = value => console.warn(value)) {
  return value => { if (ALLOWED.has(value)) { try { log(value); } catch { /* No logger error exposure. */ } } };
}
