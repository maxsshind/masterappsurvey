// Real MV3 READ_COSTAR -> rendered DOM -> panel -> real worker save pipeline.
// Only Supabase transport is replaced by an in-memory disposable database.
// All HTTP traffic is intercepted; no real CoStar or business records are used.
const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(process.env.EXTENSION_ROOT || path.join(__dirname,'..'));
const baseline=process.env.EXPECT_SUITE_BUG==='1';
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'survey-suite-switch-'));
const SURVEY='10000000-0000-4000-8000-000000000001', ACCOUNT='20000000-0000-4000-8000-000000000001';
const fixture=`<!doctype html><meta charset="utf-8"><h1>1139 E Curry Rd - Bldg A & B</h1><p>Tempe, AZ 85281</p><p>31,600 SF RBA</p><p>1.7 AC Lot</p><p>1,200 - 2,510 Available SF</p><p>1,310 Max Contig SF</p><div id="ordinal">1 of 2 Spaces</div><button id="back" onclick="change(1)">Previous space</button><button id="next" onclick="change(2)">Next space</button><h2>Space Details</h2><div id="detail"></div><h2>Space Notes</h2><p>Yard 3 note says $470; not a confirmed quote.</p><script>
window.delay=0; window.space=1;
function content(n) { return n===1 ? 'Available 1,310 SF Flex\\nSuite Yard 3\\nFloor Partial 1st\\nFloor Contig 1,310 SF\\nBldg Contig 1,310 SF\\nRent $2.79\\nRent/Mo $3,652\\nServices Modified Gross\\nType Direct' : 'Available 1,200 SF Industrial\\nSuite 7\\nFloor Partial 1st\\nOffice 100 SF\\nFloor Contig 1,200 SF\\nBldg Contig 1,200 SF\\nRent $1.40\\nRent/Mo $1,680\\nServices Modified Gross\\nType Direct'; }
function change(n) { window.space=n;document.querySelector('#ordinal').textContent=n+' of 2 Spaces'; setTimeout(()=>document.querySelector('#detail').innerText=content(n),window.delay); }
change(1);
</script>`;
(async()=>{let context;const results=[],errors=[],blocked=[];try{
 context=await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:720,height:1000},executablePath:process.env.EXTENSION_CHROMIUM_PATH,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]});
 await context.route(/^https?:/,async route=>{if(route.request().url().startsWith('https://product.costar.com/detail/'))return route.fulfill({contentType:'text/html',body:fixture});blocked.push(route.request().url());await route.abort();});
 const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;
 await worker.evaluate(({SURVEY,ACCOUNT})=>{
  globalThis.fixtureDB={rows:[],writes:[],account:ACCOUNT,survey:SURVEY};
  sbSelect=async()=>[]; // Comp's separate poll has no fixture rows.
  sbGetSession=async()=>({user_id:fixtureDB.account,access_token:'fixture-only'});
  sbEnsureAuthorized=async()=>({user_id:fixtureDB.account,access_token:'fixture-only'});
  sbListAllSurveyProperties=async survey=>structuredClone(fixtureDB.rows.filter(r=>r.survey_id===survey));
  sbReadSurveyIds=async(survey,ids)=>{const rows=structuredClone(fixtureDB.rows.filter(r=>r.survey_id===survey&&ids.includes(r.id)));return fixtureDB.reverse?rows.reverse():rows;};
  sbInsertSurveyBatch=async rows=>{fixtureDB.writes.push({kind:'insert',rows:structuredClone(rows)});for(const r of rows)if(!fixtureDB.rows.some(x=>x.id===r.id))fixtureDB.rows.push({...structuredClone(r),updated_at:new Date().toISOString()});};
  sbUpdateSurveyScoped=async(survey,id,updated,patch)=>{fixtureDB.writes.push({kind:'update',id,patch:structuredClone(patch)});const row=fixtureDB.rows.find(r=>r.survey_id===survey&&r.id===id);if(row&&row.updated_at===updated)Object.assign(row,patch,{updated_at:new Date().toISOString()});return[];};
  return chrome.storage.local.set({mode:'survey',last_survey_id:SURVEY});
 },{SURVEY,ACCOUNT});
 await context.addInitScript(({SURVEY,ACCOUNT})=>{
  if(!location.href.startsWith('chrome-extension:'))return;
  const original=chrome.runtime.sendMessage.bind(chrome.runtime);
  chrome.runtime.sendMessage=(m,cb)=>{
   if(m.type==='AUTH_STATUS')return cb({ok:true,connected:true,accountId:ACCOUNT,email:'fixture@example.invalid'});
   if(m.type==='GET_SURVEY')return cb({ok:true,survey:{id:m.id,name:'Isolated suite test',survey_type:'lease'}});
   if(m.type==='LIST_SURVEYS')return cb({ok:true,surveys:[{id:SURVEY,name:'Isolated suite test',survey_type:'lease'}]});
   return original(m,cb);
  };
 },{SURVEY,ACCOUNT});
 const costar=await context.newPage();await costar.goto('https://product.costar.com/detail/all-properties/231512/summary');
 const tabId=await worker.evaluate(async()=> (await chrome.tabs.query({url:'https://product.costar.com/*'}))[0].id);
 const panel=await context.newPage();panel.on('pageerror',e=>errors.push(e.message));await panel.goto(`chrome-extension://${id}/panel.html?view=popout`);
 await panel.waitForFunction(()=>state.survey?.id&&activeMessages===0);
 const settle=()=>panel.waitForFunction(()=>!surveyEditor.saving&&!surveyEditor.pending&&!surveyEditor.checkingSource&&!navBusy&&activeMessages===0);
 const read=async()=>{await panel.evaluate(()=>doRead());await settle();};
 const suite=()=>panel.locator('#fSuiteNumber').inputValue();
 const rows=()=>worker.evaluate(()=>structuredClone(fixtureDB.rows));
 await read();assert.equal(await suite(),'Yard 3');await panel.locator('#fTenancy input[value="MT"]').click();
 await panel.locator('#btnSave').click();await panel.waitForFunction(()=>state.mode==='update'&&!surveyEditor.saving);
 const yard=(await rows())[0];assert.equal(yard.suite_number,'Yard 3');
 await costar.locator('#next').click();
 if(baseline){await new Promise(r=>setTimeout(r,3200));assert.equal(await suite(),'Yard 3');console.error('completed',results.length);results.push('Reproduced 1.4.2 bug: real DOM changed to Suite 7 at same URL, saved Yard 3 editor stayed mounted');console.log(JSON.stringify({baseline:true,results,errors,blocked},null,2));return;}
 await panel.waitForFunction(()=>document.querySelector('#fSuiteNumber').value==='7');
 assert.equal(await panel.locator('#fSuiteSize').inputValue(),'1,200');assert.equal(await panel.locator('#fOfficeSf').inputValue(),'100');assert.equal(await panel.locator('#fMonthlyBase').inputValue(),'1680');
 assert.equal(await panel.locator('[data-update="0"]').isDisabled(),true);
 await panel.locator('[data-add="0"]').click();await panel.locator('#btnSave').click();await panel.waitForFunction(()=>state.mode==='update'&&!surveyEditor.saving&&document.querySelector('#fSuiteNumber').value==='7');
 let saved=await rows();assert.equal(saved.length,2);assert.deepEqual(saved[0],yard);assert.equal(saved[1].monthly_base_rent,1680);assert.equal(saved[1].office_sf,100);
 console.error('completed',results.length);results.push('Actual same-URL CoStar arrow -> worker DOM scraper -> automatic Suite 7 capture -> distinct row saved; Yard 3 unchanged');
 await panel.locator('#fNotes').fill('Suite 7 edited');await panel.locator('#fOfficeSf').fill('');await read();await read();assert.equal(await panel.locator('#fNotes').inputValue(),'Suite 7 edited');assert.equal(await panel.locator('#fOfficeSf').inputValue(),'');
 // Delayed arrow updates ordinal first, fields later. Poll ultimately follows settled fields.
 await costar.evaluate(()=>window.delay=1300);await costar.locator('#back').click();await panel.waitForFunction(()=>document.querySelector('#fSuiteNumber').value==='Yard 3');await settle();
 await costar.locator('#next').click();await panel.waitForFunction(()=>document.querySelector('#fSuiteNumber').value==='7'&&document.querySelector('#fNotes').value==='Suite 7 edited');assert.equal(await panel.locator('#fOfficeSf').inputValue(),'');
 console.error('completed',results.length);results.push('Delayed DOM rendering and backward/forward arrows preserve independent saved-row edits and deliberate clears; repeated refresh does not reset them');
 // Ordinal-first transition must not mount stale fields or permit save mid-render.
 await panel.evaluate(()=>navBusy=true);await costar.evaluate(()=>window.delay=3500);await costar.locator('#back').click();
 const delayedWrites=await worker.evaluate(()=>fixtureDB.writes.length);
 await panel.locator('#btnSave').click();await panel.waitForFunction(()=>!surveyEditor.saving);assert.equal(await worker.evaluate(()=>fixtureDB.writes.length),delayedWrites);assert.match(await panel.locator('#formError').innerText(),/still changing/);
 await costar.waitForFunction(()=>document.querySelector('#detail').innerText.includes('Yard 3'));await panel.evaluate(()=>navBusy=false);await read();
 await costar.evaluate(()=>window.delay=0);await costar.locator('#next').click();await panel.waitForFunction(()=>document.querySelector('#fSuiteNumber').value==='7');
 console.error('completed',results.length);results.push('Ordinal changes before suite fields: a save during a 3.5-second render delay is rejected with zero writes');
 // Immediate save before automatic poll must refuse the stale source.
 await panel.evaluate(()=>navBusy=true);await costar.evaluate(()=>window.delay=0);await costar.locator('#back').click();await costar.waitForFunction(()=>document.querySelector('#detail').innerText.includes('Yard 3'));
 const beforeWrites=await worker.evaluate(()=>fixtureDB.writes.length);await panel.locator('#btnSave').click();await panel.waitForFunction(()=>!surveyEditor.saving);assert.match(await panel.locator('#formError').innerText(),/different space/);assert.equal(await worker.evaluate(()=>fixtureDB.writes.length),beforeWrites);
 await panel.evaluate(()=>navBusy=false);await read();assert.equal(await suite(),'Yard 3');
 console.error('completed',results.length);results.push('Save clicked before the next poll is blocked when CoStar shows another suite; zero update requests');
 // Reproduce legacy invalid alias, and null-tenancy saved candidate from real screen.
 await worker.evaluate(()=>{fixtureDB.rows[0].tenancy=null;});await costar.locator('#next').click();await costar.waitForFunction(()=>document.querySelector('#detail').innerText.includes('Suite 7'));
 await panel.evaluate(()=>{surveyEditor.bundle=null;surveyEditor.archives={};});await read();assert.equal(await panel.locator('[data-update="0"]').isDisabled(),true);assert.equal(await panel.locator('[data-add="0"]').innerText(),'Add current CoStar space');
 await panel.evaluate(()=>{const key=surveySourceKey(state.scraped);surveyEditor.archives[key].targetId=state.props[0].id;surveyEditor.bundle=null;});await read();assert.equal(await suite(),'7');assert.equal(await panel.evaluate(()=>state.mode),'insert');assert.equal(await panel.locator('[data-update="0"]').isDisabled(),true);
 // Update the correct Suite 7 row deliberately.
 await panel.locator('[data-update="1"]').click();await panel.locator('#fNotes').fill('Only Suite 7');await panel.locator('#btnSave').click();await panel.waitForFunction(()=>!surveyEditor.saving);
 saved=await rows();assert.equal(saved[0].notes,yard.notes);assert.equal(saved[1].notes,'Only Suite 7');
 console.error('completed',results.length);results.push('Null-tenancy candidate still offers Add current CoStar space; mismatched legacy alias cannot retarget Suite 7 to Yard 3; correct row update verified');
 // Reload extension page with local storage intact; source survives saved result.
 await panel.reload();await panel.waitForFunction(()=>state.mode==='update'&&state.survey);assert.equal(await suite(),'7');assert.equal(await panel.locator('#fNotes').inputValue(),'Only Suite 7');await read();assert.equal(await panel.evaluate(()=>state.editingId),saved[1].id);
 console.error('completed',results.length);results.push('Panel restart restores saved target and pinned source; refresh still targets only Suite 7');
 // Explicit refresh with a manual sibling active must select the original captured draft.
 await panel.evaluate(()=>{surveyEditor.bundle=null;surveyEditor.archives={};});await read();await panel.locator('[data-add="0"]').click();
 await panel.locator('#btnAddSpace').click();await panel.locator('#fSuiteNumber').fill('Manual B');await panel.locator('#fNotes').fill('Keep manual sibling');
 await read();assert.equal(await suite(),'7');
 assert.deepEqual(await panel.evaluate(()=>surveyEditor.bundle.drafts.map(d=>({suite:d.model.values.suite_number,source:d.source?.selectedSpace?.suite||null}))),[{suite:'7',source:'7'},{suite:'Manual B',source:null}]);
 await panel.locator('#spaceDrafts [data-draft="1"]').click();assert.equal(await panel.locator('#fNotes').inputValue(),'Keep manual sibling');
 // Restore the correctly saved row for the cross-tab preflight.
 await panel.evaluate(()=>{surveyEditor.bundle=null;surveyEditor.archives={};});await read();await panel.locator('[data-update="1"]').click();
 console.error('completed',results.length);results.push('Same-space refresh selects the captured suite while preserving manual sibling values and its absent source');
 // New tab at same building and same suite must be visible as another source tab.
 const other=await context.newPage();await other.goto('https://product.costar.com/detail/all-properties/999999/summary');const otherId=await worker.evaluate(async()=> (await chrome.tabs.query({url:'https://product.costar.com/detail/all-properties/999999/*'}))[0].id);
 await worker.evaluate(id=>chrome.tabs.update(id,{active:true}),otherId);await panel.locator('#fNotes').fill('Should not go to other tab');await panel.evaluate(()=>navBusy=true);await panel.locator('#btnSave').click();await panel.waitForFunction(()=>!surveyEditor.saving);assert.match(await panel.locator('#formError').innerText(),/different space|still changing/);
 // With popout focused, reads follow pinned original instead of most recent other tab.
 const openedPopup=context.waitForEvent('page');
 const popWin=await worker.evaluate(url=>chrome.windows.create({url,type:'popup',width:720,height:900}),`chrome-extension://${id}/panel.html?view=popout`);
 const popup=await openedPopup;
 if(popup){await popup.waitForFunction(()=>typeof state!=='undefined'&&state.survey);await popup.evaluate(()=>doRead());assert.equal(await popup.locator('#fSuiteNumber').inputValue(),'7');await popup.close();}
 await worker.evaluate(id=>chrome.tabs.update(id,{active:true}),tabId);await panel.evaluate(()=>navBusy=false);await read();
 await other.close();
 console.error('completed',results.length);results.push('Multiple CoStar tabs: save refuses another active property; popout uses its pinned original source instead of most-recent fallback');
 // Readback order can differ from insertion order. Save two drafts with manual
 // sibling active, then refresh the captured source and verify its exact row ID.
 await costar.evaluate(()=>{document.querySelector('h1').textContent='300 Fixture Way';history.pushState(null,'','/detail/all-properties/333333/summary');});
 await panel.evaluate(()=>{navBusy=true;surveyEditor.bundle=null;surveyEditor.archives={};});await read();
 await panel.locator('#fTenancy input[value="MT"]').click();await panel.locator('#btnAddSpace').click();await panel.locator('#fSuiteNumber').fill('Manual B');await panel.locator('#fSuiteSize').fill('700');
 const expectedIds=await panel.evaluate(()=>surveyEditor.bundle.drafts.map(d=>d.id));await worker.evaluate(()=>fixtureDB.reverse=true);
 const batchWrites=await worker.evaluate(()=>fixtureDB.writes.length);await costar.locator('#back').click();await costar.waitForFunction(()=>document.querySelector('#detail').innerText.includes('Yard 3'));
 await panel.locator('#btnSave').click();await panel.waitForFunction(()=>!surveyEditor.saving);assert.equal(await worker.evaluate(()=>fixtureDB.writes.length),batchWrites);assert.match(await panel.locator('#formError').innerText(),/different space/);
 await costar.locator('#next').click();await costar.waitForFunction(()=>document.querySelector('#detail').innerText.includes('Suite 7'));
 await panel.locator('#btnSave').click();await panel.waitForFunction(()=>!surveyEditor.saving&&state.mode==='update');
 assert.equal(await panel.evaluate(()=>state.editingId),expectedIds[0]);await read();assert.equal(await panel.evaluate(()=>state.editingId),expectedIds[0]);assert.equal(await suite(),'7');
 assert.equal((await rows()).find(r=>r.id===expectedIds[1]).suite_number,'Manual B');
 console.error('completed',results.length);results.push('Reversed database readback maps saved aliases by draft ID; manual sibling stays independent and refresh targets captured Suite 7');
 await panel.locator('#fSuiteNumber').fill('7 reviewed');await panel.locator('#btnSave').click();await panel.waitForFunction(()=>!surveyEditor.saving);await read();assert.equal(await suite(),'7 reviewed');assert.equal(await panel.evaluate(()=>state.editingId),expectedIds[0]);
 results.push('Deliberate saved suite-label edit remains linked to its captured source; active manual sibling cannot bypass source preflight');
 for(const width of [320,390,720]){await panel.setViewportSize({width,height:900});await panel.evaluate(()=>window.scrollTo(0,0));assert.equal(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await panel.screenshot({path:path.join(root,`output/review/suite-switch-${width}.png`)});}
 // Automatic reread must never pull the user back out of settings/browse/Comp.
 for(const view of ['settings','browse','comp']) {
  await panel.evaluate(async view=>{
    navBusy=true;const send=chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage=(m,cb)=>send(m,res=>m.type==='READ_COSTAR'?setTimeout(()=>cb(res),600):cb(res));
    observedSurveySource=null;const reading=doRead({automatic:true});await sleep(50);
    if(view==='comp'){state.appMode='comp';showScreen('comp');}else if(view==='browse')setTab('browse');else showScreen('settings');
    await reading;chrome.runtime.sendMessage=send;
  },view);
  assert.equal(await panel.evaluate(()=>state.screen),view);
  await panel.evaluate(()=>{state.appMode='survey';mountSurveyDraft();});
 }
 results.push('Delayed automatic reads respect navigation to Settings, Browse, or Comp instead of reopening Survey');
 // A delayed source response from the previous survey/account cannot mount there.
 await panel.evaluate(async()=>{
   navBusy=true;
   const send=chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage=(m,cb)=>send(m,res=>m.type==='READ_COSTAR'?setTimeout(()=>cb(res),600):cb(res));
   const reading=doRead();await sleep(50);
   await selectSurvey({id:'10000000-0000-4000-8000-000000000002',name:'Second isolated survey',survey_type:'lease'},{silent:true});
   state.scraped=null;setupForm('insert',{address:'Keep survey two',city:'Phoenix',state:'AZ',for_sale_or_lease:['lease']},{key:'manual:scope-test',noSource:true});
   await reading;chrome.runtime.sendMessage=send;
 });
 assert.equal(await panel.locator('#fAddress').inputValue(),'Keep survey two');
 await panel.evaluate(async()=>{
   navBusy=true;
   const send=chrome.runtime.sendMessage.bind(chrome.runtime);
   chrome.runtime.sendMessage=(m,cb)=>send(m,res=>m.type==='READ_COSTAR'?setTimeout(()=>cb(res),600):cb(res));
   const reading=doRead();await sleep(50);await persistSurveyDraft();state.accountId='20000000-0000-4000-8000-000000000002';surveyEditor.bundle=null;surveyEditor.archives={};
   state.scraped=null;setupForm('insert',{address:'Keep account two',city:'Phoenix',state:'AZ',for_sale_or_lease:['lease']},{key:'manual:account-test',noSource:true});
   await reading;chrome.runtime.sendMessage=send;
 });
 assert.equal(await panel.locator('#fAddress').inputValue(),'Keep account two');
 console.error('completed',results.length);results.push('Delayed real scraper responses cannot overwrite a newly selected survey or another account workspace');
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 console.log(JSON.stringify({results,errors,blocked,rows:(await rows()).map(r=>({id:r.id,suite:r.suite_number,notes:r.notes})),scope:'Disposable profile and DOM fixtures; real worker scraper and save/recovery pipeline; in-memory Supabase transport; zero external requests'},null,2));
 }finally{if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
