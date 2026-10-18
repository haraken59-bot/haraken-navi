// Proposed pure decision logic for the navi-discover Edge Function.
// Only the photo-history store-identification mode may require a name match.
// Ordinary discovery keeps the original early-stop behavior.
export function shouldSearchExactStore({photoStoreLookup=false,hint='',candidates=[]}={}){
  if(photoStoreLookup!==true)return false;
  const name=String(hint||'').normalize('NFKC').replace(/[\s・･ー－-]/g,'').toLowerCase();
  if(!name)return false;
  return !candidates.some(c=>String(c?.name||'').normalize('NFKC').replace(/[\s・･ー－-]/g,'').toLowerCase().includes(name));
}
