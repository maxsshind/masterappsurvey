/* Listing text is untrusted evidence, never instructions or automatic record writes. */
(function(root) {
'use strict';
root.installCompListingReview = function(api) {
  const $ = id => document.getElementById(id), button=$('compAnalyzeListing'), bar=$('compListingAnalysis'), status=$('compListingStatus'), dialog=$('compListingReview');
  let busy=false, queued=false, review=null;
  const same=s=>JSON.stringify(api.snapshot())===JSON.stringify(s);
  const label=v=>v==null||v===''||(Array.isArray(v)&&!v.length)?'Not entered':Array.isArray(v)?v.join(', '):typeof v==='boolean'?(v?'Yes':'No'):typeof v==='number'?v.toLocaleString('en-US',{maximumFractionDigits:6}):String(v);
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
  function render(snapshot,result) {
    const rows=[];
    for(let item of result.suggestions||[]) {
      if(item.field==='clear_height_ft')item={...item,field:'clear_height',value:String(item.value)};
      if(!api.fields.includes(item.field)||rows.some(r=>r.field===item.field)||typeof item.evidence!=='string'||!item.evidence.trim())continue;
      const parsed=api.parse(item.field,item.value);if(parsed.error||parsed.value==null)continue;
      const current=snapshot.request.currentValues[item.field]??snapshot.raw?.['comp_'+item.field]??null;
      if(JSON.stringify(current)===JSON.stringify(parsed.value))continue;
      rows.push({field:item.field,value:parsed.value,current,evidence:item.evidence.slice(0,2000)});
    }
    review={snapshot,rows};
    const body=$('compListingSuggestions');body.replaceChildren();
    for(const row of rows) {
      const card=node('label',null,'flyer-suggestion'),check=node('input');check.type='checkbox';check.checked=false;row.check=check;
      const content=node('span');content.append(node('strong',api.labels[row.field]||row.field),node('span',`${label(row.current)} → ${label(row.value)}`,'flyer-values'),node('q',row.evidence,'flyer-evidence'));
      card.append(check,content);body.append(card);
    }
    if(!rows.length)body.append(node('p','No new supported details found. Your current values are unchanged.'));
    const warnings=$('compListingWarnings');warnings.replaceChildren();
    for(const text of (result.warnings||[]).filter(x=>typeof x==='string').slice(0,20))warnings.append(node('p',text));
    const apply=$('compApplyListing'),sync=()=>{const count=rows.filter(r=>r.check.checked).length;apply.disabled=!count;apply.textContent=count?`Update ${count} fields`:'Select fields';};
    body.onchange=sync;sync();button.textContent=`Review listing (${rows.length})`;
    status.textContent=rows.length?'Suggestions ready · your fields are unchanged':'Listing notes checked';
  }
  async function analyze(open=false) {
    if(busy){queued=true;return;}
    if(api.locked())return;
    const snapshot=api.snapshot(),text=snapshot.request.listing_text;
    const available=Boolean(text?.sale_notes?.trim()||text?.sale_highlights?.trim());
    bar.classList.toggle('hidden',!available);review=null;
    if(!available||!snapshot.request.address.trim())return;
    busy=true;button.disabled=true;button.textContent='Analyzing…';status.textContent='Reading all listing details in Notes and Highlights…';
    try {
      const result=await api.analyze(snapshot.request);
      if(!same(snapshot)||api.locked()){button.textContent='Analyze listing';status.textContent='Form changed · analyze again for current suggestions';return;}
      if(!result?.ok)throw new Error(result?.error||'Analysis unavailable');
      render(snapshot,result);if(open)dialog.showModal();
    } catch (error) {review=null;button.textContent='Retry listing analysis';status.textContent='Analysis unavailable · '+String(error.message||'Try again').slice(0,350)+' · your fields are unchanged';}
    finally {busy=false;button.disabled=false;if(queued){queued=false;analyze(false);}}
  }
  button.addEventListener('click',()=>{if(review&&same(review.snapshot)&&!api.locked())dialog.showModal();else analyze(true);});
  $('compCloseListing').addEventListener('click',()=>dialog.close());
  $('compApplyListing').addEventListener('click',()=>{
    if(!review)return;
    if(!same(review.snapshot)||api.locked()){dialog.close();review=null;button.textContent='Analyze listing';status.textContent='Form changed · analyze again before applying';return;}
    const chosen=review.rows.filter(r=>r.check.checked);api.apply(chosen);dialog.close();review=null;
    status.textContent=`Updated ${chosen.length} fields · review the form, then Save comp`;button.textContent='Analyze listing';
  });
  document.addEventListener('comp-listing-read',()=>analyze(false));
};
})(globalThis);
