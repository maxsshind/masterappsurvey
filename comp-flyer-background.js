/* Read-only AI review; user authentication stays in the worker. */
let compFlyerAnalysisRunning = false;
async function analyzeCompFlyerDraft(draft) {
  if (compFlyerAnalysisRunning) throw new Error('A flyer is already being analyzed. Wait for it to finish.');
  compFlyerAnalysisRunning = true;
  try {
    const session = await sbGetSession();
    const response = await fetch(`${CONFIG.APP_URL}/api/extension/flyer-analysis`, {
      method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
      body:JSON.stringify(draft),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(75000),
    });
    if (response.status === 401) { const error=new Error('Sign in to the extension again to analyze this flyer.');error.code='AUTH_REQUIRED';throw error; }
    const result=await response.json().catch(()=>null);
    if (!response.ok) throw new Error(result?.error || `Flyer analysis is unavailable (${response.status}). Try again.`);
    if(!result || !Array.isArray(result.suggestions)||!Array.isArray(result.warnings))throw new Error('Flyer analysis returned an incomplete response. Try again.');
    return result;
  } finally {compFlyerAnalysisRunning=false;}
}
