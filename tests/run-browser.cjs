// Runs real control fixtures in a fresh disposable Chromium profile.
// PLAYWRIGHT_MODULE may point to the host's bundled dependency; no npm install needed.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}) });
  try {
    const page = await browser.newPage();
    for (const file of process.argv.slice(2)) {
      const source = fs.readFileSync(path.resolve(file),'utf8').replaceAll('127.0.0.1:8783','127.0.0.1:8898').replaceAll('127.0.0.1:8898',`127.0.0.1:${process.env.SURVEY_TEST_PORT || '8898'}`);
      const run = new Function(`return (${source})`)();
      console.log(JSON.stringify({file,result:await run(page)},null,2));
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
