// Preview-only auth gate. Not imported by any deployed function.
// A dedicated preview endpoint can wrap the existing owner-only handler,
// but must never enable guest-discover or connect to the preview DB before auth.
import {createHandler,allowedOrigins} from '../navi-discover/handler.mjs';

export function createPhotoPreviewHandler({verifyUser,database,ownerId,discover,origins=allowedOrigins(),log}){
 const memberHandler=createHandler({
  verifyUser,database,ownerId,discover,origins,log,
  // Explicitly deny the public guest route; no DB read or external discovery.
  guestDiscover:async()=>{throw new Error('guest_disabled');},
  knownStores:async()=>[],
  usage:async()=>[],
 });
 return req=>{
  const url=new URL(req.url);
  if(url.searchParams.get('mode')==='guest-discover')
   return Response.json({ok:false,error:'preview_owner_only'},{status:403,headers:{'Cache-Control':'no-store'}});
  if(!['discover','owner-check'].includes(url.searchParams.get('mode')))
   return Response.json({ok:false,error:'preview_mode_not_allowed'},{status:404,headers:{'Cache-Control':'no-store'}});
  return memberHandler(req);
 };
}
