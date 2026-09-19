const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const root = process.env.EXTENSION_ROOT || path.resolve(__dirname, '..');
const S = require(path.join(root, 'survey-spaces.js'));
const F = require(path.join(root, 'survey-fields.js'));
const R = require(path.join(root, 'survey-rent.js'));
const range = (changes = {}) => ({ kind:'range', min:'62784', max:'174769', proposed:'', members:[], review:false, quoteArea:'', ...changes });
const row = (changes = {}) => ({ address:'6825 W Buckeye Rd', tenancy:'MT', suite_number:'1', building_sf:200000,
  suite_size:'62,784–174,769 SF', space_option:range(), ...changes });
const calc = (basis, amount) => ({version:1, rent:{basis,amount}, expenses:{basis:'total',amount:null,treatment:'unknown'},offered_acres:null});

test('only selected individual space supplies range metadata; range source is immutable', () => {
  const source={scope:'space-details',availableRange:{min:'62,784',max:'174,769'}};
  assert.deepEqual(S.sourceRange(source),range());
  for(const scope of [undefined,'property-summary','lease-table']) assert.equal(S.sourceRange({...source,scope}),null);
  assert.equal(S.sourceRange({scope:'space-details',availableSf:'21600',floorContig:'43200'}),null);
  for(const bad of [{min:'1,00',max:'2000'},{min:'0',max:'2000'},{min:'3000',max:'2000'}]) assert.equal(S.sourceRange({...source,availableRange:bad}),null);
  assert.deepEqual(source.availableRange,{min:'62,784',max:'174,769'});
});

test('range constraints reject reversed, malformed, out-of-range and mismatched area', () => {
  assert.equal(S.validateSpaceOption(range(),row()),null);
  for(const option of [range({min:'175000'}),range({min:'62,78'}),range({proposed:'62000'}),range({proposed:'174770'}),range({members:['member']}),range({quoteArea:'abc'})]) assert.ok(S.validateSpaceOption(option,row()));
  assert.ok(S.validateSpaceOption(range(),row({suite_size:'174769'})));
  assert.ok(S.validateSpaceOption(range(),row({building_sf:100000})));
});

test('range scenario overrides ST building area and missing scenario never invents totals', () => {
  for(const tenancy of ['ST','MT',null]) {
    assert.equal(R.resolveSurveyRentArea(row({tenancy})),null);
    assert.equal(R.resolveSurveyRentArea(row({tenancy,space_option:range({proposed:'100000'})})),100000);
  }
  const noScenario=R.calculateSurveyRent(calc('sf',0.75),row());
  assert.equal(noScenario.lease_rate_psf,0.75); assert.equal(noScenario.monthly_base_rent,null);
  const scenario=R.calculateSurveyRent(calc('sf',0.75),row({space_option:range({proposed:'100000'})}));
  assert.equal(scenario.monthly_base_rent,75000);
  assert.equal(R.resolveSurveyRentArea(row({space_option:range({proposed:'100000',review:true})})),null);
});

test('range capture insert carries metadata and never writes review metadata into protected feedback', () => {
  const draft=F.hydrateDraft(row(),{isNew:true});
  const value=F.serializeDraft(draft);
  assert.equal(value.valid,true,JSON.stringify(value.issues)); assert.deepEqual(value.values.space_option,range());
  const request=S.createBatchRequest({accountId:'10000000-0000-4000-8000-000000000001',surveyId:'20000000-0000-4000-8000-000000000001',rows:[value.values]});
  assert.deepEqual(request.rows[0].space_option,range()); assert.equal(request.rows[0].suite_size,'62,784–174,769 SF');
});

test('range total rent and separate expenses must be tied to the selected area', () => {
  for (const proposed of ['', '100000']) {
    const bad = row({space_option:range({proposed}),rent_calculation:calc('total',75000)});
    assert.equal(F.validateSurveyWrite(bad).valid,false);
  }
  const accepted=row({space_option:range({proposed:'100000',quoteArea:'100000'}),rent_calculation:calc('total',75000)});
  assert.equal(F.validateSurveyWrite(accepted).valid,true);
  const stale={...accepted,space_option:range({proposed:'110000',quoteArea:'100000'})};
  assert.equal(F.validateSurveyWrite({space_option:stale.space_option},accepted).valid,false);
  const expenses=row({space_option:range({proposed:'100000'}),rent_calculation:{...calc('sf',0.75),expenses:{basis:'total',amount:500,treatment:'additional'}}});
  assert.equal(F.validateSurveyWrite(expenses).valid,false);
});

test('saved range notes-only update preserves exact metadata, source terms, and feedback', () => {
  const saved=row({space_option:range({proposed:'100000',quoteArea:'100000',featuresArea:'100000'}),rent_calculation:calc('total',75000),client_feedback:'Keep',notes:'old'});
  const draft=F.hydrateDraft(saved); draft.values.notes='new';
  const result=F.serializeDraft(draft); assert.equal(result.valid,true,JSON.stringify(result.issues));assert.deepEqual(result.patch,{notes:'new'});
  assert.deepEqual(result.values.space_option,saved.space_option);assert.equal(result.values.client_feedback,'Keep');
});

test('combined metadata preserves unrelated updates and rejects unreviewable relationship/price changes', () => {
  const saved=row({suite_number:'3 + 4',suite_size:'43200',space_option:{...range(),kind:'combined',min:'',max:'',members:['30000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000004']},notes:'old'});
  const draft=F.hydrateDraft(saved);draft.values.notes='new';
  const result=F.serializeDraft(draft);assert.equal(result.valid,true,JSON.stringify(result.issues));assert.deepEqual(result.patch,{notes:'new'});
  for(const patch of [{suite_size:'40000'},{availability:'Not Available'},{space_option:{...saved.space_option,review:true}},{monthly_base_rent:1000}]) assert.equal(F.validateSurveyWrite(patch,saved).valid,false);
  assert.equal(F.validateSurveyWrite(saved).valid,false,'extension cannot insert combined member relationships');
});

test('legacy free-text combined rows and future metadata remain unchanged on notes-only update', () => {
  for(const space_option of [undefined,{kind:'future-version',arbitrary:{keep:1}}]) {
    const saved=row({suite_number:'Combined: 3 + 4',suite_size:'43200',space_option,notes:'old'});
    const draft=F.hydrateDraft(saved);draft.values.notes='new';
    const result=F.serializeDraft(draft);assert.equal(result.valid,true);assert.deepEqual(result.patch,{notes:'new'});
  }
});

test('a restored or manually named new legacy combined draft cannot bypass member linking', () => {
  assert.equal(F.validateSurveyWrite(row({suite_number:'Combined: 3 + 4',space_option:null,suite_size:'43200'})).valid,false);
  const baseline=row({suite_number:'3',space_option:null,suite_size:'21600'});
  assert.equal(F.validateSurveyWrite({suite_number:'Combined: 3 + 4'},baseline).valid,false);
});

test('manual comma-formatted range controls serialize canonical digits while untouched metadata stays exact', () => {
  const draft=F.hydrateDraft(row({space_option:range({min:'62,784',max:'174,769',proposed:' 100,000 '})}),{isNew:true});
  const result=F.serializeDraft(draft);assert.equal(result.valid,true,JSON.stringify(result.issues));
  assert.deepEqual(result.values.space_option,range({proposed:'100000'}));
  assert.equal(draft.values.space_option.min,'62,784');
});
