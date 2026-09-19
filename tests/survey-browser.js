// Actual panel controls with disposable Chrome/API fixtures. No remote requests.
// Run via Playwright browser_run_code_unsafe(filename); serves source on 8898.
async (page) => {
  const assert = { equal(a,b,m='Values differ'){if(a!==b)throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);}, ok(v,m='Expected truthy'){if(!v)throw new Error(m);} };
  const context = await page.context().browser().newContext({ viewport:{width:390,height:844} });
  const errors=[],blocked=[],results=[];
  await context.route('**/*', async r => { if(r.request().url().startsWith('http://127.0.0.1:8898/')) await r.continue(); else {blocked.push(r.request().url());await r.abort();} });
  await context.addInitScript(() => {
    const SURVEY='10000000-0000-4000-8000-000000000001', ACCOUNT='20000000-0000-4000-8000-000000000001';
    const restored=JSON.parse(sessionStorage.getItem('surveyFixture') || 'null');
    window.fixture=restored || {storage:{mode:'survey',last_survey_id:SURVEY},rows:[],pending:null,requests:[],scenario:'ok',writes:0,scrape:{costarId:'123456',street:'100 Fixture Way',city:'Phoenix',state:'AZ',rba:'40000',acLot:'10',leaseRate:'18',leaseQuote:{rawText:'$18/SF/YR',amountText:'18',basis:'sf',period:'annual'}}};
    const sync=()=>sessionStorage.setItem('surveyFixture',JSON.stringify(fixture));
    window.chrome={windows:{getCurrent:cb=>cb({type:'normal'}),create:()=>{}},storage:{local:{
      get:async()=>structuredClone(fixture.storage),set:async value=>{if(fixture.storageFail)throw new Error('Fixture storage unavailable');Object.assign(fixture.storage,structuredClone(value));sync();},remove:async keys=>{[].concat(keys).forEach(k=>delete fixture.storage[k]);sync();}
    }},tabs:{query:async()=>[],create:async options=>{fixture.openedTab=options.url;return{};},onUpdated:{addListener:()=>{}},onActivated:{addListener:()=>{}}},runtime:{id:'fixture-extension',sendMessage:(m,cb)=>{
      fixture.requests.push(structuredClone(m)); const respond=x=>{sync();cb(x);};
      if(m.type==='AUTH_STATUS') return respond({ok:true,connected:true,email:'fixture@example.invalid',accountId:fixture.accountId || ACCOUNT});
      if(m.type==='GET_SURVEY') return respond({ok:true,survey:{id:m.id,name:'Disposable Survey',survey_type:'lease_and_sale'}});
      if(m.type==='LIST_SURVEYS')return respond({ok:true,surveys:[{id:SURVEY,name:'Disposable Survey',survey_type:'lease_and_sale'}]});
      if(m.type==='LIST_SURVEY_PROPERTIES')return respond(fixture.lookupFail?{ok:false,error:'Lookup failed'}:{ok:true,properties:structuredClone(fixture.rows)});
      if(m.type==='ATTACH_FLYER'){setTimeout(()=>respond({ok:true,url:'https://fixture.invalid/one.pdf',name:'Fixture flyer'}),100);return;}
      if(m.type==='AUTH_SIGN_OUT')return respond({ok:true});
      if(m.type==='READ_COSTAR')return respond({ok:true,data:structuredClone(fixture.scrape)});
      if(m.type==='GET_SURVEY_PENDING')return respond({ok:true,pending:fixture.pending});
      if(m.type==='SAVE_SURVEY_BATCH'||m.type==='SAVE_SURVEY_UPDATE'){
        const req=m.request;
        if(fixture.scenario==='differentPending') { const other=structuredClone(req);other.requestId='40000000-0000-4000-8000-000000000001';other.rows[0].id='40000000-0000-4000-8000-000000000002';other.rows[0].address='200 Other Pending Way';fixture.pending={request:other,phase:'dispatched'};return respond({ok:false,error:'Another panel owns this save',pending:fixture.pending}); }
        fixture.pending={request:req,phase:'prepared'};
        const existing=req.kind==='insert'?fixture.rows.filter(r=>req.rows.some(x=>x.id===r.id)):fixture.rows.filter(r=>r.id===req.id);
        if(req.kind==='insert'&&existing.length===req.rows.length){fixture.pending=null;return respond({ok:true,status:'saved',properties:existing,pending:null});}
        if(fixture.scenario==='failBefore')return respond({ok:false,status:'none',error:'Fixture database unavailable',pending:fixture.pending});
        if(fixture.scenario==='changed')return respond({ok:true,status:'changed',properties:existing,current:existing[0],pending:fixture.pending});
        fixture.writes++;
        const rows=req.kind==='insert'?req.rows.map(r=>({...r,created_at:'2026-09-18T23:00:00Z',updated_at:'2026-09-18T23:00:00Z'})):[{...existing[0],...req.patch,updated_at:'2026-09-18T23:01:00Z'}];
        for(const row of rows){const i=fixture.rows.findIndex(x=>x.id===row.id);if(i<0)fixture.rows.push(row);else fixture.rows[i]=row;}
        fixture.pending=null;
        if(fixture.scenario==='lostAfterWorkerVerified')return respond({ok:false,error:'Fixture lost response after verified commit'});
        return respond({ok:true,status:'saved',properties:rows,pending:null});
      }
      if(m.type==='ABANDON_SURVEY_PENDING'){const r=fixture.pending?.request;fixture.pending=null;return respond({ok:true,status:'none',pending:null,current:r?fixture.rows.find(x=>x.id===r.id):null});}
      respond({ok:false,error:'Unexpected fixture message '+m.type});
    }}};
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  const fill=async(id,v)=>p.locator('#'+id).fill(v);
  const choose=async(id,v)=>p.locator('#'+id+' input').evaluateAll((nodes,v)=>{const n=nodes.find(n=>n.value===v);n.click();},v);
  const value=id=>p.locator('#'+id).inputValue();
  const fresh=async(row={},isNew=true)=>{
    await p.evaluate(({row,isNew})=>{surveyEditor.pending=null;surveyEditor.saving=false;surveyEditor.bundle=null;surveyEditor.archives={};state.pendingDup=null;state.scraped=null;fixture.scenario='ok';fixture.pending=null;setupForm(isNew?'insert':'update',row,{key:'test:'+crypto.randomUUID(),noSource:true});}, {row:{address:'100 Fixture Way',city:'Phoenix',state:'AZ',for_sale_or_lease:['lease','sale'],...row},isNew});
  };
  try{
    await p.goto('http://127.0.0.1:8898/panel.html');await p.waitForFunction(()=>state.survey?.id);
    // SF formatting is presentation only; opening and leaving a field cannot change a quote.
    await fresh({tenancy:'MT',suite_number:'Yard 3',suite_size:'1310',building_sf:31600,office_sf:1000},false);
    const areaBefore=await p.evaluate(()=>JSON.stringify(activeSurveyDraft().model));
    for (const [id,expected] of [['fSuiteSize','1,310'],['fBuildingSf','31,600'],['fOfficeSf','1,000']]) {
      assert.equal(await value(id),expected);await p.locator('#'+id).focus();await p.keyboard.press('Tab');
    }
    assert.equal(await p.evaluate(()=>JSON.stringify(activeSurveyDraft().model)),areaBefore);
    await p.locator('[data-sec="size"]').scrollIntoViewIfNeeded();await p.screenshot({path:'output/review/comma-sf-390.png'});
    await fill('fNotes','Only a note');
    assert.equal(JSON.stringify(await p.evaluate(()=>SurveyFields.serializeDraft(activeSurveyDraft().model).patch)),JSON.stringify({notes:'Only a note'}));
    await fresh({tenancy:'MT',suite_size:'1310',building_sf:31600});
    await fill('fSuiteSize','21600');await p.keyboard.press('Tab');assert.equal(await value('fSuiteSize'),'21,600');
    await fill('fBuildingSf','64800');await p.keyboard.press('Tab');assert.equal(await value('fBuildingSf'),'64,800');
    await fill('fOfficeSf','1200');await p.keyboard.press('Tab');assert.equal(await value('fOfficeSf'),'1,200');
    await fill('fLeaseRate','1.5');assert.equal(await value('fMonthlyBase'),'32400.00');
    const formattedWrite=await p.evaluate(()=>SurveyFields.serializeDraft(activeSurveyDraft().model));
    assert.ok(formattedWrite.valid);assert.equal(formattedWrite.values.building_sf,64800);assert.equal(formattedWrite.values.office_sf,1200);assert.equal(formattedWrite.values.suite_size,'21600');
    await p.evaluate(()=>mountSurveyDraft());assert.equal(await value('fSuiteSize'),'21,600');assert.equal(await value('fOfficeSf'),'1,200');
    await fill('fOfficeSf','1,20');await p.keyboard.press('Tab');assert.equal(await value('fOfficeSf'),'1,20');
    assert.equal(await p.evaluate(()=>SurveyFields.serializeDraft(activeSurveyDraft().model).valid),false);
    await fresh({tenancy:'ST',building_sf:31600.123456789,office_sf:1000.123456789},false);
    assert.equal(await value('fBuildingSf'),'31,600.123456789');assert.equal(await value('fOfficeSf'),'1,000.123456789');
    await p.locator('#fOfficeSf').focus();await p.keyboard.press('Tab');await fill('fNotes','Legacy precision');
    assert.equal(JSON.stringify(await p.evaluate(()=>SurveyFields.serializeDraft(activeSurveyDraft().model).patch)),JSON.stringify({notes:'Legacy precision'}));
    results.push('SF commas on capture, blur and remount preserve raw values, monthly math, invalid-input rejection, legacy precision and notes-only patches');

    // Selected-space monthly quote: header/body rent must never supply the offer.
    await p.evaluate(()=>{
      surveyEditor.bundle=null;surveyEditor.archives={};
      fixture.scrape={costarId:'7654321',street:'100 Fixture Way',city:'Phoenix',state:'AZ',rba:'380569',acLot:'14.09',leaseRate:'0.65',leaseType:'NNN',
        leaseQuote:{rawText:'Space Details · Available 40,000 SF · Rent $0.65 · Rent/Mo $26,000 · Services Triple Net',period:'monthly',basis:'total',amountText:'26000',reviewed:false},
        selectedSpace:{scope:'space-details',identity:'partial-1st|40000|sublet',canPrefill:true,monthlyRent:'26000',availableSf:'40000',officeSf:'3200',rentPsf:'0.65',floor:'Partial 1st',suite:null,serviceType:'Triple Net'}};
      state.scraped=structuredClone(fixture.scrape);matchAndShowForm();
    });
    assert.equal(await value('fMonthlyBase'),'26000');assert.equal(await value('fSuiteSize'),'40,000');assert.equal(await value('fOfficeSf'),'3,200');
    assert.equal(await value('fBuildingSf'),'380,569');assert.equal(await p.evaluate(()=>activeSurveyDraft().model.values.tenancy),null);
    assert.equal(await value('fTotalLeaseRate'),'');assert.equal(await p.locator('#fMonthlyConfirmed').count(),0);
    assert.equal(await p.locator('#fExpenseTreatment input:checked').inputValue(),'additional');
    assert.ok(await p.locator('#expenseAmounts').isVisible());assert.equal(await value('fOpexTotal'),'');assert.equal(await value('fOpexPsf'),'');
    assert.ok((await p.locator('#labelMonthlyBase').innerText()).includes('CoStar'));
    await choose('fTenancy','MT');await fill('fSuiteNumber','Sublease');assert.equal(await value('fLeaseRate'),'0.65');
    await p.locator('#surveyPricing').scrollIntoViewIfNeeded();await p.screenshot({path:'output/review/rent-fix-selected-space-390.png'});
    assert.equal(await p.locator('#rentArea, #sourceQuote, #monthlyReview').count(),0);assert.equal(await p.locator('#labelTotalLeaseRate').innerText(),'');
    await fill('fMonthlyBase','27000');await fill('fNotes','Keep this review');
    await p.evaluate(()=>{fixture.scrape.selectedSpace.monthlyRent='28000';fixture.scrape.leaseQuote.amountText='28000';fixture.scrape.leaseQuote.rawText='Space Details Rent/Mo $28,000';});
    await p.locator('#btnRefresh').click();assert.equal(await value('fMonthlyBase'),'27000');assert.equal(await value('fNotes'),'Keep this review');assert.equal(await p.locator('#fMonthlyConfirmed').count(),0);
    results.push('Open space prefills monthly total, suite/office size; building stays separate, removed source/area/confirmation UI stays absent, edited quote survives source changes');

    await p.evaluate(()=>{fixture.scrape.selectedSpace.identity='suite-2|10000|direct';fixture.scrape.selectedSpace.suite='2';fixture.scrape.selectedSpace.availableSf='10000';fixture.scrape.selectedSpace.monthlyRent='10000';fixture.scrape.leaseQuote.rawText='Space Details Rent/Mo $10,000';});
    await p.locator('#btnRefresh').click();assert.equal(await value('fMonthlyBase'),'10000');assert.equal(await value('fSuiteSize'),'10,000');assert.equal(await value('fNotes'),'');
    await p.evaluate(()=>{fixture.scrape.selectedSpace.identity='partial-1st|40000|sublet';fixture.scrape.selectedSpace.monthlyRent='28000';fixture.scrape.selectedSpace.availableSf='40000';});
    await p.locator('#btnRefresh').click();assert.equal(await value('fMonthlyBase'),'27000');assert.equal(await value('fNotes'),'Keep this review');
    await fill('fMonthlyBase','');await p.locator('#btnRefresh').click();assert.equal(await value('fMonthlyBase'),'','Intentional clear must not be refilled');
    results.push('Different selected spaces at one building retain independent drafts; intentional cleared rent stays cleared');

    await p.evaluate(()=>{surveyEditor.bundle=null;surveyEditor.archives={};fixture.scrape.selectedSpace.canPrefill=false;fixture.scrape.selectedSpace.issue='Conflicting source rates';state.scraped=structuredClone(fixture.scrape);matchAndShowForm();});
    assert.equal(await value('fMonthlyBase'),'');assert.equal(await p.locator('#sourceQuote').count(),0);
    await p.evaluate(()=>{
      surveyEditor.bundle=null;surveyEditor.archives={};fixture.scrape.selectedSpace.canPrefill=true;state.scraped=structuredClone(fixture.scrape);
      setupForm('update',{id:'30000000-0000-4000-8000-000000000095',address:'100 Fixture Way',city:'Phoenix',state:'AZ',monthly_base_rent:12345,lease_rate_psf:1.1,rent_calculation:null,for_sale_or_lease:['lease']});
    });
    assert.equal(await value('fMonthlyBase'),'12345');assert.equal(await value('fLeaseRate'),'1.1');
    results.push('Ambiguous selected quotes stay unadopted; opening saved rows never replaces their existing rent');
    // Restore the unrelated existing regression fixture.
    await p.evaluate(()=>{fixture.scrape={costarId:'123456',street:'100 Fixture Way',city:'Phoenix',state:'AZ',rba:'40000',acLot:'10',leaseRate:'18',leaseQuote:{rawText:'$18/SF/YR',amountText:'18',basis:'sf',period:'annual'}};});
    await fresh({tenancy:'ST',building_sf:10000});await fill('fMonthlyBase','10000');await choose('fLeaseType','NNN');
    assert.equal(await p.locator('#fExpenseTreatment input:checked').inputValue(),'additional');assert.ok(await p.locator('#expenseAmounts').isVisible());
    assert.equal(await value('fOpexTotal'),'');assert.equal(await value('fTotalLeaseRate'),'');
    await fill('fOpexPsf','0.25');assert.equal(await value('fOpexTotal'),'2500.00');assert.equal(await value('fTotalLeaseRate'),'12500.00');
    await choose('fLeaseType','Modified Gross');await choose('fExpenseTreatment','included');await choose('fLeaseType','NNN');
    assert.equal(await value('fOpexPsf'),'0.25');assert.equal(await value('fTotalLeaseRate'),'12500.00');
    await choose('fExpenseTreatment','unknown');await p.evaluate(()=>mountSurveyDraft());assert.equal(await p.locator('#fExpenseTreatment input:checked').inputValue(),'unknown');
    await p.locator('#btnResetRent').click();assert.equal(await p.locator('#fExpenseTreatment input:checked').inputValue(),'additional');assert.equal(await value('fOpexPsf'),'');
    results.push('NNN selection opens separate expenses without inventing an amount; expense entry calculates total, reselection retains quote, explicit override survives remount and reset restores NNN default');

    await fresh({lease_type:'NNN',monthly_base_rent:10000,monthly_opex_psf:0.27555,total_monthly_opex:2755.5,total_lease_rate:12755.5,rent_calculation:null},false);
    assert.equal(await p.locator('#fExpenseTreatment input:checked').inputValue(),'additional');assert.equal(await value('fOpexPsf'),'0.27555');
    await fill('fNotes','NNN note only');assert.equal(JSON.stringify(await p.evaluate(()=>SurveyFields.serializeDraft(activeSurveyDraft().model).patch)),JSON.stringify({notes:'NNN note only'}));
    await fresh({lease_type:'Full Service Gross'});assert.equal(await p.locator('#fExpenseTreatment input:checked').inputValue(),'unknown');
    results.push('Existing unlinked NNN amounts and precision survive notes-only edits; other lease types keep their expense choice');

    await fresh({tenancy:'ST',building_sf:10000});await fill('fLeaseRate','1.25');await fill('fOfferedAcres','2');
    assert.equal(await value('fMonthlyBase'),'12500.00');assert.equal(await value('fRentAcre'),'6250');
    await choose('fExpenseTreatment','included');assert.equal(await value('fTotalLeaseRate'),'12500.00');
    const before=await p.evaluate(()=>JSON.stringify(activeSurveyDraft().model.rentDraft));await p.locator('#fMonthlyBase').focus();await p.keyboard.press('Tab');
    assert.equal(await p.evaluate(()=>JSON.stringify(activeSurveyDraft().model.rentDraft)),before,'focus/blur source unchanged');
    await fill('fMonthlyBase','15000');await fill('fBuildingSf','12000');assert.equal(await value('fLeaseRate'),'1.25');
    results.push('ST monthly trio, offered acres, calculated total adoption, area changes and focus/blur');

    await fresh({tenancy:'MT',building_sf:40000,suite_size:'5,000',suite_number:'101'});await fill('fLeaseRate','1.4');await choose('fExpenseTreatment','additional');await fill('fOpexPsf','0.25');
    assert.equal(await value('fMonthlyBase'),'7000.00');assert.equal(await value('fOpexTotal'),'1250.00');assert.equal(await value('fTotalLeaseRate'),'8250.00');
    await choose('fExpenseTreatment','included');assert.equal(await value('fTotalLeaseRate'),'7000.00');await choose('fExpenseTreatment','unknown');assert.equal(await value('fTotalLeaseRate'),'');await choose('fExpenseTreatment','additional');assert.equal(await value('fTotalLeaseRate'),'8250.00');
    await fill('fMonthlyBase','7500');await fill('fSuiteSize','6000');assert.equal(await value('fLeaseRate'),'1.25');
    await fill('fSuiteSize','6,500 - 15,000 SF');assert.equal(await value('fLeaseRate'),'');assert.equal(await value('fMonthlyBase'),'7500');
    results.push('MT Lease & Sale uses suite, not RBA; expense switch restores quote; ranges unresolved');

    await fresh({tenancy:'MT',land_area_ac:10});await fill('fRentAcre','3000');assert.equal(await value('fMonthlyBase'),'');await fill('fOfferedAcres','2');assert.equal(await value('fMonthlyBase'),'6000.00');assert.equal(await value('fLeaseRate'),'');
    await fill('fRentAcre','0');assert.equal(await value('fMonthlyBase'),'0.00');await fill('fRentAcre','');assert.equal(await value('fMonthlyBase'),'');
    results.push('Pure yard has no building PSF; parcel acres do not imply offered acres; zero/blank distinct');

    await fresh({tenancy:'ST',building_sf:10000});await fill('fBuildingSf','1.2M');await p.locator('#btnSave').click();assert.ok((await p.locator('#formError').innerText()).includes('one number'));assert.equal(await p.evaluate(()=>document.activeElement.id),'fBuildingSf');
    await fill('fBuildingSf','10000');await fill('fLeaseRate','1.23456');await p.locator('#btnSave').click();assert.ok((await p.locator('#formError').innerText()).includes('decimal'));assert.equal(await p.evaluate(()=>document.activeElement.id),'fLeaseRate');
    results.push('Strict typed validation blocks malformed, shorthand and excess precision with correct focus');

    const legacy={id:'30000000-0000-4000-8000-000000000001',survey_id:'10000000-0000-4000-8000-000000000001',updated_at:'2026-09-18T22:00:00Z',tenancy:null,building_sf:10000.123456,lease_rate_psf:1.333333,monthly_base_rent:9999,total_monthly_opex:340,monthly_opex_psf:.02,total_lease_rate:11111,rent_calculation:null,yard_area:null,lease_type:'Custom lease',availability:'Custom status',notes_2:'Second client note',internal_notes:'Private evidence',client_feedback:'Keep this',is_featured:true};
    await fresh(legacy,false);assert.equal(await value('fTotalLeaseRate'),'11111');assert.equal(await p.locator('#notes2Details').getAttribute('open'),'');
    await fill('fNotes','Updated client note');const patch=await p.evaluate(()=>SurveyFields.serializeDraft(activeSurveyDraft().model).patch);assert.equal(JSON.stringify(patch),JSON.stringify({notes:'Updated client note'}));assert.ok(await p.locator('#fLeaseType').getByText('Custom lease (saved)').isVisible());
    await p.locator('#btnCancelDraft').click();assert.equal(await value('fNotes'),'');
    results.push('Legacy conflicting pricing, historical precision, custom choices, null yard and feedback survive notes-only; Cancel restores');

    await p.evaluate(()=>{surveyEditor.bundle=null;surveyEditor.archives={};state.scraped=structuredClone(fixture.scrape);matchAndShowForm();});
    assert.equal(await value('fLeaseRate'),'');assert.ok((await p.evaluate(()=>activeSurveyDraft().source.leaseQuote.rawText)).includes('$18/SF/YR'));await choose('fTenancy','ST');await fill('fLeaseRate','1.5');
    await p.evaluate(()=>{fixture.scrape.leaseQuote.rawText='$20/SF/YR';fixture.scrape.leaseRate='20';});await p.locator('#btnRefresh').click();assert.equal(await value('fLeaseRate'),'1.5');assert.equal(await p.locator('#fMonthlyConfirmed').count(),0);
    await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving);assert.equal(await p.evaluate(()=>fixture.rows.at(-1).monthly_base_rent),60000);
    results.push('Annual source stays private/unadopted; typed monthly rent survives reread and saves without confirmation checkbox');

    await fresh({tenancy:'MT',building_sf:40000,suite_size:'5000',suite_number:'101'});await fill('fLeaseRate','1.4');await choose('fAvailability','Available');await fill('fNotes','Suite one');await p.locator('#btnAddSpace').click();
    assert.equal(await value('fLeaseRate'),'');assert.equal(await value('fSuiteSize'),'');assert.equal(await value('fNotes'),'');assert.equal(await value('fOfferedAcres'),'');
    await fill('fSuiteNumber','102');await fill('fSuiteSize','3000');await fill('fLeaseRate','2');await choose('fAvailability','Confirmed');
    await p.locator('#spaceDrafts [data-draft="0"]').click();assert.equal(await value('fLeaseRate'),'1.4');assert.equal(await value('fNotes'),'Suite one');
    await p.locator('#spaceDrafts [data-draft="1"]').click();await fill('fOfficeSf','4000');const writes=await p.evaluate(()=>fixture.writes);await p.locator('#btnSave').click();assert.equal(await p.evaluate(()=>fixture.writes),writes);await fill('fOfficeSf','500');
    await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving&&!surveyEditor.pending&&state.mode==='update');
    const saved=await p.evaluate(()=>fixture.rows.slice(-2));assert.equal(saved[0].monthly_base_rent,7000);assert.equal(saved[1].monthly_base_rent,6000);assert.equal(saved[0].availability,'Available');assert.equal(saved[1].availability,'Confirmed');
    results.push('Two independent spaces: shared building, blank sibling offering terms, independent rents/statuses, invalid suite blocks batch, saved rows hydrate');

    await fresh({tenancy:'ST',building_sf:10000});await fill('fMonthlyBase','12000');await p.evaluate(()=>fixture.scenario='lostAfterWorkerVerified');await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving);assert.ok(await p.locator('#pendingSurvey').isVisible());
    const stable=await p.evaluate(()=>surveyEditor.pending.request.rows[0].id);const count=await p.evaluate(()=>fixture.rows.length);await p.reload();await p.waitForFunction(()=>surveyEditor.pending);assert.equal(await p.evaluate(()=>surveyEditor.pending.request.rows[0].id),stable);
    await p.locator('#btnRecoverSurvey').click();await p.waitForFunction(()=>!surveyEditor.pending&&!surveyEditor.saving);assert.equal(await p.evaluate(()=>fixture.rows.length),count);
    results.push('Worker verified commit then lost response + panel reload recovers exact reviewed stable ID without duplicate');

    await p.evaluate(() => {
      surveyEditor.pending=null;surveyEditor.bundle=null;surveyEditor.archives={};fixture.scenario="ok";state.scraped=structuredClone(fixture.scrape);
      fixture.rows = ['101','102'].map((suite,i)=>({id:`30000000-0000-4000-8000-00000000000${i+1}`,survey_id:state.survey.id,address:'100 Fixture Way',city:'Phoenix',state:'AZ',tenancy:'MT',building_sf:40000,suite_number:suite,suite_size:'5000',for_sale_or_lease:['lease'],availability:'Available',updated_at:'2026-09-18T22:00:00Z',internal_notes:'CoStar ID: 123456'}));
      state.props=structuredClone(fixture.rows);matchAndShowForm();
    });
    assert.equal(await p.locator('#spaceCandidates [data-update]').count(),2);assert.equal(await p.locator('#btnSave').isDisabled(),true);
    await p.locator('#spaceCandidates [data-update="1"]').click();assert.equal(await value('fSuiteNumber'),'102');await fill('fNotes','Only selected suite');
    await p.locator('#btnRefresh').click();assert.equal(await value('fSuiteNumber'),'102');assert.equal(await value('fNotes'),'Only selected suite');
    await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving&&!surveyEditor.pending);
    const suites=await p.evaluate(()=>fixture.rows);assert.equal(suites[0].notes,undefined);assert.equal(suites[1].notes,'Only selected suite');
    await p.locator('#btnSavedDrafts').click();assert.equal(await p.locator('#savedDraftList [data-key="costar:123456"]').count(),0,'Source alias cannot reopen as a new insert');await p.locator('#btnSavedDrafts').click();
    results.push('Same CoStar ID and address candidates require explicit suite; reread retains selected suite and edited fields; update targets only that row; saved source aliases never reopen as inserts');

    await fill('fNotes','Local proposed note');await p.evaluate(()=>{fixture.scenario='changed';fixture.rows[1].notes='Changed in web app';fixture.rows[1].updated_at='2026-09-18T23:10:00Z';});await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving);assert.ok(await p.locator('#btnReviewLatest').isVisible());
    await p.locator('#btnReviewLatest').click();assert.equal(await value('fNotes'),'Changed in web app');assert.ok(await p.evaluate(()=>Object.values(surveyEditor.archives).some(b=>b.key.startsWith('conflict:')&&b.drafts[0].model.values.notes==='Local proposed note')));
    results.push('Stale update locks and exposes current saved row for fresh review, retaining the old edited draft');

    await fresh({tenancy:'MT',building_sf:40000,suite_number:'One',suite_size:'1000'});await p.locator('#btnAttachFlyer').click();await p.locator('#btnAddSpace').click();await p.waitForFunction(()=>surveyEditor.bundle.drafts[0].model.values.flyer_url);
    assert.equal(await value('fFlyerUrl'),'');assert.equal(await p.evaluate(()=>surveyEditor.bundle.drafts[0].model.values.flyer_url),'https://fixture.invalid/one.pdf');
    results.push('Delayed flyer attaches to its original suite even after switching to a sibling');

    await fresh({tenancy:'ST',building_sf:10000});await fill('fNotes','Retained on storage failure');const requests=await p.evaluate(()=>fixture.requests.filter(r=>r.type.startsWith('SAVE_SURVEY')).length);await p.evaluate(()=>fixture.storageFail=true);await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving);assert.equal(await p.evaluate(()=>fixture.requests.filter(r=>r.type.startsWith('SAVE_SURVEY')).length),requests);assert.equal(await value('fNotes'),'Retained on storage failure');await p.evaluate(()=>fixture.storageFail=false);
    results.push('Local storage failure retains the visible draft and dispatches zero writes');

    await p.evaluate(async()=>{fixture.lookupFail=true;state.scraped=null;await doRead();});assert.equal(await p.evaluate(()=>state.propsLookupOk),false);const beforeLookupSave=await p.evaluate(()=>fixture.requests.filter(r=>r.type.startsWith('SAVE_SURVEY')).length);await p.locator('#btnSave').click();assert.equal(await p.evaluate(()=>fixture.requests.filter(r=>r.type.startsWith('SAVE_SURVEY')).length),beforeLookupSave);assert.ok((await p.locator('#formError').innerText()).includes('lookup failed'));await p.evaluate(async()=>{fixture.lookupFail=false;await reloadProps();});
    results.push('Failed property lookup cannot become an empty-survey new-insert decision');

    await fresh({tenancy:'MT',building_sf:40000,suite_number:'A',suite_size:'1000'});await fill('fMonthlyBase','1500');await p.locator('#btnCombinedSpace').click();
    assert.equal(await value('fSuiteNumber'),'A');assert.equal(await value('fSuiteSize'),'1,000');assert.equal(await value('fMonthlyBase'),'1500');
    assert.ok((await p.evaluate(()=>fixture.openedTab)).endsWith('/surveys/10000000-0000-4000-8000-000000000001'));
    assert.equal(await p.evaluate(()=>surveyEditor.bundle.drafts.length),1);
    results.push('Combined action opens Master App for explicit member confirmation and preserves this draft without creating an unlinked option');

    await fresh({tenancy:'MT',building_sf:200000,suite_number:'1'});
    await p.locator('#fSpaceKind').selectOption('range');await fill('fSpaceMin','62784');await fill('fSpaceMax','174769');
    assert.equal(await value('fSuiteSize'),'62,784–174,769 SF');await fill('fLeaseRate','0.75');assert.equal(await value('fMonthlyBase'),'');
    await fill('fSpaceProposed','100000');assert.equal(Number(await value('fMonthlyBase')),75000);
    await fill('fMonthlyBase','80000');assert.equal(await p.evaluate(()=>activeSurveyDraft().model.values.space_option.quoteArea),'100000');
    await fill('fSpaceProposed','110000');assert.equal(await value('fMonthlyBase'),'');assert.equal(await value('fLeaseRate'),'');
    await fill('fMonthlyBase','82500');await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.pending&&!surveyEditor.saving);
    assert.equal(await value('fSuiteSize'),'62,784–174,769 SF');assert.equal(await value('fSpaceProposed'),'110,000');assert.equal(await value('fMonthlyBase'),'82500');
    assert.equal(await p.evaluate(()=>activeSurveyDraft().model.isNew),false);
    await fill('fNotes','Range note only');await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.pending&&!surveyEditor.saving);
    const rangePatch=await p.evaluate(()=>fixture.requests.filter(r=>r.type==='SAVE_SURVEY_UPDATE').at(-1).request.patch);
    assert.equal(JSON.stringify(rangePatch),JSON.stringify({notes:'Range note only'}));
    await p.reload();await p.waitForFunction(()=>state.survey?.id);assert.equal(await value('fSpaceProposed'),'110,000');assert.equal(await value('fSuiteSize'),'62,784–174,769 SF');
    results.push('Divisible range stores advertised bounds and scenario separately; rate calculates scenario, changing scenario clears total quote; insert, notes-only update, and reload preserve exact metadata');

    await fresh({tenancy:'ST',building_sf:200000,suite_number:'1',suite_size:'62,784–174,769 SF',space_option:{kind:'range',min:'62784',max:'174769',proposed:'',members:[],review:false,quoteArea:''}});
    await fill('fMonthlyBase','50000');await p.locator('#btnSave').click();assert.ok((await p.locator('#formError').innerText()).includes('proposed SF'));
    await fill('fSpaceProposed','180000');await p.locator('#btnSave').click();assert.ok((await p.locator('#formError').innerText()).includes('within the advertised range'));
    await fill('fSpaceProposed','100000');await fill('fLeaseRate','0.75');assert.equal(Number(await value('fMonthlyBase')),75000);
    for(const width of [320,390,720]) { await p.setViewportSize({width,height:844});await p.locator('#rangeFields').scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:`output/review/space-range-${width}.png`}); }
    results.push('Invalid or missing proposed area blocks total quote; ST range uses proposed SF; range controls fit 320, 390 and 720px widths');

    await fresh({id:'30000000-0000-4000-8000-000000000009',survey_id:'10000000-0000-4000-8000-000000000001',updated_at:'2026-09-18T23:00:00Z',tenancy:'MT',suite_number:'3 + 4',suite_size:'43200',building_sf:86400,
      space_option:{kind:'combined',min:'',max:'',proposed:'',members:['30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004'],review:false,quoteArea:''},notes:'Keep'},false);
    assert.ok(await p.locator('#combinedSpaceNotice').isVisible());assert.equal(await p.locator('#fSuiteSize').isDisabled(),true);assert.equal(await p.locator('#fMonthlyBase').isDisabled(),true);
    await fill('fNotes','Only notes changed');assert.equal(JSON.stringify(await p.evaluate(()=>SurveyFields.serializeDraft(activeSurveyDraft().model).patch)),JSON.stringify({notes:'Only notes changed'}));
    results.push('Linked combined rows remain readable with Master App link; member-dependent edits locked and notes-only patch preserves metadata');

    await fresh({tenancy:'ST',building_sf:10000});await fill('fNotes','Keep across surveys');await p.evaluate(async()=>{await selectSurvey({id:'10000000-0000-4000-8000-000000000002',name:'Other fixture survey',survey_type:'sale'});});assert.equal(await p.evaluate(()=>surveyEditor.bundle),null);await p.evaluate(async()=>{await selectSurvey({id:'10000000-0000-4000-8000-000000000001',name:'Disposable Survey',survey_type:'lease_and_sale'});});assert.equal(await value('fNotes'),'Keep across surveys');
    results.push('Survey switching restores only that survey’s saved draft');

    await fresh({tenancy:'ST',building_sf:10000});await fill('fNotes','Unsent draft in this panel');await p.evaluate(()=>fixture.scenario='differentPending');await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving);assert.equal(await value('fAddress'),'200 Other Pending Way');assert.ok(await p.evaluate(()=>Object.values(surveyEditor.archives).some(b=>!b.reviewedRequest&&b.drafts[0].model.values.notes==='Unsent draft in this panel')));assert.equal(await p.locator('#fAddress').isDisabled(),true);
    results.push('Another panel pending save shows its exact locked payload and preserves this panel’s unsent draft separately');
    await fresh({tenancy:'ST',building_sf:10000});await fill('fNotes','Keep for the original account');

    const oldAccountKey=await p.evaluate(()=>surveyDraftKey());await p.evaluate(async()=>{await persistSurveyDraft();fixture.accountId='20000000-0000-4000-8000-000000000002';await onAuthed();});
    assert.equal(await p.evaluate(()=>surveyEditor.bundle),null);assert.equal(await p.evaluate(()=>fixture.storage[surveyDraftKey()]?.bundles && Object.keys(fixture.storage[surveyDraftKey()].bundles).length || 0),0);assert.ok(await p.evaluate(key=>Boolean(fixture.storage[key]),oldAccountKey));
    results.push('Session expiry then different account never copies or restores the prior account draft');

    // Reproduce saving Yard 3, then reading Suite 7 at the same CoStar property.
    await p.evaluate(()=>{
      surveyEditor.pending=null;surveyEditor.bundle=null;surveyEditor.archives={};fixture.rows=[];state.props=[];
      fixture.scenario='ok';fixture.scrape={costarId:'231512',street:'1139 E Curry Rd',city:'Tempe',state:'AZ',zip:'85281',rba:'31600',acLot:'1.7',
        selectedSpace:{scope:'space-details',identity:'yard-3',suite:'Yard 3',availableSf:'1310',officeSf:null,canPrefill:true,monthlyRent:'470',serviceType:'Modified Gross'}};
      state.scraped=structuredClone(fixture.scrape);matchAndShowForm();
    });
    await choose('fTenancy','MT');await fill('fNotes','First space only');await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving&&!surveyEditor.pending);
    assert.equal(await p.evaluate(()=>fixture.rows.length),1);
    const firstSpace=await p.evaluate(()=>JSON.stringify(fixture.rows[0]));
    await p.evaluate(()=>{fixture.scrape.selectedSpace={scope:'space-details',identity:'suite-7',suite:'7',availableSf:'1200',officeSf:'100',canPrefill:true,monthlyRent:'1680',serviceType:'Modified Gross'};});
    await p.locator('#btnRefresh').click();assert.equal(await value('fSuiteSize'),'1,200');
    await fill('fNotes','Second space reviewed');
    assert.equal(await p.locator('#spaceCandidates [data-add="0"]').innerText(),'Add current CoStar space');
    await p.locator('#spaceCandidates [data-add="0"]').click();
    assert.equal(await value('fSuiteNumber'),'7');assert.equal(await value('fSuiteSize'),'1,200');assert.equal(await value('fOfficeSf'),'100');assert.equal(await value('fBuildingSf'),'31,600');
    assert.equal(await value('fMonthlyBase'),'1680');assert.equal(await value('fLeaseRate'),'1.4');assert.equal(await value('fNotes'),'Second space reviewed');
    assert.equal(await p.evaluate(()=>surveyEditor.bundle.drafts.length),1);assert.equal(await p.evaluate(()=>fixture.rows.length),1,'Selecting Add does not save');
    await p.locator('#btnRefresh').click();assert.equal(await p.locator('#dupChooser').isVisible(),false);assert.equal(await value('fSuiteSize'),'1,200');
    await fill('fOfficeSf','');await fill('fMonthlyBase','');await p.locator('#btnRefresh').click();assert.equal(await value('fOfficeSf'),'');assert.equal(await value('fMonthlyBase'),'');
    await p.reload();await p.waitForFunction(()=>state.survey?.id);assert.equal(await value('fSuiteNumber'),'7');assert.equal(await value('fOfficeSf'),'');assert.equal(await value('fNotes'),'Second space reviewed');
    await fill('fOfficeSf','100');await fill('fMonthlyBase','1680');await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving&&!surveyEditor.pending);
    assert.equal(await p.evaluate(()=>fixture.rows.length),2);assert.equal(await p.evaluate(()=>JSON.stringify(fixture.rows[0])),firstSpace);
    assert.equal(await p.evaluate(()=>fixture.rows[1].suite_number),'7');assert.equal(await p.evaluate(()=>fixture.rows[1].suite_size),'1200');assert.equal(await p.evaluate(()=>fixture.rows[1].office_sf),100);assert.equal(await p.evaluate(()=>fixture.rows[1].monthly_base_rent),1680);
    await p.locator('#btnRefresh').click();assert.equal(await p.evaluate(()=>activeSurveyDraft().model.isNew),false);await p.locator('#btnSave').click();await p.waitForFunction(()=>!surveyEditor.saving&&!surveyEditor.pending);assert.equal(await p.evaluate(()=>fixture.rows.length),2);
    await p.evaluate(()=>{fixture.scrape.selectedSpace={scope:'space-details',identity:'yard-3',suite:'Yard 3',availableSf:'1310',canPrefill:true,monthlyRent:'470'};});
    await p.locator('#btnRefresh').click();assert.equal(await value('fSuiteNumber'),'Yard 3');assert.equal(await value('fNotes'),'First space only');
    results.push('Save first space then refresh next at same building: Add current CoStar space retains suite/office/monthly rent and reviewed edits; refresh/reload preserve clears, save inserts once, first space unchanged');

    // Old versions retained a source alias but discarded its capture into a blank sibling.
    for (const edited of [false,true,'size']) {
      await p.evaluate(async edited=>{
        surveyEditor.bundle=null;surveyEditor.archives={};state.scraped=structuredClone(fixture.scrape);
        state.scraped.selectedSpace={scope:'space-details',identity:'legacy-blank-'+edited,suite:'7',availableSf:'1200',officeSf:'100',canPrefill:true,monthlyRent:'1680',serviceType:'Modified Gross'};
        fixture.scrape=structuredClone(state.scraped);
        setupForm('insert',null);const original=surveyEditor.bundle;original.decision='add';await persistSurveyDraft();
        const seed=SurveySpaces.availableSpaceSeed(fixture.rows[0]),draft=makeSurveyDraft(seed,true);
        if(edited){draft.model.values.office_sf='';draft.model.values.notes='My retained note';draft.model.rentDraft=SurveyRent.editRent(draft.model.rentDraft,'total','');}
        if(edited==='size'){draft.model.values.suite_number='7 reviewed';draft.model.values.suite_size='1250';}
        const destination={key:'spaces:old-'+edited,active:0,drafts:[draft]};surveyEditor.archives[destination.key]=destination;
        surveyEditor.archives[original.key].destinationKey=destination.key;surveyEditor.bundle=destination;mountSurveyDraft();await persistSurveyDraft();
      },edited);
      assert.equal(await value('fSuiteSize'),edited==='size'?'1,250':'');await p.locator('#btnRefresh').click();
      assert.equal(await value('fSuiteNumber'),edited==='size'?'7 reviewed':'7');assert.equal(await value('fSuiteSize'),edited==='size'?'1,250':'1,200');assert.equal(await value('fOfficeSf'),edited?'':'100');assert.equal(await value('fMonthlyBase'),edited?'':'1680');
      if(edited)assert.equal(await value('fNotes'),'My retained note');
      await fill('fSuiteSize','');await p.locator('#btnRefresh').click();assert.equal(await value('fSuiteSize'),'','Recovered capture must not refill later intentional clears');
    }
    results.push('Refresh repairs legacy blank Add-space drafts from their exact captured source; entered notes/cleared office and rent remain unchanged, repair runs once');

    await p.evaluate(()=>{
      surveyEditor.bundle=null;surveyEditor.archives={};fixture.scrape.selectedSpace={scope:'space-details',identity:'range-add',suite:'Range',availableRange:{min:'1000',max:'2000'},canPrefill:false};
      state.scraped=structuredClone(fixture.scrape);matchAndShowForm();
    });
    await p.locator('#spaceCandidates [data-add="0"]').click();assert.equal(await value('fSuiteSize'),'1,000–2,000 SF');assert.equal(await value('fSpaceMin'),'1,000');assert.equal(await value('fSpaceMax'),'2,000');assert.equal(await value('fSpaceProposed'),'');assert.equal(await value('fMonthlyBase'),'');
    await p.locator('#btnAddSpace').click();assert.equal(await value('fSuiteNumber'),'');assert.equal(await value('fSuiteSize'),'');assert.equal(await value('fMonthlyBase'),'');assert.equal(await value('fBuildingSf'),'31,600');
    assert.equal(await p.evaluate(()=>surveyEditor.bundle.drafts.length),2);await p.locator('#spaceDrafts [data-draft="0"]').click();assert.equal(await value('fSuiteSize'),'1,000–2,000 SF');
    results.push('Add captured divisible space preserves its range without inventing proposed area or rent; separate Blank space remains manual and preserves the captured sibling');

    for(const [width,height] of [[320,740],[390,844],[560,900]]){
      await p.setViewportSize({width,height});await fresh({tenancy:'ST',building_sf:10000});await p.evaluate(()=>window.scrollTo(0,0));
      const metrics=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,order:[...document.querySelectorAll('#screen-form > [data-sec]')].slice(0,4).map(n=>n.dataset.sec).join(','),area:document.querySelector('[data-sec="size"]').getBoundingClientRect().top,save:document.querySelector('#btnSaveBottom').getBoundingClientRect().bottom,height:innerHeight}));
      await p.evaluate(()=>document.getElementById('toast').classList.add('hidden'));
      if (typeof process !== 'undefined' && process.env.SURVEY_SCREENSHOT_DIR) await p.screenshot({path:process.env.SURVEY_SCREENSHOT_DIR + `/survey-st-${width}.png`});
      assert.equal(metrics.overflow,false,`no overflow ${width}`);assert.equal(metrics.order,'setup,size,lease,offering',`area/pricing/availability order ${width}`);assert.ok(metrics.area<height-60,`area above footer ${width}`);assert.ok(metrics.save<=height,`save visible ${width}`);
    }
    results.push('320×740, 390×844 and 560×900: Area then pricing then availability, Area above fold, Save reachable, no overflow');
    await p.locator('#fTenancy input[value="ST"]').focus();await p.keyboard.press('ArrowRight');assert.equal(await p.evaluate(()=>document.activeElement.value),'MT');await p.keyboard.press('ArrowLeft');assert.equal(await p.evaluate(()=>document.activeElement.value),'ST');
    results.push('Native radio arrow-key focus survives selection');
    await p.setViewportSize({width:390,height:844});await fresh({tenancy:'MT',building_sf:40000,suite_size:'5000',suite_number:'101'});await fill('fLeaseRate','1.4');await choose('fExpenseTreatment','additional');await fill('fOpexPsf','0.25');await fill('fOfferedAcres','2');await p.locator('#leaseBlock').scrollIntoViewIfNeeded();
    if(typeof process !== 'undefined' && process.env.SURVEY_SCREENSHOT_DIR)await p.screenshot({path:process.env.SURVEY_SCREENSHOT_DIR+'/survey-mt-pricing-390.png'});
    assert.equal(errors.length,0,errors.join(';'));assert.equal(blocked.length,0,'No external requests');
    return {results,errors,externalRequests:blocked};
  }finally{await context.close();}
}
