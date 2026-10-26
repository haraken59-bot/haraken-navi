import {normalizeStoreName} from './importer/records.js';
import {photoPoint} from './store-link-ui.js?v=20261027-five-core';

// A recommended venue is already identified by the recommendation flow.
// GPS is only supporting evidence, never a reason to overwrite that choice.
export function shouldOfferPostSaveStoreLink(meal){
 if(!meal||meal.store_id||!meal.unlinked_store_name||!photoPoint(meal.navi_metadata))return false;
 const chosen=meal.navi_metadata?.latest_choice;
 if(chosen?.name&&normalizeStoreName(chosen.name)===normalizeStoreName(meal.unlinked_store_name))return false;
 return true;
}
