const assert = require('node:assert/strict');
const {test} = require('node:test');
const path = require('node:path');
const root = process.env.EXTENSION_ROOT || path.resolve(__dirname,'..');
const Flyers = require(path.join(root,'survey-flyers.js'));
const Fields = require(path.join(root,'survey-fields.js'));
const pdf = 'https://fixture.invalid/building.pdf';
const row = {address:'1139 E Curry Rd',city:'Tempe',state:'AZ',tenancy:'MT',suite_number:'7',suite_size:'1200',internal_notes:'CoStar ID: 231512'};
const draft = (changes={},isNew=true) => ({model:Fields.hydrateDraft({...row,...changes},{isNew})});

test('one building flyer supplies independent new spaces, never a different CoStar building',()=>{
  const defaults={},first=draft(),next=draft({suite_number:'8'});
  assert.equal(Flyers.remember(first,defaults,pdf),true);
  assert.equal(Flyers.inherit(next,defaults),true);assert.equal(next.model.values.flyer_url,pdf);
  assert.equal(Flyers.inherit(draft({address:'1141 E Curry Rd'}),defaults),false);
  assert.equal(Flyers.inherit(draft({internal_notes:'CoStar ID: 999999'}),defaults),false);
  assert.equal(first.model.values.flyer_url,undefined);
});
test('unknown tenancy or incomplete building identity does not create a shared default',()=>{
  for(const changes of [{tenancy:null},{tenancy:'ST'},{city:''},{address:''},{state:''}]) assert.equal(Flyers.identity(draft(changes)),null);
  for(const url of ['',null,'javascript:alert(1)','https://name:password@fixture.invalid/a.pdf']) assert.equal(Flyers.remember(draft(),{},url),false);
});
test('saved rows and suite-specific replacements/removals remain independent',()=>{
  const defaults={};Flyers.remember(draft(),defaults,pdf);
  const saved=draft({flyer_url:null},false);assert.equal(Flyers.inherit(saved,defaults),false);
  saved.model.values.notes='Only a note';assert.deepEqual(Fields.serializeDraft(saved.model).patch,{notes:'Only a note'});
  const removed=draft({flyer_url:null});removed.flyerMode='space';assert.equal(Flyers.inherit(removed,defaults),false);
  const override=draft({flyer_url:'https://fixture.invalid/suite.pdf'});assert.equal(Flyers.inherit(override,defaults),false);
});
test('changing an inherited draft address drops the old default without removing explicit attachments',()=>{
  const defaults={};Flyers.remember(draft(),defaults,pdf);
  const inherited=draft();Flyers.inherit(inherited,defaults);inherited.model.values.address='200 Other Rd';
  Flyers.inherit(inherited,defaults);assert.equal(inherited.model.values.flyer_url,null);
  const own=draft({flyer_url:pdf});own.flyerMode='space';own.model.values.address='200 Other Rd';
  Flyers.inherit(own,defaults);assert.equal(own.model.values.flyer_url,pdf);
});
test('manual sibling anchors keep the source building ID without borrowing suite data',()=>{
  const first=draft(),defaults={};Flyers.remember(first,defaults,pdf);
  const next=draft({internal_notes:null});next.flyerBuilding=Flyers.identity(first);
  assert.equal(Flyers.inherit(next,defaults),true);assert.equal(next.model.values.internal_notes,null);
  next.model.values.address='200 Other Rd';assert.equal(Flyers.identity(next).costarId,'');
});
test('saved flyer choices deduplicate URLs and exclude another address or conflicting CoStar ID',()=>{
  const choices=Flyers.candidates(draft(),[
    {...row,flyer_url:pdf},{...row,suite_number:'8',flyer_url:pdf},
    {...row,address:'200 Other Rd',flyer_url:'https://fixture.invalid/other.pdf'},
    {...row,internal_notes:'CoStar ID: 999999',flyer_url:'https://fixture.invalid/conflict.pdf'},
    {...row,flyer_url:'javascript:bad'},
  ]);
  assert.deepEqual(choices,[{url:pdf,label:'Flyer from 7'}]);
});
test('cache replacement or removal affects future defaults, not existing attached URLs',()=>{
  const defaults={},first=draft();Flyers.remember(first,defaults,pdf);
  const existing=draft();Flyers.inherit(existing,defaults);
  Flyers.remember(first,defaults,'https://fixture.invalid/new.pdf');Flyers.inherit(existing,defaults);
  assert.equal(existing.model.values.flyer_url,pdf);
  delete defaults[Flyers.identity(first).key];assert.equal(Flyers.inherit(draft(),defaults),false);
});
