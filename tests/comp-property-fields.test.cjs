const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const f=require(path.join(process.env.EXTENSION_ROOT||path.join(__dirname,'..'),'comp-property-fields.js'));
for(const [raw,value] of [["24'6\"",24.5],['18 ft',18],['  ',null],['0',null],['24-30 ft',null],['24 m',null]])test(`clear height ${raw} keeps exact units`,()=>assert.equal(f.parse('clear_height_ft',raw).value,value));
test('office zero and commas retained; malformed/ranged values blocked',()=>{assert.deepEqual(f.parse('office_sf','0'),{value:0});assert.deepEqual(f.parse('office_sf','4,500'),{value:4500});for(const s of ['4,50','400-500','-1'])assert.ok(f.parse('office_sf',s).error);});
test('year/lease/loading constraints match confirmed contract',()=>{assert.ok(f.parse('year_built','2000s').error);assert.ok(f.parse('lease_area','0').error);assert.ok(f.parse('loading','x'.repeat(4001)).error);assert.equal(f.parse('loading','Grade-level only').value,'Grade-level only');});
test('feature flags retain true false and unknown',()=>{for(const k of f.flags){for(const [raw,value] of [['true',true],['false',false],['',null],[null,null]])assert.deepEqual(f.parse(k,raw),{value});assert.ok(f.parse(k,'unknown text').error);}});
test('office and height source parsed; power/rail proximity do not become confirmations',()=>{const r=f.fromScrape({yearBuilt:'1980',propertyFacts:{clearHeight:'24\'6"',officeSf:'4,500 SF',power:'200 amps',powerSource:'Sale highlights',railLine:'Union Pacific',docks:'None'}});assert.equal(r.values.clear_height,'24\'6"');assert.equal(r.values.office_sf,4500);assert.equal(r.values.heavy_power,undefined);assert.equal(r.values.has_rail,undefined);assert.equal(r.values.has_truckwell_or_dock,undefined);assert.equal(r.values.power,'200 amps');assert.equal(r.unresolved.length,1);});
test('positive dock/truckwell is explicit access evidence; both absent needed for No',()=>{assert.equal(f.fromScrape({propertyFacts:{docks:'2 ext'}}).values.has_truckwell_or_dock,true);assert.equal(f.fromScrape({propertyFacts:{docks:'None',truckWells:'None'}}).values.has_truckwell_or_dock,false);assert.equal(f.fromScrape({propertyFacts:{docks:'0'}}).values.has_truckwell_or_dock,undefined);});
test('divisible source never allocates whole-source office/loading or feature flags',()=>{const r=f.fromScrape({yearBuilt:'1980',selectedSpace:{availableRange:{min:'5000',max:'10000'},availableSf:null},propertyFacts:{officeSf:'600',loading:'Docks: 10 ext',docks:'10 ext',heavyPower:'Yes'}});assert.deepEqual(r.values,{year_built:1980});assert.match(r.unresolved[0],/confirm/);});
test('invalid values report fields before any save payload can be accepted',()=>{const r=f.serialize({clear_height:'x'.repeat(201),office_sf:'bad',heavy_power:'bad',loading:'x'.repeat(4001)});assert.deepEqual(r.issues.map(i=>i.field),['clear_height','office_sf','loading','heavy_power']);});

test('property types match current canonical list and normalize legacy Class C',()=>{assert.deepEqual(f.propertyTypes,['ISF','IOS','Class A','Class B','Vintage','Flex','Land','Cold Storage']);assert.deepEqual(f.normalizePropertyTypes('ISF;Class C, Vintage'),['ISF','Vintage']);});

for(const raw of ["22-24'",'22–24′','18–22 ft depending on bay','sloped roof; verify each bay'])test(`preserves height description ${raw}`,()=>{const r=f.serialize({clear_height:raw});assert.equal(r.values.clear_height,raw);assert.equal(r.values.clear_height_ft,null);assert.equal(r.issues.length,0);});
test('scalar retains reviewed text alongside precise numeric equivalent; blank clears both',()=>{const r=f.serialize({clear_height:'  24\'6"  '});assert.equal(r.values.clear_height,'24\'6"');assert.equal(r.values.clear_height_ft,24.5);const blank=f.serialize({clear_height:''}).values;assert.equal(blank.clear_height,null);assert.equal(blank.clear_height_ft,null);});
test('legacy numeric records hydrate while stored text takes precedence',()=>{assert.equal(f.rowValue({clear_height:null,clear_height_ft:24.5},'clear_height'),'24.5');assert.equal(f.rowValue({clear_height:"22-24'",clear_height_ft:24},'clear_height'),"22-24'");});

test('power text preserves exact specifications without setting Heavy power',()=>{const text='3,400 amps, 277/480V, 3-phase';assert.equal(f.serialize({power:'  '+text+'  '}).values.power,text);assert.equal(f.serialize({power:text}).values.heavy_power,null);assert.equal(f.serialize({power:''}).values.power,null);assert.ok(f.parse('power','x'.repeat(4001)).error);assert.ok(f.parse('power',3400).error);});

test('Unmarked legacy power never silently prefills or becomes a fallback',()=>{
 const r=f.fromScrape({propertyFacts:{power:'200 amps\nUtilities\nWater'}});assert.equal(r.values.power,undefined);assert.equal(r.powerFallback,null);
});
test('Only bounded property power is offered; marketing always wins',()=>{
 let r=f.fromScrape({propertyFacts:{powerFallback:'800a/120 - 208v 3p Heavy'}});assert.equal(r.values.power,undefined);assert.equal(r.powerFallback,'800a/120 - 208v 3p Heavy');
 r=f.fromScrape({propertyFacts:{power:'1000 amps',powerSource:'Sale highlights',powerFallback:'800 amps'}});assert.equal(r.values.power,'1000 amps');assert.equal(r.sources.power,'Sale highlights');assert.equal(r.powerFallback,null);
 assert.equal(f.fromScrape({propertyFacts:{powerFallback:'x'.repeat(4001)}}).powerFallback,null);
});
test('Divisible portions cannot automatically inherit marketing power or property power fallback',()=>{
 const r=f.fromScrape({selectedSpace:{availableRange:{min:5000,max:10000}},propertyFacts:{power:'800 amps',powerSource:'Space notes',powerFallback:'600 amps'}});assert.equal(r.values.power,undefined);assert.equal(r.powerFallback,null);
});
