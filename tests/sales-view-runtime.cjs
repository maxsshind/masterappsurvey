// Actual MV3 scraper and panel. Listing fixtures and save replies are local only.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.EXTENSION_ROOT||path.join(__dirname,'..'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'survey-sales-view-'));
const header='<h1>2405 W Geneva Dr</h1><p>17,236 SF • For Sale • Industrial Property • Tempe Southwest Submarket • Tempe, AZ 85282</p>';
const summary=header+'<h2>Listing Details</h2><div>Available Size</div><div>17,236 SF</div><div>Asking Price</div><div>$4,309,000</div><div>Price/SF</div><div>$250.00</div><div>Sale Type</div><div>Owner User</div><div>Status</div><div>Active</div><h2>Building Details</h2><div>Building Size</div><div>17,236 SF</div>';
const property=header+'<h2>Property</h2><div>RBA</div><div>17,236 SF</div><div>Land Acres</div><div>1.20 AC</div><h2>Location</h2><div>Submarket</div><div>Tempe Southwest</div><div>Submarket Cluster</div><div>Southeast</div><h2>Availabilities</h2><h3>For Sale</h3><div>Price</div><div>Individual Property ･ $4,309,000 ($250.00/SF)</div><div>Sale Type</div><div>Owner User</div><div>Status</div><div>Active</div><h2>Transaction History</h2><div>Sale Date</div><div>Jun 1995</div><div>Sold Price</div><div>$575,000 ($33.36/SF)</div><h2>Market Conditions</h2><div>Market Sale Price Per Area</div><div>$216/SF</div>';
(async()=>{let context;const blocked=[],errors=[],results=[];try{
 context=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:390,height:950},executablePath:process.env.EXTENSION_CHROMIUM_PATH,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 await context.route(/^https?:/,async route=>{const u=new URL(route.request().url());if(u.host==='product.costar.com'){let body=u.pathname.endsWith('/property')?property:summary;if(u.pathname.includes('/withheld/'))body=body.replaceAll('$4,309,000','Upon Request');return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'+body});}blocked.push(u.href);await route.abort();});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
 await worker.evaluate(()=>chrome.storage.local.set({mode:'comp'}));
 await context.addInitScript(()=>{if(!location.href.startsWith('chrome-extension:'))return;window.fixtureSaves=[];const original=chrome.runtime.sendMessage.bind(chrome.runtime);chrome.runtime.sendMessage=(m,cb)=>{
  if(m.type==='AUTH_STATUS')return cb({ok:true,connected:true,accountId:'20000000-0000-4000-8000-000000000001',email:'fixture@example.invalid'});
  if(m.type==='SEARCH_COMPS')return cb({ok:true,comps:[]});
  if(m.type==='SAVE_COMP'){fixtureSaves.push(structuredClone(m.request));return cb({ok:true,status:'saved',comp:{...m.request.p_comp,id:m.request.p_comp_id||'10000000-0000-4000-8000-000000000001',property_id:null}});}
  return original(m,cb);
 };});
 const costar=await context.newPage();await costar.goto('https://product.costar.com/listings/for-sale/detail/zqev8pz/summary');
 const panel=await context.newPage();panel.on('pageerror',e=>errors.push(e.message));await panel.goto(`chrome-extension://${id}/panel.html?view=popout`);
 await panel.waitForFunction(()=>document.querySelector('#comp_sale_price').value==='4,309,000');
 assert.equal(await panel.locator('#comp_sub_market').inputValue(),'Tempe Southwest');assert.equal(await panel.locator('#comp_building_sf').inputValue(),'17,236');
 assert.equal(await panel.evaluate(()=>comp.costarId),null);assert.equal(await panel.evaluate(()=>comp.scrape.listingId),'for-sale:zqev8pz');
 results.push('Sales Summary actual DOM -> MV3 scraper -> panel: 4,309,000 asking, Tempe Southwest, 17,236 SF; listing ID remains separate from numeric property ID');
 await panel.locator('#comp_notes').fill('Keep reviewed note');
 await costar.goto('https://product.costar.com/listings/for-sale/detail/zqev8pz/property');await panel.evaluate(()=>scanComp());
 assert.equal(await panel.locator('#comp_sale_price').inputValue(),'4,309,000');assert.equal(await panel.locator('#comp_notes').inputValue(),'Keep reviewed note');assert.equal(await panel.locator('#comp_land_area').inputValue(),'1.20');
 results.push('Sales Property current asking wins over historical 575,000 and market 216/SF; section switch retains the same draft');
 await panel.locator('#comp_sale_price').fill('4,250,000');await panel.locator('#comp_sub_market').selectOption('North Airport');await panel.evaluate(()=>scanComp());
 assert.equal(await panel.locator('#comp_sale_price').inputValue(),'4,250,000');assert.equal(await panel.locator('#comp_sub_market').inputValue(),'North Airport');
 await costar.goto('https://product.costar.com/listings/for-sale/detail/zqev8pz/summary');await panel.evaluate(()=>scanComp());
 assert.equal(await panel.locator('#comp_sale_price').inputValue(),'4,250,000');assert.equal(await panel.locator('#comp_sub_market').inputValue(),'North Airport');
 results.push('Manual asking price, official submarket and notes survive re-read and Summary/Property switching');
 await costar.goto('https://product.costar.com/listings/for-sale/detail/second/property');await panel.evaluate(()=>scanComp());
 assert.equal(await panel.locator('#comp_sale_price').inputValue(),'4,309,000');assert.equal(await panel.locator('#comp_sub_market').inputValue(),'Tempe Southwest');assert.equal(await panel.locator('#comp_notes').inputValue(),'');
 await panel.locator('#compSkipProperty').check();await panel.locator('#compSave').click();await panel.waitForFunction(()=>fixtureSaves.length===1&&!comp.saving);
 const saved=await panel.evaluate(()=>fixtureSaves[0].p_comp);assert.equal(saved.sale_price,4309000);assert.equal(saved.sub_market,'Tempe Southwest');assert.equal(saved.status,'FOR SALE');
 results.push('Different listing at the same address gets a clean draft; reviewed save sends correct numeric asking and official submarket to fixture transport');
 await costar.goto('https://product.costar.com/listings/for-sale/detail/withheld/property');await panel.evaluate(()=>scanComp());
 assert.equal(await panel.locator('#comp_sale_price').inputValue(),'');assert.match(await panel.locator('#compCompleteness').innerText(),/field.*review/);
 results.push('Withheld asking stays blank for review despite historical sold price on the page');
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 console.log(JSON.stringify({result:'passed',results,errors,blocked},null,2));
}finally{if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
