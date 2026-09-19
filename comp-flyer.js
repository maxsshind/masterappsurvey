/* Flyer suggestions stay in the form until the broker explicitly saves the comp. */
(function(root) {
'use strict';
root.installCompFlyerReview = function(api) {
  const $ = id => document.getElementById(id);
  const button = $('compAnalyzeFlyer'), dialog = $('compFlyerReview');
  let busy = false, review = null;
  const label = value => value == null || value === '' ? 'Not entered' : value === true ? 'Yes' : value === false ? 'No' : String(value);
  const same = snapshot => JSON.stringify(api.snapshot()) === JSON.stringify(snapshot);
  function node(tag, text, className) { const el=document.createElement(tag); if(text!=null)el.textContent=text;if(className)el.className=className;return el; }
  button.addEventListener('click', async () => {
    if (busy || api.locked()) return;
    const snapshot = api.snapshot();
    if (!snapshot.request.flyer_url) return api.message('Attach the open PDF with Flyer first, then choose Analyze flyer.', true);
    if (!snapshot.request.address.trim()) return api.message('Enter the listing address before analyzing its flyer.', true);
    busy=true;button.disabled=true;button.textContent='Analyzing…';
    api.message('Reading the attached flyer. Your form stays editable.');
    try {
      const result = await api.analyze(snapshot.request);
      if (!same(snapshot) || api.locked()) return api.message('The listing, flyer or form changed during analysis. Analyze again to use the current draft.', true);
      if (!result?.ok) return api.message(result?.error || 'Flyer analysis failed. Try again.', true);
      const rows=[];
      for (const item of result.suggestions || []) {
        // No arbitrary field writes or model HTML. The property-field parser is authoritative.
        let field=item.field, value=item.value;
        if(field==='clear_height_ft' && api.fields.includes('clear_height')) {field='clear_height';value=String(value);}
        if (!api.fields.includes(field) || rows.some(row=>row.field===field) || typeof item.evidence!=='string' || !item.evidence.trim()) continue;
        const parsed=api.parse(field,value);
        if(parsed.error || parsed.value==null)continue;
        const current=snapshot.request.currentValues[field];
        if(String(current??'')===String(parsed.value))continue;
        rows.push({field,value:parsed.value,current,evidence:item.evidence.slice(0,1000)});
      }
      review={snapshot,rows};
      const body=$('compFlyerSuggestions');body.replaceChildren();
      for(const row of rows) {
        const card=node('label',null,'flyer-suggestion');
        const check=node('input');check.type='checkbox';check.checked=row.current==null||row.current==='';row.check=check;
        const content=node('span');content.append(node('strong',api.labels[row.field]));
        content.append(node('span',`${label(row.current)} → ${label(row.value)}`,'flyer-values'));
        content.append(node('q',row.evidence,'flyer-evidence'));card.append(check,content);body.append(card);
      }
      if(!rows.length)body.append(node('p','No new supported property details were found. Your current values are unchanged.'));
      const warnings=$('compFlyerWarnings');warnings.replaceChildren();
      const items=Array.isArray(result.warnings)?result.warnings.filter(x=>typeof x==='string').slice(0,12):[];
      warnings.hidden=!items.length;
      if(items.length){warnings.append(node('summary',`${items.length} item${items.length===1?'':'s'} to check`));for(const text of items)warnings.append(node('p',text));}
      const apply=$('compApplyFlyer');const sync=()=>{const n=rows.filter(r=>r.check.checked).length;apply.disabled=!n;apply.textContent=n?`Update ${n} field${n===1?'':'s'}`:'Select fields';};
      body.onchange=sync;sync();dialog.showModal();api.message('Review the flyer suggestions before updating your form.');
    } catch {api.message('Flyer analysis could not finish. Your form is unchanged; try again.',true);}
    finally {busy=false;button.disabled=false;button.textContent='Analyze flyer';}
  });
  $('compCloseFlyer').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{review=null;});
  $('compApplyFlyer').addEventListener('click',()=>{
    if(!review)return;
    if(!same(review.snapshot)||api.locked()){dialog.close();return api.message('The form changed. Analyze again before applying suggestions.',true);}
    const chosen=review.rows.filter(row=>row.check.checked);
    api.apply(chosen);dialog.close();api.message(`Updated ${chosen.length} field${chosen.length===1?'':'s'} from the flyer. Review the form, then Save comp.`);
  });
};
})(globalThis);
