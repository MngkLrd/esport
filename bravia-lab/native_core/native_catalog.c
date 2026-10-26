#include "native_catalog.h"
#include <string.h>
/* Sony service strings below are only candidate labels. They cannot prove
 * the existence of an installed application or playback support. */
static const BraviaCatalogEntry entries[BRAVIA_CATALOG_APPS] = {
 {"kinopoisk", "Кинопоиск", NULL, 0},
 {"ivi", "Иви", "ivi", 1},
 {"start", "START", "START", 1},
 {"netflix", "Netflix", "Netflix", 1},
 {"youtube", "YouTube", "YouTube", 1},
 {"rutube", "RUTUBE", NULL, 0},
 {"mediax", "Media Station X", NULL, 0},
 {"alpac", "Al(co)pac", NULL, 0},
 {"browser", "Браузер", "browser_base", 1},
 {"kion", "КИОН", NULL, 0}
};
const BraviaCatalogEntry *bravia_catalog_get(size_t index){
 return index<BRAVIA_CATALOG_APPS?&entries[index]:NULL;
}
int bravia_catalog_validate(void){
 size_t i,j;
 for(i=0;i<BRAVIA_CATALOG_APPS;i++){
  if(!entries[i].slug||!entries[i].name||!entries[i].slug[0]||
     !entries[i].name[0])return -1;
  if(entries[i].sony_alias_is_candidate &&
     (!entries[i].stock_alias||!entries[i].stock_alias[0]))return -1;
  for(j=0;j<i;j++)
   if(strcmp(entries[i].slug,entries[j].slug)==0)return -1;
 }
 return 0;
}
BraviaRoute bravia_catalog_resolve(size_t index,
                                  const BraviaHostService *live,
                                  size_t live_count){
 BraviaRoute result={BRAVIA_ROUTE_UNAVAILABLE,-1};
 const BraviaCatalogEntry *app=bravia_catalog_get(index);
 size_t i;int matches=0;
 if(!app || live_count>BRAVIA_MAX_SERVICES || (live_count && !live)){
  result.status=BRAVIA_ROUTE_INVALID;return result;
 }
 if(!app->sony_alias_is_candidate)return result;
 for(i=0;i<live_count;i++){
  if(!live[i].name)continue;
  if(strcmp(live[i].name,app->stock_alias)!=0)continue;
  if(!live[i].registered || !live[i].host_verified ||live[i].service_id<0)
   continue;
  matches++;
  result.service_id=live[i].service_id;
 }
 if(matches==1)result.status=BRAVIA_ROUTE_READY;
 else if(matches>1){result.status=BRAVIA_ROUTE_AMBIGUOUS;result.service_id=-1;}
 else result.service_id=-1;
 return result;
}
