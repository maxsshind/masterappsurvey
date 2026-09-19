/* Offered-space facts. Keep unknowns distinct from confirmed No and zero. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CompPropertyFields=api;})(globalThis,function(){
'use strict';
const flags=['class_a','heavy_power','has_rail','has_truckwell_or_dock'];
const fields=['clear_height','office_sf','lease_area','year_built','loading','power',...flags];
const propertyTypes=['ISF','IOS','Class A','Class B','Vintage','Flex','Land','Cold Storage'];
function normalizePropertyTypes(value){return [...new Set((Array.isArray(value)?value:[value||'']).flatMap(v=>String(v).split(/[,;]/)).map(v=>v.trim()).filter(Boolean).map(v=>/^class c$/i.test(v)?'Vintage':propertyTypes.find(t=>t.toLowerCase()===v.toLowerCase())||v))];}
const labels={clear_height:'Clear height',clear_height_ft:'Clear height',office_sf:'Office SF',lease_area:'Available lease SF',year_built:'Year built',loading:'Loading',power:'Power',class_a:'Class A',heavy_power:'Heavy power',has_rail:'Has rail',has_truckwell_or_dock:'Has truckwell or dock'};
function height(value){
 const t=String(value??'').trim().toLowerCase().replace(/[′’]/g,"'").replace(/[″“”]/g,'"').replace(/^clear\s+height\s*:?\s*/,'').replace(/\s+clear(?:\s+height)?$/,'').trim();
 const d=t.match(/^(\d+(?:\.\d+)?|\.\d+)\s*(?:ft\.?|feet|foot|')?$/);
 if(d)return Number(d[1])>0?Number(d[1]):null;
 const m=t.match(/^(\d+)\s*(?:ft\.?|feet|foot|')\s*(?:-\s*)?(\d+(?:\.\d+)?)\s*(?:in\.?|inches|inch|")$/);
 if(!m||Number(m[2])>=12)return null;const n=Number(m[1])+Number(m[2])/12;return n>0?n:null;
}
function area(value){const m=String(value??'').trim().match(/^((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)\s*(k)?\s*(?:sf|sq\.?\s*ft\.?|square feet)?$/i);return m?Number(m[1].replaceAll(',',''))*(m[2]?1000:1):null;}
function parse(field,value){
 if(value==null||(typeof value==='string'&&!value.trim()))return {value:null};
 if(field==='clear_height')return typeof value==='string'&&value.trim().length<=200?{value:value.trim()||null}:{value:null,error:'Clear height must be text up to 200 characters.'};
 if(flags.includes(field)){if(value===true||value==='true')return {value:true};if(value===false||value==='false')return {value:false};return {value:null,error:`${labels[field]} must be Yes, No or Unknown.`};}
 if(['loading','power'].includes(field))return typeof value==='string'&&value.trim().length<=4000?{value:value.trim()||null}:{value:null,error:`${labels[field]} must be text up to 4,000 characters.`};
 let n=field==='clear_height_ft'?height(value):field==='year_built'&&/^\d{4}$/.test(String(value).trim())?Number(value):field==='year_built'?null:area(value);
 if(n===null||!Number.isFinite(n)||n>Number.MAX_SAFE_INTEGER||(field==='lease_area'&&n<=0)||(field==='year_built'&&(n<1000||n>2200)))return {value:null,error:`${labels[field]} must be one confirmed ${field==='clear_height_ft'?'positive height in feet':field==='year_built'?'year from 1000 to 2200':'nonnegative area in SF'}. Leave unknown values blank.`};
 return {value:n};
}
function serialize(raw){const values={},issues=[];for(const f of fields){const p=parse(f,raw[f]);values[f]=p.value;if(p.error)issues.push({field:f,message:p.error});}values.clear_height_ft=height(values.clear_height);return {values,issues};}
function answer(raw){return /^(yes|true)$/i.test(String(raw??'').trim())?true:/^(no|none|false)$/i.test(String(raw??'').trim())?false:null;}
function count(raw){if(/^(none|no|0)$/i.test(String(raw??'').trim()))return 0;const m=String(raw??'').trim().match(/^(\d+)\s*(?:ext\.?|tot\.?)?$/i);return m?Number(m[1]):null;}
function fromScrape(d){
 const f=d.selectedSpace?.availableRange?{}:d.propertyFacts||{},values={},unresolved=[],sources={};
 if(f.officeReview)unresolved.push(f.officeReview);
 if(f.officeSource)sources.office_sf=f.officeSource;
 if(d.selectedSpace?.availableRange)unresolved.push('Divisible space: confirm office and loading for the offered portion.');
 for(const [field,raw] of [['clear_height',f.clearHeight],['office_sf',f.officeSf],['lease_area',d.selectedSpace?.availableRange?null:d.selectedSpace?.availableSf],['year_built',d.yearBuilt]]){
  if(raw==null||raw==='')continue;const p=parse(field,raw);if(p.error)unresolved.push(`${labels[field]}: ${raw}`);else values[field]=p.value;
 }
 for(const field of ['loading','power'])if(f[field] && (field !== 'power' || ['Sale highlights','Sale notes','Description','Property Description','Listing Description','Space highlights','Space notes'].includes(f.powerSource))){const p=parse(field,f[field]);if(p.error)unresolved.push(`${labels[field]}: source text exceeds 4,000 characters.`);else values[field]=p.value;}
 for(const [field,raw] of [['class_a',f.classA],['heavy_power',f.heavyPower],['has_rail',f.hasRail],['has_truckwell_or_dock',f.hasTruckwellOrDock]]){const value=answer(raw);if(value!==null)values[field]=value;}
 if(values.has_truckwell_or_dock===undefined){const docks=count(f.docks),wells=count(f.truckWells);if(docks>0||wells>0)values.has_truckwell_or_dock=true;else if(docks===0&&wells===0)values.has_truckwell_or_dock=false;}
 // Raw power and rail names do not establish heavy power or usable rail access.
 if(f.railLine&&!Object.hasOwn(values,'has_rail'))unresolved.push(`Rail source: ${f.railLine}`);
 if(values.power)sources.power=f.powerSource;
 // Older scrape caches have no source marker: re-read before offering their text.
 const fallback=parse('power',f.powerFallback);
 return {values,unresolved,sources,powerFallback:!values.power&&!fallback.error?fallback.value:null};
}
function rowValue(row,field){return field==='clear_height'?(row.clear_height??(row.clear_height_ft==null?null:String(row.clear_height_ft))):row[field];}
return {fields,flags,labels,rowValue,propertyTypes,normalizePropertyTypes,height,area,parse,serialize,fromScrape};
});
