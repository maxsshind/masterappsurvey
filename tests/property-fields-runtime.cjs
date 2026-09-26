// Actual MV3 readCoStar -> panel -> fixture save, with all external traffic blocked.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.EXTENSION_ROOT||path.join(__dirname,'..'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'survey-property-facts-'));
const building='<h1>100 Fixture Way</h1><p>Phoenix, AZ 85040</p><p>North Airport Submarket</p><h2>Building</h2><div>RBA</div><div>31,600 SF</div><div>Clear Height</div><div>24\'6"</div><div>Office SF</div><div>6,600 SF</div><div>Docks</div><div>10 ext</div><div>Truck Wells</div><div>None</div><div>Drive Ins</div><div>1 tot.</div><div>Class</div><div>B</div><div>Power</div><div>200 amps</div><div>Rail Line</div><div>Union Pacific</div><div>Year Built</div><div>1980</div>';
const airportFacts = `2330 S Airport Blvd
Chandler, AZ 85286
Building
RBA
13,472 SF
Docks
None
Drive Ins
7 tot.
Levelators
None
Construction
Masonry
Clear Height
14'
Elevators
None
Rail Spots
None
CoStar Estimate
$1.39 - 1.70/IG (Industrial)
Power
800a/120 - 208v 3p Heavy
Utilities
Lighting, Sewer, Water
Pedestrian Friendly
30 - Somewhat friendly
Cycling Friendly
60 - Moderately friendly
Car Friendly
100 - Exceptionally friendly
Transit Friendly
0 - Not friendly
Parking Spaces
Surface · Available
Amenities
Air Conditioning
`;
function modal(n,area,extra=''){return `<section id="space"><p>${n} of 3 Spaces</p><h2>Space Details</h2><div>Available</div><div>${area} SF Industrial</div><div>Suite</div><div>${n}</div><div>Floor</div><div>Partial 1st</div>${extra}<div>Floor Contig</div><div>2,400 SF</div><div>Rent</div><div>Withheld</div><div>Type</div><div>Direct</div><h2>Documents</h2></section>`;}
(async()=>{let context;const results=[],errors=[],blocked=[];try{
 context=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:390,height:950},executablePath:process.env.EXTENSION_CHROMIUM_PATH,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 await context.route(/^https?:/,async route=>{if(new URL(route.request().url()).host==='product.costar.com')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'+building});blocked.push(route.request().url());await route.abort();});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 await worker.evaluate(()=>chrome.storage.local.set({mode:'comp'}));
 await context.addInitScript(()=>{if(!location.href.startsWith('chrome-extension:'))return;window.fixtureSaves=[];const original=chrome.runtime.sendMessage.bind(chrome.runtime);chrome.runtime.sendMessage=(m,cb)=>{
  if(m.type==='AUTH_STATUS')return cb({ok:true,connected:true,accountId:'20000000-0000-4000-8000-000000000001',email:'fixture@example.invalid'});
  if(m.type==='ANALYZE_COMP_LISTING')return cb({ok:true,suggestions:[],warnings:[]});
  if(m.type==='SEARCH_COMPS')return cb({ok:true,comps:[]});
  if(m.type==='SAVE_COMP'){fixtureSaves.push(structuredClone(m.request));return cb({ok:true,status:'saved',comp:{...m.request.p_comp,id:m.request.p_comp_id||'10000000-0000-4000-8000-000000000001',property_id:null}});}
  return original(m,cb);
 };});
 const costar=await context.newPage();await costar.goto('https://product.costar.com/detail/all-properties/123456/summary');
 const panel=await context.newPage();panel.on('pageerror',e=>errors.push(e.message));await panel.goto(`chrome-extension://${id}/panel.html?view=popout`);
 await panel.waitForFunction(()=>$('comp_office_sf').value==='6,600');
 assert.equal(await panel.locator('#comp_clear_height').inputValue(),'24\'6"' );assert.equal(await panel.locator('#comp_year_built').inputValue(),'1980');
 assert.equal(await panel.locator('#comp_loading').inputValue(),'Docks: 10 ext; Truck wells: None; Drive-ins: 1 tot.');
 assert.equal(await panel.locator('#comp_has_truckwell_or_dock').isChecked(),true);assert.equal(await panel.locator('#comp_class_a_answer').innerText(),'No');
 assert.equal(await panel.locator('#comp_heavy_power_answer').innerText(),'Unknown');assert.equal(await panel.locator('#comp_has_rail_answer').innerText(),'Unknown');
 results.push('Real building DOM parses feet/inches, office SF, year and labeled loading; dock evidence confirms access while raw amps/railroad do not infer flags');
 await costar.evaluate(html=>document.body.insertAdjacentHTML('beforeend',html),modal(1,'1,200','<div>Office</div><div>100 SF</div><div>Docks</div><div>None</div><div>Truck Wells</div><div>None</div>'));
 await panel.evaluate(()=>scanComp());assert.equal(await panel.locator('#comp_suite').inputValue(),'1');assert.equal(await panel.locator('#comp_office_sf').inputValue(),'100');assert.equal(await panel.locator('#comp_lease_area').inputValue(),'1,200');
 assert.equal(await panel.locator('#comp_clear_height').inputValue(),'');assert.equal(await panel.locator('#comp_has_truckwell_or_dock_answer').innerText(),'No');
 results.push('Selected suite owns measurements/loading; building office/height/docks underneath cannot populate that suite');
 await panel.locator('#comp_for_sale').uncheck();await panel.locator('#comp_for_lease').check();await panel.locator('#comp_stage').selectOption('ACTIVE');await panel.locator('#comp_sub_market').selectOption('North Airport');await panel.locator('#compSkipProperty').check();await panel.locator('#compSave').click();await panel.waitForFunction(()=>fixtureSaves.length===1&&!comp.saving);
 let saved=await panel.evaluate(()=>fixtureSaves[0].p_comp);assert.equal(saved.office_sf,100);assert.equal(saved.lease_area,1200);assert.equal(saved.has_truckwell_or_dock,false);assert.equal(saved.clear_height_ft,null);
 await costar.evaluate(html=>{document.querySelector('#space').outerHTML=html;},modal(2,'2,400'));
 await panel.evaluate(()=>scanComp());assert.equal(await panel.evaluate(()=>comp.mode),'insert');assert.equal(await panel.locator('#comp_suite').inputValue(),'2');assert.equal(await panel.locator('#comp_office_sf').inputValue(),'');assert.equal(await panel.locator('#comp_has_truckwell_or_dock_answer').innerText(),'Unknown');
 results.push('Reviewed save sends exact typed facts; same-property next suite leaves prior saved deal and clears unavailable facts');
 await costar.evaluate(html=>{document.querySelector('#space').outerHTML=html;},modal(3,'5,000 - 10,000','<div>Office</div><div>600 SF</div><div>Docks</div><div>10 ext</div>'));
 await panel.evaluate(()=>scanComp());for(const f of ['office_sf','lease_area','loading','has_truckwell_or_dock'])assert.equal(await panel.locator('#comp_'+f).inputValue(),'');
 assert.match(await panel.locator('#compPropertySource').innerText(),/Divisible/);
 results.push('Divisible source keeps office/loading/access unallocated pending offered-portion review');

 await costar.evaluate(()=>{document.querySelector('#space').remove();document.body.innerHTML=document.body.innerHTML.replace('24\'6"',"22-24'");});
 await panel.evaluate(()=>scanComp());assert.equal(await panel.locator('#comp_clear_height').inputValue(),"22-24'");await panel.locator('#comp_for_sale').check();await panel.locator('#comp_for_lease').uncheck();await panel.locator('#comp_sub_market').selectOption('North Airport');await panel.locator('#compSave').click();await panel.waitForFunction(()=>fixtureSaves.length===2&&!comp.saving);
 saved=await panel.evaluate(()=>fixtureSaves.at(-1).p_comp);assert.equal(saved.clear_height,"22-24'");assert.equal(saved.clear_height_ft,null);assert.equal(await panel.locator('#comp_clear_height').inputValue(),"22-24'");
 results.push('Real CoStar height range22-24\' survives DOM capture, reviewed save and authoritative readback exactly; numeric mirror is null');

 await costar.goto('https://product.costar.com/listings/for-sale/detail/university/property');
 await costar.evaluate(()=>{document.body.innerHTML=`<h1>1840 E University Dr</h1><p>Tempe, AZ 85281</p><p>Tempe Southwest Submarket</p><h2>Building</h2><div>Type</div><div>3 Star Industrial Warehouse</div><div>Location</div><div>Urban</div><div>RBA</div><div>31,426 SF</div><div>Class</div><div>B</div><div>Year Built</div><div>1985</div><div>Docks</div><div>None</div><div>Drive Ins</div><div>6 tot.</div><div>Clear Height</div><div>17'</div><div>Truck Wells</div><div>None</div><div>Property Mix</div><div>Industrial ･ 25,141 SF ･ 80.0%Office ･ 6,285 SF ･ 20.0%</div><div>Power</div><div>600a/277 - 480v 3p</div><div>Opportunity Zone</div><div>Yes</div><h2>Availabilities</h2><h3>For Sale</h3><div>Price</div><div>Individual Property ･ $8,000,000 ($254.57/SF)</div><div>Sale Type</div><div>Investment</div><div>Status</div><div>Active</div><h3>Sale Highlights</h3><p>±31,426 SF total: ±21,426 SF warehouse and ±10,000 SF office space.</p><p>600AMP 277/480V 3-Phase power, 6 drive-ins, sprinklers, up to 17' clear height.</p><h3>External Links</h3><p>Offering Memorandum</p>`;});
 await panel.evaluate(()=>scanComp());
 assert.equal(await panel.locator('#comp_office_sf').inputValue(),'10,000');assert.equal(await panel.locator('#comp_clear_height').inputValue(),"17'");assert.equal(await panel.locator('#comp_power').inputValue(),'600AMP 277/480V 3-Phase power');
 assert.match(await panel.locator('#comp_office_sf').locator('..').innerText(),/Sale highlights/);assert.equal(await panel.locator('#comp_heavy_power_answer').innerText(),'Unknown');assert.equal(await panel.locator('#comp_has_truckwell_or_dock_answer').innerText(),'No');
 await panel.locator('#compSave').click();await panel.waitForFunction(()=>fixtureSaves.length===3&&!comp.saving);
 saved=await panel.evaluate(()=>fixtureSaves.at(-1).p_comp);assert.equal(saved.office_sf,10000);assert.equal(saved.clear_height,"17'");assert.equal(saved.power,'600AMP 277/480V 3-Phase power');assert.equal(saved.heavy_power,null);
 results.push('University Sales Property DOM ignores Property Mix; captures advertised10,000office,17ftheight,600Apower through save/readback without heavy-power inference');
 await costar.evaluate(()=>{document.body.innerHTML=document.body.innerHTML.replace('±10,000 SF office space.','renovated office space.');});
 await panel.evaluate(()=>{resetCompForm();return scanComp();});assert.equal(await panel.locator('#comp_office_sf').inputValue(),'');assert.equal(await panel.locator('#comp_power').inputValue(),'600AMP 277/480V 3-Phase power');
 results.push('PropertyMix-only office allocation stays blank; valid fields after Property Mix still capture');
 await panel.locator('#comp_power').fill('3,400 amps, 277/480V, 3-phase');await panel.locator('#comp_office_sf').fill('9,500');await panel.evaluate(()=>scanComp());assert.equal(await panel.locator('#comp_power').inputValue(),'3,400 amps, 277/480V, 3-phase');assert.equal(await panel.locator('#comp_office_sf').inputValue(),'9,500');
 results.push('Manually reviewed Power and office size survive an actual worker re-read');

 await costar.goto('https://product.costar.com/listings/for-sale/detail/byqk26b/property');
 await costar.evaluate(text=>{document.body.innerHTML='<pre></pre>';document.querySelector('pre').textContent=text;},airportFacts);
 await panel.evaluate(()=>scanComp());
 assert.equal(await panel.locator('#comp_power').inputValue(),'');
 assert.equal(await panel.locator('#compPowerFallbackValue').innerText(),'800a/120 - 208v 3p Heavy');
 assert.equal(await panel.locator('#comp_loading').inputValue(),'Docks: None; Drive-ins: 7 tot.');
 await panel.locator('#compSkipPropertyPower').click();await panel.evaluate(()=>scanComp());
 assert.equal(await panel.locator('#comp_power').inputValue(),'');assert.equal(await panel.locator('#compPowerFallback').isVisible(),false);
 results.push('Airport screenshot DOM bounds property Power at Utilities and excludes Levelators from Loading; Keep blank survives real re-read');
 await panel.evaluate(()=>{resetCompForm();return scanComp();});await panel.locator('#compUsePropertyPower').click();
 assert.equal(await panel.locator('#comp_power').inputValue(),'800a/120 - 208v 3p Heavy');
 await panel.locator('#comp_sub_market').selectOption('North Airport');await panel.locator('#compSave').click();await panel.waitForFunction(()=>fixtureSaves.length===4&&!comp.saving);
 saved=await panel.evaluate(()=>fixtureSaves.at(-1).p_comp);assert.equal(saved.power,'800a/120 - 208v 3p Heavy');assert.equal(saved.loading,'Docks: None; Drive-ins: 7 tot.');assert.equal(saved.heavy_power,null);
 results.push('Explicit property choice alone sends clean Airport power through reviewed save/readback; no heavy-power inference');
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);console.log(JSON.stringify({result:'passed',results,errors,blocked},null,2));
}finally{if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
