// Smoke-test MV3 in a disposable profile. Never touches an installed profile.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const extension = path.resolve(process.env.EXTENSION_ROOT || path.join(__dirname,'..'));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(),'survey-extension-test-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, { headless:true,
      ...(process.env.EXTENSION_CHROMIUM_PATH ? {executablePath:process.env.EXTENSION_CHROMIUM_PATH} : {channel:'chromium'}),
      args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`] });
    const blocked=[]; await context.route(/^https?:/,async route=>{blocked.push(route.request().url());await route.abort();});
    const worker=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id=new URL(worker.url()).host;
    const manifest=await worker.evaluate(()=>chrome.runtime.getManifest());
    assert.equal(manifest.manifest_version,3); assert.equal(manifest.version,'1.4.7');
    assert.equal(await worker.evaluate(()=>typeof SurveyFields.serializeDraft),'function');
    assert.equal(await worker.evaluate(()=>typeof SurveyRent.calculateSurveyRent),'function');
    assert.equal(await worker.evaluate(()=>typeof SurveySpaces.createBatchRequest),'function');
    const page=await context.newPage(), errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`chrome-extension://${id}/panel.html`);
    await page.locator('#screen-auth-email:not(.hidden)').waitFor();
    assert.equal(await page.evaluate(()=>IS_EXTENSION_CONTEXT),true);
    assert.equal(await page.evaluate(()=>typeof SurveyRent.calculateSurveyRent),'function');
    const status=await page.evaluate(()=>new Promise(resolve=>chrome.runtime.sendMessage({type:'AUTH_STATUS'},resolve)));
    assert.equal(status.ok,true);assert.equal(status.connected,false);
    assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
    console.log(JSON.stringify({result:'passed',manifestVersion:manifest.version,scope:'Fresh isolated Chrome for Testing profile, actual MV3 service worker and panel, local auth status, all bundled modules; zero remote requests'},null,2));
  } finally { if(context)await context.close();fs.rmSync(profile,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exitCode=1;});
