/* Local building-flyer defaults. Survey rows still own their individual URLs. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SurveyFlyers = api;
})(globalThis, function () {
  'use strict';
  const norm = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  function addressKey(row) {
    const parts = [row?.address, row?.city, row?.state].map(norm);
    return parts.every(Boolean) ? JSON.stringify(parts) : null;
  }
  function identity(draft) {
    const row = draft?.model?.values, address = addressKey(row);
    if (!address || row.tenancy !== 'MT') return null;
    const source = draft.source;
    const sourceAddress = addressKey({address:source?.street,city:source?.city,state:source?.state});
    let costarId = sourceAddress === address ? String(source?.costarId || '') : '';
    if (!/^\d+$/.test(costarId)) costarId = row.internal_notes?.match(/\bCoStar ID:\s*(\d+)\b/)?.[1] || '';
    if (!costarId && draft.flyerBuilding?.address === address) costarId = draft.flyerBuilding.costarId || '';
    return {address,costarId,key:JSON.stringify([address,costarId])};
  }
  function usableUrl(value) {
    try { const u = new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password; }
    catch { return false; }
  }
  function mode(draft, defaults) {
    if (draft.flyerMode) return draft.flyerMode;
    const key = identity(draft)?.key;
    const url = draft.model.values.flyer_url;
    if (key && defaults[key]?.url === url && usableUrl(url)) return 'building';
    return key && draft.model.isNew && !url ? 'building' : 'space';
  }
  function inherit(draft, defaults) {
    const id = identity(draft), row = draft.model.values;
    // A local address change must not carry an automatically inherited flyer
    // onto a different building. Explicitly selected suite flyers are preserved.
    if (draft.model.isNew && draft.flyerInherited && draft.flyerInherited.key !== id?.key) {
      if (row.flyer_url === draft.flyerInherited.url) row.flyer_url = null;
      delete draft.flyerInherited;
    }
    const entry = id && defaults[id.key];
    if (!draft.model.isNew || mode(draft, defaults) !== 'building' || row.flyer_url || !usableUrl(entry?.url)) return false;
    row.flyer_url = entry.url; draft.flyerMode = 'building';
    draft.flyerInherited = {key:id.key,url:entry.url};
    return true;
  }
  function remember(draft, defaults, url, name = 'Building flyer') {
    const id = identity(draft);
    if (!id || !usableUrl(url)) return false;
    defaults[id.key] = {...id,url,name};
    draft.flyerMode = 'building'; draft.flyerInherited = {key:id.key,url};
    return true;
  }
  function candidates(draft, rows) {
    const id = identity(draft); if (!id) return [];
    const seen = new Set();
    return rows.filter(row => {
      if (addressKey(row) !== id.address || !usableUrl(row.flyer_url) || seen.has(row.flyer_url)) return false;
      const otherId = row.internal_notes?.match(/\bCoStar ID:\s*(\d+)\b/)?.[1] || '';
      if (id.costarId && otherId && id.costarId !== otherId) return false;
      seen.add(row.flyer_url); return true;
    }).map(row => ({url:row.flyer_url,label:row.suite_number ? `Flyer from ${row.suite_number}` : 'Saved property flyer'}));
  }
  return {addressKey,identity,usableUrl,mode,inherit,remember,candidates};
});
