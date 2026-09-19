// Actual MV3 readCoStar -> panel -> fixture save, with all external traffic blocked.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(process.env.EXTENSION_ROOT||path.join(__dirname,'..'));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'survey-property-facts-'));
const building='<h1>100 Fixture Way</h1><p>Phoenix, AZ 85040</p><p>North Airport Submarket</p><h2>Building</h2><div>RBA</div><div>31,600 SF</div><div>Clear Height</div><div>24\'6"</div><div>Office SF</div><div>6,600 SF</div><div>Docks</div><div>10 ext</div><div>Truck Wells</div><div>None</div><div>Drive Ins</div><div>1 tot.</div><div>Class</div><div>B</div><div>Power</div><div>200 amps</div><div>Rail Line</div><div>Union Pacific</div><div>Year Built</div><div>1980</div>';
function modal(n,area,extra=''){return `<section id="space"><p>${n} of 3 Spaces</p><h2>Space Details</h2><div>Available</div><div>${area} SF Industrial</div><div>Suite</div><div>${n}</div><div>Floor</div><div>Partial 1st</div>${extra}<div>Floor Contig</div><div>2,400 SF</div><div>Rent</div><div>Withheld</div><div>Type</div><div>Direct</div><h2>Documents</h2></section>`;}
(async()=>{let context;const results=[],errors=[],blocked=[];try{
 context=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:390,height:950},executablePath:process.env.EXTENSION_CHROMIUM_PATH,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 await context.route(/^https?:/,async route=>{if(new URL(route.request().url()).host==='product.costar.com')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'+building});blocked.push(route.request().url());await route.abort();});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).host;
 await worker.evaluate(()=>chrome.storage.local.set({mode:'comp'}));
 await context.addInitScript(()=>{if(!location.href.startsWith('chrome-extension:'))return;window.fixtureSaves=[];const original=chrome.runtime.sendMessage.bind(chrome.runtime);chrome.runtime.sendMessage=(m,cb)=>{
  if(m.type==='AUTH_STATUS')return cb({ok:true,connected:true,accountId:'20000000-0000-4000-8000-000000000001',email:'fixture@example.invalid'});
  if(m.type==='SEARCH_COMPS')return cb({ok:true,comps:[]});
  if(m.type==='SAVE_COMP'){fixtureSaves.push(structuredClone(m.request));return cb({ok:true,status:'saved',comp:{...m.request.p_comp,id:m.request.p_comp_id||'10000000-0000-4000-8000-000000000001',property_id:null}});}
  return original(m,cb);
 };});
 const costar=await context.newPage();await costar.goto('https://product.costar.com/detail/all-properties/123456/summary');
 const panel=await context.newPage();panel.on('pageerror',e=>errors.push(e.message));await panel.goto(`chrome-extension://${id}/panel.html?view=popout`);

 await panel.waitForFunction(()=>$('comp_address').value==='100 Fixture Way');
 await worker.evaluate(()=>{
   sbGetSession=async()=>({access_token:'synthetic-fixture-token'});
   globalThis.analysisCalls=[];
   const realFetch=fetch;globalThis.fetch=async(url,options)=>{
     if(String(url).endsWith('/api/extension/flyer-analysis')){
       analysisCalls.push({url:String(url),method:options.method,credentials:options.credentials,authorization:options.headers.Authorization,body:JSON.parse(options.body)});
       return new Response(' \n'+JSON.stringify({suggestions:[{field:'clear_height',value:"16’",evidence:'16’ Clear Height'},{field:'loading',value:'Two 12’ x 14’ Grade Level Doors',evidence:'Two 12’ x 14’ Grade Level Doors'}],warnings:[],model:'fixture'}),{status:200,headers:{'Content-Type':'application/json'}});
     }return realFetch(url,options);
   };
 });
 await panel.evaluate(()=>{
   resetCompForm();fillCompForm({street:'100 Fixture Way',city:'Phoenix',state:'AZ',submarket:'North Airport',salePrice:'2600000'});
   comp.flyerUrl='https://kavynghiailoduhulytq.supabase.co/storage/v1/object/public/survey-files/comps/flyers/fixture.pdf';
 });
 await panel.locator('#compAnalyzeFlyer').click();await panel.waitForFunction(()=>$('compFlyerReview').open);
 const calls=await worker.evaluate(()=>analysisCalls);assert.equal(calls.length,1);assert.equal(calls[0].method,'POST');assert.equal(calls[0].credentials,'omit');assert.equal(calls[0].authorization,'Bearer synthetic-fixture-token');assert.equal(calls[0].body.address,'100 Fixture Way');
 assert.equal(await panel.evaluate(()=>fixtureSaves.length),0);
 await panel.locator('#compApplyFlyer').click();assert.equal(await panel.locator('#comp_clear_height').inputValue(),'16’');assert.equal(await panel.locator('#comp_loading').inputValue(),'Two 12’ x 14’ Grade Level Doors');assert.equal(await panel.evaluate(()=>fixtureSaves.length),0);
 results.push('Actual MV3 panel → message → worker authenticated request → whitespace-prefixed JSON response → reviewed form, with no implicit save');
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);console.log(JSON.stringify({result:'passed',results,errors,blocked},null,2));
}finally{if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
