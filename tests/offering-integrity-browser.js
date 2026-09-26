// Serve the extension at 127.0.0.1:8783 and run via browser_run_code_unsafe(filename).
// Mounts the actual panel, mocks Chrome's boundary, and blocks non-local requests.
async (page) => {
  const assert = {
    equal(a, b, why = 'Values differ') { if (a !== b) throw new Error(`${why}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); },
    ok(a, why = 'Expected true') { if (!a) throw new Error(why); },
  };
  const browser = page.context().browser();
  const results = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const blocked = [], errors = [];
  await context.route('**/*', async (route) => {
    if (route.request().url().startsWith('http://127.0.0.1:8783/')) await route.continue();
    else { blocked.push(route.request().url()); await route.abort(); }
  });
  await context.addInitScript(() => {
    const stored = JSON.parse(sessionStorage.getItem('fixtureStore') || 'null');
    window.fixture = {
      storage: stored || { mode: 'comp' }, requests: [], scenario: 'exact', failLookup: false, failSave: false,
      delay: 0, writes: Number(sessionStorage.getItem('fixtureWrites') || 0), receipts: JSON.parse(sessionStorage.getItem('fixtureReceipts') || '{}'), candidates: [], property: '20000000-0000-4000-8000-000000000001',
      scrape: { costarId: '123456', street: '100 Fixture Way', city: 'Phoenix', state: 'AZ', zip: '85040',
        submarket: 'North Airport', rba: '20000', acLot: '2', salePrice: '3000000', leaseRate: '1.20', sourceOfferings:['sale','lease'] },
    };
    const sync = () => sessionStorage.setItem('fixtureStore', JSON.stringify(fixture.storage));
    window.chrome = {
      windows: { getCurrent: (cb) => cb({ type: 'normal' }), create: () => {} },
      storage: { local: {
        get: async () => structuredClone(fixture.storage),
        set: async (value) => { if (fixture.failPersist && Object.keys(value).some(k => k.startsWith('comp_pending_property_save'))) throw new Error('Fixture storage full'); Object.assign(fixture.storage, structuredClone(value)); sync(); },
        remove: async (keys) => { for (const key of [].concat(keys)) delete fixture.storage[key]; sync(); },
      } },
      tabs: { query: async () => [], create: async () => ({}), onUpdated: { addListener: () => {} }, onActivated: { addListener: () => {} } },
      runtime: { id: 'fixture-extension', sendMessage: (message, respond) => {
        fixture.requests.push(structuredClone(message));
        if (message.type === 'AUTH_STATUS') return respond({ ok: true, connected: true, email: 'fixture@example.com' });
        if (message.type === 'READ_COSTAR') return respond({ ok: true, data: structuredClone(fixture.scrape) });
        if (message.type === 'SEARCH_COMPS') return respond(fixture.failLookup ? { ok: false, error: 'Lookup failed' } : { ok: true, comps: structuredClone(fixture.candidates) });
        if (message.type === 'GET_SURVEY_PENDING') return respond({ok:true,pending:null});
        if (message.type === 'LIST_SURVEY_PROPERTIES') return respond({ok:true,properties:structuredClone(fixture.rows||[])});
        if (message.type === 'SAVE_SURVEY_BATCH' || message.type === 'SAVE_SURVEY_UPDATE') {
          const r=message.request;
          const rows=r.kind==='insert'?r.rows.map(row=>({...row,updated_at:'2026-09-26T00:00:00Z'})):[{...(fixture.rows||[]).find(row=>row.id===r.id),...r.patch,updated_at:'2026-09-26T00:01:00Z'}];
          fixture.rows ||= []; for(const row of rows){const i=fixture.rows.findIndex(x=>x.id===row.id);if(i<0)fixture.rows.push(row);else fixture.rows[i]=row;}
          return respond({ok:true,status:'saved',properties:structuredClone(rows),pending:null});
        }
        if (message.type === 'SAVE_COMP') {
          const r = message.request;
          const reply = () => {
            if (fixture.failSave) return respond({ ok: false, error: 'Fixture connection lost' });
            if (fixture.scenario === 'rejected') return respond({ ok: false, error: 'Fixture conflict', saveRejected: true });
            if (fixture.scenario === 'ambiguous' && r.p_property_mode === 'auto') return respond({ ok: true, status: 'needs_choice',
              candidates: [{ id: fixture.property, address: '100 Fixture Way', city: 'Phoenix', state: 'AZ', building_sf: null, land_area: null },
                { id: '20000000-0000-4000-8000-000000000002', address: '102 Fixture Way', city: 'Phoenix', state: 'AZ', building_sf: 8000, land_area: 1 }], message: 'Choose the building for this deal.' });
            if (!fixture.receipts[r.p_request_id]) {
              fixture.writes++;
              fixture.receipts[r.p_request_id] = { ok: true, status: 'saved', comp: { ...(fixture.candidates.find(c => c.id === r.p_comp_id) || {}),
                ...r.p_comp, id: r.p_comp_id || `10000000-0000-4000-8000-${String(fixture.writes).padStart(12, '0')}`,
                property_id: r.p_property_mode === 'skip' ? null : r.p_property_mode === 'existing' ? r.p_property_id : r.p_expected_property_id || fixture.property } };
            }
            fixture.candidates = [structuredClone(fixture.receipts[r.p_request_id].comp)];
            sessionStorage.setItem('fixtureWrites', String(fixture.writes));
            sessionStorage.setItem('fixtureReceipts', JSON.stringify(fixture.receipts));
            if (fixture.scenario === 'commitThenLose') return respond({ ok: false, error: 'Fixture response lost after commit' });
            if (fixture.scenario === 'malformed') return respond({ ok: true, status: 'saved', comp: { id: fixture.receipts[r.p_request_id].comp.id } });
            respond(structuredClone(fixture.receipts[r.p_request_id]));
          };
          if (fixture.delay) setTimeout(reply, fixture.delay); else reply();
          return;
        }
        respond({ ok: false, error: `Unexpected message ${message.type}` });
      } },
    };
  });
  const p = await context.newPage(); p.setDefaultTimeout(7000);
  p.on('pageerror', e => errors.push(e.message));
  const lastSave = () => p.evaluate(() => fixture.requests.filter(r => r.type === 'SAVE_COMP').at(-1).request);
  const fresh = async (scenario = 'exact') => {
    await p.evaluate(async scenario => {
      fixture.scrape={costarId:'123456',street:'100 Fixture Way',city:'Phoenix',state:'AZ',submarket:'North Airport',rba:'20000',acLot:'2',sourceOfferings:['sale','lease']}; fixture.scenario = scenario; fixture.failSave = false; fixture.failLookup = false; fixture.delay = 0; fixture.candidates = [];
      resetCompForm(); await fillCompForm(fixture.scrape); setCompMsg('');
    }, scenario);
  };
  try {
    await p.goto('http://127.0.0.1:8783/panel.html');
    await p.waitForFunction(()=>$('comp_address').value==='100 Fixture Way');
    const eq=assert.equal;
    const val=id=>p.locator('#'+id).inputValue();
    const reset=async(sides=['sale','lease'],economics={})=>{await fresh();await p.evaluate(async({sides,economics})=>{fixture.scrape={...fixture.scrape,sourceOfferings:sides,...economics};resetCompForm();await fillCompForm(fixture.scrape);},{sides,economics});};
    const count=()=>p.evaluate(()=>fixture.requests.filter(r=>r.type==='SAVE_COMP').length);
    const save=async(update=false)=>{await p.locator('#compSave').click();await p.waitForFunction(()=>!comp.saving&&!comp.pendingSave);const got=await p.evaluate(()=>({request:fixture.requests.filter(r=>r.type==='SAVE_COMP').at(-1)?.request,row:fixture.candidates[0],msg:$('compMsg').textContent}));assert.ok(got.msg.includes(update?'updated':'saved'),'Save failed: '+got.msg);return got;};
    const baseline=status=>({id:'30000000-0000-4000-8000-000000000001',property_id:'20000000-0000-4000-8000-000000000001',address:'100 Fixture Way',city:'Phoenix',state:'AZ',building_sf:20000,status,sale_price:3000000,price_psf:150,rent_psf:1.25,lease_format:'NNN',notes:'Saved note'});
    const update=async row=>p.evaluate(row=>{fixture.candidates=[structuredClone(row)];enterCompUpdate(row);},row);
    eq(await p.locator('#comp_for_sale').getAttribute('type'),'checkbox','Actual sale checkbox');
    eq(await p.locator('#comp_for_lease').getAttribute('type'),'checkbox','Actual lease checkbox');
    for(const sides of [['sale'],['lease'],['sale','lease']])for(const economics of [{},{salePrice:'3000000'},{leaseRate:'1.25'},{salePrice:'3000000',leaseRate:'1.25'}]){
      await reset(sides,economics);eq(await p.locator('#comp_for_sale').isChecked(),sides.includes('sale'),'Sale from evidence');eq(await p.locator('#comp_for_lease').isChecked(),sides.includes('lease'),'Lease from evidence');
      const a=await save();eq(a.request.p_comp.status,sides.length===2?'FOR SALE/LEASE':sides[0]==='sale'?'FOR SALE':'FOR LEASE','New canonical status');eq(a.row.status,a.request.p_comp.status,'Stored readback');
    }
    results.push('COMP Sale/Lease/Both across all four economic known/unknown combinations serialize and read back');
    await reset([],{salePrice:'3000000',leaseRate:'1.25'});eq(await p.locator('#comp_for_sale').isChecked(),false,'Price never infers sale');eq(await p.locator('#comp_for_lease').isChecked(),false,'Rent never infers lease');let before=await count();eq(await p.locator('#compSave').isDisabled(),true,'Unknown save disabled');eq(await count(),before,'Unknown source blocks');await p.locator('#comp_for_sale').check();await save();
    results.push('COMP unresolved source blocks until explicit broker selection, even with both economics');
    for(const status of ['FOR SALE/LEASE','PENDING SALE','PENDING LEASE','SOLD','LEASED'])for(const sides of [['sale'],['lease'],[]]){
      await reset(sides);await update(baseline(status));eq(await val('comp_status'),status,'Hydrated saved status');await p.locator('#comp_notes').fill('Notes only');const a=await save(true);eq(Object.hasOwn(a.request.p_comp,'status'),false,'Untouched status omitted');eq(a.row.status,status,'Status kept');eq(a.row.sale_price,3000000,'Price kept');eq(a.row.rent_psf,1.25,'Rent kept');
    }
    results.push('COMP saved dual/pending/sold/leased preserved for sale-only/lease-only/unknown source and unrelated updates');
    await reset();await update(baseline('FOR SALE/LEASE'));await p.locator('#comp_for_lease').uncheck();assert.ok((await p.locator('#screen-comp').innerText()).includes('FOR SALE/LEASE → FOR SALE'),'Review explains deliberate narrowing');let a=await save(true);eq(a.request.p_comp.status,'FOR SALE','Explicit narrowing');
    await reset();await update(baseline('SOLD'));await p.locator('#comp_stage').selectOption('ACTIVE');assert.ok((await p.locator('#screen-comp').innerText()).includes('SOLD → FOR SALE'),'Review explains reopening');a=await save(true);eq(a.request.p_comp.status,'FOR SALE','Explicit reopening');
    for(const stage of ['PENDING','CLOSED']){await reset();await p.locator('#comp_stage').selectOption(stage);before=await count();eq(await p.locator('#compSave').isDisabled(),true,'Dual progression disabled');eq(await count(),before,'Dual progression blocks');await p.locator('#comp_for_lease').uncheck();a=await save();eq(a.request.p_comp.status,stage==='PENDING'?'PENDING SALE':'SOLD','Single-side progression');}
    await reset(['lease']);await p.locator('#comp_stage').selectOption('CLOSED');a=await save();eq(a.request.p_comp.status,'LEASED','Closed lease');
    results.push('COMP deliberate narrowing/reopening, single-side pending/closed, and dual progression validation');
    for(const side of ['sale','lease']){await reset();await update(baseline('FOR SALE/LEASE'));await p.locator(side==='sale'?'#comp_sale_price':'#comp_rent_psf').fill(side==='sale'?'4000000':'2');await p.locator('#comp_for_'+side).uncheck();a=await save(true);eq(Object.hasOwn(a.request.p_comp,side==='sale'?'sale_price':'rent_psf'),false,'Hidden economics omitted');eq(a.row[side==='sale'?'sale_price':'rent_psf'],side==='sale'?3000000:1.25,'Hidden saved economics retained');}
    results.push('Edited economics hidden by deliberate side removal never clear saved amounts');
    for(const edit of ['4200000','']){
      await reset(['sale','lease'],{salePrice:'3000000',leaseRate:'1.25'});const row=baseline('FOR SALE/LEASE');await update(row);await p.locator('#comp_sale_price').fill(edit);await p.locator('#comp_rent_psf').fill(edit?'1.8':'');
      await p.evaluate(async row=>{await fillCompForm({...fixture.scrape,salePrice:'8000000',leaseRate:'8'});enterCompUpdate(row);},row);
      eq((await val('comp_sale_price')).replaceAll(',',''),edit,'Manual price survives reread');eq(await val('comp_rent_psf'),edit?'1.8':'','Manual rent survives reread');a=await save(true);eq(a.request.p_comp.sale_price,edit?4200000:null,'Intentional price PATCH');eq(a.request.p_comp.rent_psf,edit?1.8:null,'Intentional rent PATCH');eq(a.row.sale_price,edit?4200000:null,'Price readback');
    }
    results.push('COMP edited and deliberately cleared economics survive reread/same-row selection, PATCH and readback');
    await reset();await update(baseline('FOR SALE/LEASE'));await p.locator('#comp_sale_price').fill('');await p.locator('#comp_rent_psf').fill('');await p.evaluate(()=>fixture.failSave=true);await p.locator('#compSave').click();await p.waitForFunction(()=>!!comp.pendingSave&&!comp.saving);await p.reload();await p.waitForFunction(()=>!!comp.pendingSave);eq(await val('comp_sale_price'),'','Pending restores blank price');eq(await val('comp_rent_psf'),'','Pending restores blank rent');await p.evaluate(()=>fixture.failSave=false);a=await save(true);eq(a.request.p_comp.sale_price,null,'Retry cleared price');eq(a.request.p_comp.rent_psf,null,'Retry cleared rent');
    results.push('COMP pending-save reload restores intentional clears and retries original null payload');
    await reset();await update(baseline('FOR SALE/LEASE'));await p.locator('#comp_sale_price').fill('');await p.locator('#comp_rent_psf').fill('');
    await p.evaluate(()=>{const handoff={comp:structuredClone(comp),compControls:[...document.querySelectorAll('#screen-comp input[id], #screen-comp select[id], #screen-comp textarea[id]')].map(n=>({id:n.id,value:n.value,checked:n.checked})),compChecks:{comp_ptypes:compChecked('comp_ptypes'),comp_sale_types:compChecked('comp_sale_types')},compSources:{}};resetCompForm();popoutHandoff=handoff;restorePopoutComp();popoutHandoff=null;});
    eq(await val('comp_sale_price'),'','Popout restores clear price');eq(await val('comp_rent_psf'),'','Popout restores clear rent');eq(await p.evaluate(()=>comp.editedFields.comp_sale_price&&comp.editedFields.comp_rent_psf),true,'Popout keeps edited null markers');a=await save(true);eq(a.request.p_comp.sale_price,null,'Popout cleared price patch');eq(a.request.p_comp.rent_psf,null,'Popout cleared rent patch');
    results.push('Actual popout restoration function preserves blank controls and edited markers through reviewed null save');
    await reset(['lease']);eq(await val('comp_lease_area'),'','Unknown tenancy');await p.locator('#comp_multi_tenant').selectOption('false');eq(await val('comp_lease_area'),'','Unknown site scope');await p.locator('#comp_partial_site_override').selectOption('false');eq(await val('comp_lease_area'),'20,000','Affirmative whole premises');await p.locator('#comp_partial_site_override').selectOption('true');eq(await val('comp_lease_area'),'','Partial site clears default');
    await reset(['lease'],{selectedSpace:{identity:'suite-a',suite:'A',availableSf:'1200'}});eq(await val('comp_lease_area'),'1,200','Suite exact SF');await reset(['lease'],{selectedSpace:{identity:'suite-b',suite:'B'}});eq(await val('comp_lease_area'),'','Suite unknown SF');a=await save();eq(a.request.p_comp.lease_area,null,'Unknown area serializes null');
    results.push('COMP lease area uses affirmative whole-premises evidence, exact suite SF or unknown, never automatic building default');
    for(const width of [320,390,840]){await p.setViewportSize({width,height:900});await reset();await p.locator('#comp_for_sale').scrollIntoViewIfNeeded();eq(await p.locator('#comp_for_sale').isVisible(),true,'Sale control visible');eq(await p.locator('#comp_for_lease').isVisible(),true,'Lease control visible');eq(await p.locator('#comp_stage').isVisible(),true,'Stage visible');eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal overflow '+width);await p.screenshot({path:'/tmp/survey-offering-integrity-comp-'+width+'.png'});}
    results.push('COMP mounted checks and stage visible and no horizontal overflow at 320/390/840px');
    for(const sides of [['sale'],['lease'],[]]){await reset(['sale','lease']);await p.evaluate(async sides=>fillCompForm({...fixture.scrape,sourceOfferings:sides}),sides);eq(await p.locator('#comp_for_sale').isChecked(),true,'Same-source partial reread retains sale');eq(await p.locator('#comp_for_lease').isChecked(),true,'Same-source partial reread retains lease');a=await save();eq(a.request.p_comp.status,'FOR SALE/LEASE','Same-source partial reread preserves dual insert');}
    results.push('COMP new dual source reread with sale-only/lease-only/unknown evidence retains both until deliberate removal');
    await p.evaluate(async()=>{const blank={order:[],hiddenSecs:[],collapsedSecs:[],openDetails:[],hiddenFields:[],fieldMoves:{},customSecs:[]};await chrome.storage.local.set({layout_prefs:{v:1,density:'compact',survey:blank,comp:{...blank,hiddenFields:['comp_status','comp_for_sale'],hiddenSecs:['property'],collapsedSecs:['property']}}});});
    await p.reload();await p.waitForFunction(()=>$('comp_address').value==='100 Fixture Way');await p.evaluate(()=>Layout.apply('comp'));await p.setViewportSize({width:320,height:900});
    eq(await p.locator('#comp_for_sale').evaluate(n=>n.closest('[data-layout-key]').dataset.layoutKey),'comp_status','Stable composite layout identity');
    for(const id of ['comp_for_sale','comp_for_lease','comp_stage'])eq(await p.locator('#'+id).isVisible(),true,'Saved hidden/collapsed layout cannot hide '+id);
    eq(await p.locator('#comp_for_sale').evaluate(n=>n.closest('[data-sec]').classList.contains('sec-collapsed')),false,'Offering section is not collapsed');eq(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Protected offering layout fits 320px');
    results.push('COMP persisted hidden status/checkbox and hidden/collapsed Property preferences cannot hide offering/stage; composite identity retained');
    await p.evaluate(()=>{state.appMode='survey';state.accountId='20000000-0000-4000-8000-000000000010';state.survey={id:'10000000-0000-4000-8000-000000000010',survey_type:'lease_and_sale'};state.propsLookupOk=true;});
    for(const surveyType of ['lease','sale','lease_and_sale'])for(const sides of [[],['sale'],['lease'],['sale','lease']])for(const economics of [{},{salePrice:'3000000'},{leaseRate:'1.25'},{salePrice:'3000000',leaseRate:'1.25'}]){
      const got=await p.evaluate(({surveyType,sides,economics})=>{state.survey.survey_type=surveyType;const row=recordFromScrape({street:'100 Fixture Way',city:'Phoenix',state:'AZ',sourceOfferings:sides,...economics});surveyEditor.bundle=null;surveyEditor.archives={};setupForm('insert',row,{key:'matrix:'+crypto.randomUUID(),noSource:true});return activeSurveyDraft().model.values.for_sale_or_lease;},{surveyType,sides,economics});eq(JSON.stringify([...got].sort()),JSON.stringify([...sides].sort()),'Survey source independent of destination and economics');eq(await p.locator('#fForSale').isChecked(),sides.includes('sale'),'Mounted survey sale');eq(await p.locator('#fForLease').isChecked(),sides.includes('lease'),'Mounted survey lease');
      if(!sides.length){const n=await p.evaluate(()=>fixture.requests.filter(r=>r.type.startsWith('SAVE_SURVEY')).length);await p.locator('#btnSave').click();eq(await p.evaluate(()=>fixture.requests.filter(r=>r.type.startsWith('SAVE_SURVEY')).length),n,'Unknown Survey source blocked');}else{await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving&&!surveyEditor.pending);const actual=await p.evaluate(()=>({request:fixture.requests.filter(r=>r.type==='SAVE_SURVEY_BATCH').at(-1)?.request,row:fixture.rows?.at(-1),error:$('formError').textContent}));assert.ok(actual.request,'Survey insert dispatched: '+actual.error);eq(JSON.stringify(actual.request.rows[0].for_sale_or_lease.slice().sort()),JSON.stringify(sides.slice().sort()),'Survey offering payload');eq(JSON.stringify(actual.row.for_sale_or_lease.slice().sort()),JSON.stringify(sides.slice().sort()),'Survey offering stored readback');}
    }
    results.push('SURVEY independent matrix: 3 client purposes × 4 source offerings × 4 economic combinations; unknown blocks');
    await p.evaluate(()=>{const row={id:'40000000-0000-4000-8000-000000000001',survey_id:state.survey.id,address:'100 Fixture Way',city:'Phoenix',state:'AZ',for_sale_or_lease:['sale','lease'],tenancy:'ST',building_sf:20000,sale_price:3000000,monthly_base_rent:25000,updated_at:'2026-09-25T00:00:00Z'};fixture.rows=[row];surveyEditor.bundle=null;surveyEditor.archives={};setupForm('update',row,{key:'row:'+row.id,noSource:true});});await p.locator('#fNotes').fill('Unrelated update');await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving&&!surveyEditor.pending);const savedSurvey=await p.evaluate(()=>({request:fixture.requests.filter(r=>r.type==='SAVE_SURVEY_UPDATE').at(-1)?.request,row:fixture.rows[0],error:$('formError').textContent}));assert.ok(savedSurvey.request,'Survey transport save dispatched: '+savedSurvey.error);eq(Object.hasOwn(savedSurvey.request.patch,'for_sale_or_lease'),false,'Survey dual omitted from unrelated patch');eq(JSON.stringify(savedSurvey.row.for_sale_or_lease),JSON.stringify(['sale','lease']),'Survey authoritative mock stored readback dual');
    results.push('SURVEY notes-only actual save transport omits dual availability and stored readback retains both');
    for(const sides of [['sale'],['lease'],[]]){
      await p.evaluate(sides=>{const row=fixture.rows[0];state.scraped={street:row.address,city:row.city,state:row.state,sourceOfferings:sides};surveyEditor.bundle=null;surveyEditor.archives={};setupForm('update',row);},sides);
      eq(await p.locator('#fForSale').isChecked(),true,'Survey saved sale retained from partial source');eq(await p.locator('#fForLease').isChecked(),true,'Survey saved lease retained from partial source');await p.locator('#fNotes').fill('Reviewed partial source '+sides.join(','));await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving&&!surveyEditor.pending);eq(JSON.stringify(await p.evaluate(()=>fixture.rows[0].for_sale_or_lease)),JSON.stringify(['sale','lease']),'Survey source update retains stored dual');
    }
    results.push('SURVEY sale-only/lease-only/unknown reread of saved dual retains both visible checks and stored array');
    eq(errors.length,0,'Runtime errors');eq(blocked.length,0,'External requests');return{passed:results.length,results,errors,externalRequests:blocked};
  }finally{await context.close();}
}
