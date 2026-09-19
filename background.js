/**
 * background.js — Service Worker (CoStar → Survey Pusher)
 *
 * Handles:
 *  1. Supabase email-OTP auth (see supabase.js) — session in chrome.storage.local,
 *     refreshed lazily so MV3 worker suspension is harmless.
 *  2. Supabase PostgREST: surveys + survey_properties (same tables the master-app
 *     web UI writes to — zero server-side changes needed).
 *  3. CoStar read: ONE on-demand DOM read of the active CoStar tab, only when the
 *     user clicks / navigates or reviews spaces in the open Survey panel.
 *     No automated navigation, no CoStar APIs, no crawling.
 */

importScripts("config.js", "supabase.js", "survey-fields.js", "survey-rent.js", "survey-spaces.js", "comp-flyer-background.js");

// ─── CoStar read (on-demand, single DOM read of the active CoStar tab) ───────────

async function readCoStar(options = {}) {
  // Prefer the tab the user is actually looking at; fall back to the most-recent
  // CoStar tab only if the active tab isn't CoStar.
  const isCostar = (t) => t && /^https:\/\/[^/]*costar\.com\//.test(t.url || "");
  let tab = (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!isCostar(tab) && options.tabId != null) {
    try { tab = await chrome.tabs.get(options.tabId); } catch { tab = null; }
    if (!isCostar(tab)) throw new Error("The source CoStar tab is closed. Select the intended CoStar tab and refresh.");
  }
  if (!isCostar(tab)) {
    const costarTabs = await chrome.tabs.query({ url: "https://*.costar.com/*" });
    if (!costarTabs || costarTabs.length === 0) {
      throw new Error("No CoStar tab found. Open the CoStar property's Summary page first.");
    }
    if (options.survey && costarTabs.length !== 1) throw new Error("More than one CoStar tab is open. Select the intended tab and refresh.");
    tab = costarTabs.sort((a,b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  }

  // CoStar property ID comes straight from the URL — no scraping needed.
  const idMatch = (tab.url || "").match(/\/detail\/[^/]+\/(\d+)/);
  const costarId = idMatch ? idMatch[1] : "";

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    // This function runs IN the CoStar tab. It reads ONLY the already-rendered
    // text the user is looking at — no network calls, no navigation.
    args: [Boolean((tab.url || "").match(/\/listings\/for-sale\/detail\//))],
    func: (isSalesListing = false) => {
      const txt = document.body.innerText || "";
      const lines = txt.split(/\n/).map((s) => s.trim()).filter(Boolean);

      // ---- city / state / zip : "Phoenix, AZ 85040" (prefer a clean standalone line) ----
      let city = "", state = "", zip = "", cszIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?$/);
        if (m) { city = m[1].trim(); state = m[2]; zip = m[3]; cszIdx = i; break; }
      }
      if (cszIdx === -1) {
        const m = txt.match(/([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?/);
        if (m) { city = m[1].trim(); state = m[2]; zip = m[3]; }
      }

      // ---- street: a line like "4821 S 33rd St" — prefer the one just above the city line ----
      let street = "";
      // CoStar headers can tack a name / note onto the address, e.g.
      // "4625 E Cotton Center Blvd - Cotton Flex Center (Multi-Property Sale)".
      // Strip the " - <name>" and " (<note>)" suffix so we keep just the street.
      // (Only splits on " - " with surrounding spaces, so ranges like "901-909 S X" survive.)
      const cleanStreet = (s) =>
        s.replace(/\s+[-–]\s+.*$/, "").replace(/\s*\(.*$/, "").trim();
      const looksStreet = (s) =>
        // allow ranges like "901-909 S Hohokam Dr" and 5-digit street numbers like "23320 N 18th Dr"
        /^\d{1,6}(?:-\d{1,5})?\s+[A-Za-z]/.test(s) && s.length < 60 &&
        !/\bof\s+\d/i.test(s) &&          // reject "23 of 36 Records" pagination
        // reject stat lines like "966 days", "2014 Built", "11,533 SF", "0.7 AC"
        !/^\d[\d,.]*\s+(?:days?|months?|years?|built|sf|ac|acres?|stories|story|spaces?|psf)\b/i.test(s) &&
        !/submarket|record|\bSF\b|\bRBA\b/i.test(s);
      if (cszIdx > 0) {
        for (let j = cszIdx - 1; j >= 0 && j >= cszIdx - 6; j--) {
          const cand = cleanStreet(lines[j]);
          if (looksStreet(cand)) { street = cand; break; }
        }
      }
      if (!street) {
        for (const l of lines) { const c = cleanStreet(l); if (looksStreet(c)) { street = c; break; } }
      }

      // ---- submarket : "... - S Airport N of Roeser Submarket" ----
      let submarket = "";
      const sm = txt.match(/[-–]\s*([A-Za-z0-9/&'’ .]+?)\s+Submarket/);
      if (sm) submarket = sm[1].trim();
      if (!submarket) {
        const header = txt.match(/(?:^|[\n•･·])\s*([A-Za-z0-9/&'’ .-]+?)[ \t]+Submarket(?=\s*(?:[\n•･·]|$))/m);
        const location = txt.match(/^Submarket[ \t]*(?:\n|\t)[ \t]*([^\n\t]+)/m) || txt.match(/\bSubmarket\s+(.+?)\s+Submarket Cluster\b/);
        submarket = (header?.[1] || location?.[1] || '').trim();
      }

      // ---- numeric stats : value appears just before its label ----
      // value BEFORE the label — property pages: "18,885\nSF RBA", "0.7\nAC Lot"
      const grab = (label) => {
        const m = txt.match(new RegExp("([\\d,.]+)\\s*\\n?\\s*" + label, "i"));
        return m ? m[1].replace(/,/g, "") : "";
      };
      // value AFTER the label — sale-comp pages: "Land Acres   1.40 AC", "RBA  21,000"
      const grabAfter = (label) => {
        const m = txt.match(new RegExp(label + "\\s*\\n?\\s*([\\d,.]+)", "i"));
        return m ? m[1].replace(/,/g, "") : "";
      };
      const rba = grab("SF RBA") || grab("RBA") || grabAfter("RBA") || (isSalesListing ? grabAfter("Building Size") : "");
      const acLot = grab("AC Lot") || grabAfter("Land Acres") || grabAfter("AC Lot");

      // ---- sale price : "For Sale  $5,400,000" (Sale section) or header "$5.4M Sale Price" ----
      let salePrice = "";
      const spSection = txt.match(/For Sale\s*\n?\s*\$([\d,]+)/i);
      if (spSection) salePrice = spSection[1].replace(/,/g, "");
      if (!salePrice) {
        const spHeader = txt.match(/\$\s*([\d.]+)\s*([MK]?)\s*\n?\s*Sale Price/i);
        if (spHeader) {
          let n = parseFloat(spHeader[1]);
          if (/M/i.test(spHeader[2])) n *= 1e6; else if (/K/i.test(spHeader[2])) n *= 1e3;
          if (!isNaN(n)) salePrice = String(Math.round(n));
        }
      }

      if (isSalesListing) {
        // Sales listing Summary and Property use different labeled sections.
        // Never take Transaction History/Sold Price, market averages, or loan amounts.
        const details = txt.match(/\bListing Details\b([\s\S]*?)(?=\b(?:Sale Notes|Marketing Brochure|Building Details|Transaction History)\b|$)/i)?.[1] || '';
        const availability = txt.match(/\bAvailabilities\b([\s\S]*?)(?=\b(?:Transaction History|Tenants|Market Conditions|Demographics)\b|$)/i)?.[1] || '';
        const asking = details.match(/\bAsking Price\s+([\s\S]*?)(?=\s+(?:Price\s*\/\s*SF|Sale Type|Time On Market|Status)\b|$)/i)?.[1];
        const offered = availability.match(/\bFor Sale\s*(?:[>›»]\s*)?Price\s+([\s\S]*?)(?=\s+(?:Sale Type|Status|For Lease)\b|$)/i)?.[1];
        const exactPrice = raw => {
          const text = String(raw || '').trim().replace(/^Individual Property\s*[•･·]\s*/i,'');
          const match = text.match(/^\$\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*([MK])?\s*(?:\(\$[\d,.]+\s*\/\s*SF\))?$/i);
          if (!match) return '';
          const value = Number(match[1].replaceAll(',','')) * (/m/i.test(match[2] || '') ? 1e6 : /k/i.test(match[2] || '') ? 1e3 : 1);
          return Number.isFinite(value) && value >= 0 ? String(value) : '';
        };
        const prices = [asking,offered].filter(value => value !== undefined).map(exactPrice);
        salePrice = prices.length && prices.every(value => value && value === prices[0]) ? prices[0] : '';
      }

      // ---- lease rate $/SF ----
      // Order matters: the header prints "Asking Industrial Rent" too, so match the
      // header's value-before-label form and the section's line-start "Rent" — never a
      // bare "Rent" (which also hits "Industrial Rent" and grabs the sale price beside it).
      let leaseRate = "";
      const lr = txt.match(/\$([\d.]+)\s*\n?\s*\/\s*\w+\s*\n?\s*Asking[\w ]*Rent/i) ||  // "$0.80 /NNN Asking … Rent"
                 txt.match(/(?:^|\n)Rent\s*\n?\s*\$([\d.]+)/i) ||                       // "Rent\n$0.80"
                 txt.match(/\$([\d.]+)\s*\n?\s*\/\s*(?:NNN|Gross|FSG|MG|IG)\b/i);        // "$0.80/NNN"
      if (lr) leaseRate = lr[1];

      // Additive Survey review evidence. Keep leaseRate unchanged for the separate
      // Comp intake. A detected amount is a suggestion, never an adopted quote.
      const quoteLineIndex = lines.findIndex((line) => /(?:asking.*rent|^rent\b)/i.test(line));
      const quoteWindow = quoteLineIndex >= 0 ? lines.slice(Math.max(0, quoteLineIndex - 2), quoteLineIndex + 4).join("\n") : "";
      const explicitQuote = (quoteWindow || txt).match(/\$\s*[\d,.]+(?:\s*[-–]\s*\$?\s*[\d,.]+)?\s*(?:\/\s*(?:sf|sq\.?\s*ft|ac|acres?|mo(?:nth)?|yr|year)\b|per\s+(?:sf|square\s+foot|acre|month|year)\b)[^\n]{0,160}/i);
      const quoteSnippet = quoteWindow || explicitQuote?.[0] || lr?.[0] || "";
      const annual = /annual|yearly|per[\s_-]*year|\/\s*(?:yr|year)|\bp\.?a\.?\b/i.test(quoteSnippet);
      const monthly = /monthly|per[\s_-]*month|\/\s*mo(?:nth)?\b/i.test(quoteSnippet);
      const perSF = /(?:\/\s*|per\s+)(?:sf\b|sq\.?\s*ft\b|square\s+foot\b)/i.test(quoteSnippet);
      const perAcre = /(?:\/\s*|per\s+)(?:ac\b|acres?\b)/i.test(quoteSnippet);
      const leaseQuote = {
        rawText: quoteSnippet.slice(0, 500),
        amountText: (quoteSnippet.match(/\$\s*([\d,.]+(?:\s*[-–]\s*\$?\s*[\d,.]+)?)/) || [])[1] || "",
        basis: perSF && !perAcre ? "sf" : perAcre && !perSF ? "acre" : /\btotal\b/i.test(quoteSnippet) ? "total" : "unknown",
        period: annual && !monthly ? "annual" : monthly && !annual ? "monthly" : "unknown",
        ranged: /\d\s*[-–]\s*\$?\s*\d/.test(quoteSnippet),
        gross: /\b(?:gross|fsg|mg|ig)\b/i.test(quoteSnippet),
        reviewed: false,
      };

      // ---- lease type : "Service Type  Triple Net" or "/NNN" ----
      let leaseType = "";
      const stM = txt.match(/Service Type\s*\n?\s*([A-Za-z ]+?)\s*(?:\n|CAM|$)/i);
      let ltRaw = stM ? stM[1].trim() : "";
      if (!ltRaw) { const nn = txt.match(/\/\s*(NNN|FSG|MG|IG)\b/); if (nn) ltRaw = nn[1]; }
      const ltLow = ltRaw.toLowerCase();
      if (/triple net|nnn/.test(ltLow)) leaseType = "NNN";
      else if (/full service/.test(ltLow)) leaseType = "Full Service Gross";
      else if (/industrial gross|(?:^|\b)ig\b/.test(ltLow)) leaseType = "Industrial Gross";
      else if (/modified|(?:^|\b)mg\b/.test(ltLow)) leaseType = "Modified Gross";
      leaseQuote.serviceType = ltRaw;
      leaseQuote.gross ||= /\b(?:gross|fsg|mg|ig)\b/i.test(ltRaw);

      // Survey-only selected offering: the open Space Details wins over the
      // property's asking/estimated-rent header. Never change Comp's leaseRate.
      const spaceHeadings = [...txt.matchAll(/\bSpace Details\b/gi)];
      let selectedSpace = null, selectedFactSection = null;
      if (spaceHeadings.length) {
        selectedFactSection = "";
        selectedSpace = { scope: "space-details", availableSf: null, availableRange: null, monthlyRent: null,
          rentPsf: null, officeSf: null, suite: null, floor: null, serviceType: null,
          identity: null, rawText: "", canPrefill: false, issue: null };
        if (spaceHeadings.length !== 1) {
          selectedSpace.issue = "Multiple Space Details sections are visible. Open one selected space.";
        } else {
          const start = spaceHeadings[0].index + spaceHeadings[0][0].length;
          const section = txt.slice(start).split(/\b(?:Documents|Space Notes|Highlights|Leasing Contacts)\b/i)[0].trim();
          selectedFactSection = section;
          selectedSpace.rawText = section.slice(0, 500);
          // Field labels can be separate lines or adjacent inline AX/DOM text.
          const labels = /\b(?:Floor Contig|Bldg Contig|Lease Status|Time on Market|Space Features|Rent\s*\/\s*(?:Month|Mo|Year|Yr)|Service Type|Services|Available(?=\s+(?:[\d$]|Withheld|Negotiable|Upon))|Office|Floor|Occupancy|Suite(?: Number)?|Rent|Type|Term|Docks|Drive Ins)\b/gi;
          const matches = [...section.matchAll(labels)];
          const fields = new Map();
          let duplicate = false;
          for (let i = 0; i < matches.length; i++) {
            const rawKey = matches[i][0].toLowerCase().replace(/\s+/g, "");
            const key = ({ "rent/month": "rent/mo", "rent/year": "rent/yr", servicetype: "services", suitenumber: "suite" })[rawKey] || rawKey;
            const value = section.slice(matches[i].index + matches[i][0].length, matches[i + 1]?.index ?? section.length).trim();
            if (fields.has(key)) duplicate = true;
            fields.set(key, value);
          }
          const numeric = "(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?";
          const exactNumber = (value, suffix = "") => {
            const match = (value || "").match(new RegExp("^\\$?\\s*(" + numeric + ")\\s*" + suffix + "$", "i"));
            return match && Number.isFinite(Number(match[1].replace(/,/g, ""))) ? match[1].replace(/,/g, "") : null;
          };
          selectedSpace.availableSf = exactNumber(fields.get("available"), "SF(?:\\s+(?:Industrial|Office|Retail|Warehouse|Flex|Space))?");
          // A range must belong to this one open Space Details section. Never
          // read a building's smallest-to-total availability or contiguous area.
          const availableRange = (fields.get("available") || "").match(new RegExp("^(" + numeric + ")\\s*[-–—]\\s*(" + numeric + ")\\s*SF(?:\\s+(?:Industrial|Office|Retail|Warehouse|Flex|Space))?(?:\\s*\\(Will Divide\\))?$", "i"));
          if (!duplicate && availableRange) {
            const min = Number(availableRange[1].replaceAll(",", "")), max = Number(availableRange[2].replaceAll(",", ""));
            if (Number.isSafeInteger(min) && Number.isSafeInteger(max) && min > 0 && min <= max)
              selectedSpace.availableRange = { min: String(min), max: String(max) };
          }
          selectedSpace.officeSf = exactNumber(fields.get("office"), "SF");
          selectedSpace.floor = fields.get("floor") || null;
          selectedSpace.suite = fields.get("suite") || fields.get("suitenumber") || null;
          selectedSpace.serviceType = fields.get("services") || fields.get("servicetype") || null;
          const monthlyRaw = fields.get("rent/mo") ?? fields.get("rent/month");
          const rateRaw = fields.get("rent");
          const monthly = exactNumber(monthlyRaw, "(?:/\\s*(?:mo(?:nth)?)|per\\s+month)?");
          const rate = exactNumber(rateRaw, "(?:/\\s*SF(?:\\s*/\\s*(?:mo(?:nth)?))?)?");
          const annual = fields.has("rent/year") || fields.has("rent/yr") || /annual|yearly|per\s+year|\/\s*(?:yr|year)\b/i.test([monthlyRaw, rateRaw].filter(Boolean).join(" "));
          const positiveArea = Number(selectedSpace.availableSf) > 0;
          const conflict = monthly !== null && rate !== null && positiveArea &&
            Math.abs(Number(monthly) - Number(rate) * Number(selectedSpace.availableSf)) > 0.011;
          if (duplicate) selectedSpace.issue = "Repeated space fields require review.";
          else if (selectedSpace.availableRange) selectedSpace.issue = "Choose the proposed SF and review pricing for this divisible suite.";
          else if (annual) selectedSpace.issue = "Annual or mixed-period rent requires monthly review.";
          else if (monthly === null) selectedSpace.issue = "An exact Rent/Mo amount is not available for this space.";
          else if (rateRaw && rate === null) selectedSpace.issue = "The selected space rent is ranged, withheld or unclear.";
          else if (conflict) selectedSpace.issue = "Rent/Mo and Rent × available SF disagree. Review the selected space.";
          else {
            selectedSpace.monthlyRent = monthly;
            selectedSpace.canPrefill = true;
            // Bare Rent gains monthly/SF meaning only through this cross-check.
            if (rate !== null && positiveArea) selectedSpace.rentPsf = rate;
          }
          const ordinal = [...txt.slice(0, start).matchAll(/\b\d+\s+of\s+\d+\s+Spaces\b/gi)].at(-1)?.[0] || "";
          selectedSpace.ordinal = ordinal;
          selectedSpace.identity = JSON.stringify([ordinal, selectedSpace.suite, selectedSpace.floor, selectedSpace.availableSf, ...(selectedSpace.availableRange ? [selectedSpace.availableRange] : [])]);
        }
        // Even an unresolved selected space must not inherit the header's quote.
        Object.assign(leaseQuote, {
          rawText: selectedSpace.rawText, amountText: selectedSpace.monthlyRent || "",
          basis: selectedSpace.canPrefill ? "total" : "unknown",
          period: selectedSpace.canPrefill ? "monthly" : "unknown",
          ranged: /\d\s*[-–]\s*\$?\s*\d/.test(selectedSpace.rawText),
          serviceType: selectedSpace.serviceType || "",
          gross: /\b(?:gross|fsg|mg|ig)\b/i.test(selectedSpace.serviceType || ""),
          reviewed: false,
        });
      }

      // ---- cap rate : "Cap Rate  6.50%" ----
      let capRate = "";
      const cr = txt.match(/Cap Rate\s*\n?\s*([\d.]+)\s*%/i);
      if (cr) capRate = cr[1];

      // ---- year built : a 4-digit year near a "Built" label ----
      let yearBuilt = "";
      const yb = txt.match(/Year Built\s*\n?\s*((?:19|20)\d{2})/i) ||   // "Year Built\n1998"
                 txt.match(/\b((?:19|20)\d{2})\s*\n?\s*(?:Year )?Built\b/i); // "1998 Built" / "1998 Year Built"
      if (yb) yearBuilt = yb[1];

      // ---- optional descriptive content: Sale Highlights / Sale Notes ----
      // These are returned separately and are NEVER saved automatically. The panel
      // asks the user which sections, if any, should be appended to comp notes.
      // Heading-only boundaries shared by both optional marketing sections.
      // Never prefix-match: "Building 100% air-conditioned" is a valid highlight.
      const marketingSectionStops = [
        "Sale Highlights", "Sale Notes", "Documents", "Sale Contacts", "Building",
        "Building Details", "For Lease", "Lease Highlights", "Lease Notes",
        "External Links", "Transaction History", "Property Mix", "Location",
        "Marketing Brochure", "Tenants", "Market Conditions", "Analytics",
        "Demographics", "Loan & Financials", "Loan and Financials", "Area", "Traffic",
        "Public Transportation", "Help with Features", "Request Training", "Share Feedback",
        "Terms of Use", "Description", "Property Description", "Listing Description",
        "Space Notes", "Highlights", "Leasing Contacts", "Listing Details", "Property", "Amenities",
      ];
      const sectionLines = (heading, sourceLines = lines) => {
        const headingKey = (line) => line.replace(/\s*>{1,2}\s*$/, "").replace(/:$/, "").trim().toLowerCase();
        const start = sourceLines.findIndex((line) => headingKey(line) === heading.toLowerCase());
        if (start < 0) return [];
        const stops = new Set(marketingSectionStops.map((line) => line.toLowerCase()));
        const out = [];
        for (let i = start + 1; i < sourceLines.length; i++) {
          if (stops.has(headingKey(sourceLines[i]))) break;
          out.push(sourceLines[i]);
        }
        return out;
      };
      const saleHighlightLines = sectionLines("Sale Highlights");
      const saleNoteLines = sectionLines("Sale Notes");
      const saleHighlights = saleHighlightLines
        .map((line) => line.replace(/^[•·▪◦*-]\s*/, "").trim())
        .filter(Boolean)
        .map((line) => `• ${line}`)
        .join("\n")
        .slice(0, 6000);
      const saleNotes = saleNoteLines
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 6000);

      // Optional facts are scoped to the selected space, or the Building table
      // when no selected-space modal is open. Never borrow loading/office totals
      // from an underlying building for a selected suite.
      const buildingFacts = txt.match(/(?:^|\n)Building(?: Details)?[ \t]*(?:\n|\t)([\s\S]*?)(?=\n(?:Amenities|Transportation|Availabilities|Transaction History|Space Details|Documents)\b|\nLocation[ \t]*\n(?=\s*(?:Submarket|Market|County)\b)|$)/i)?.[1] || '';
      const factLabels = /\b(?:Has Truckwell or Dock|Truck Wells|Clear Height|Office SF|Rail Served|Heavy Power|Has Rail|Rail Line|Rail Spots|Building Size|Typical Floor|Owner Occupier|CoStar Estimate|Opportunity Zone|Land Acres|Parking Ratio|Parking Spaces|Property Mix|Floor Contig|Bldg Contig|Lease Status|Time on Market|Space Features|Rent\s*\/\s*(?:Month|Mo|Year|Yr)|Service Type|Year Built|Drive Ins|Cross Docks|Sprinklers|Construction|Build-Out|Condition|Occupancy|Tenancy|Loading|Docks|Power|Office|Available|Suite(?: Number)?|Floor|Rent|Type|Term|Services|Stories|Columns|Elevators|Levelators|Levelers|Utilities|Pedestrian Friendly|Cycling Friendly|Car Friendly|Transit Friendly|Cranes|Class|RBA)\b/gi;
      // Max's source rule: exclude Property Mix completely. Its Office allocation
      // is neither an office measurement nor conflicting evidence to present.
      const mixStops = factLabels.source.replace('Office SF|','').replace('Office|','').replace('Property Mix|','');
      const factSection = (selectedFactSection === null ? buildingFacts : selectedFactSection).replace(new RegExp('\\bProperty Mix\\b[\\s\\S]*?(?='+mixStops+'|$)','gi'),'');
      const factMatches = [...factSection.matchAll(factLabels)], facts = new Map();
      for (let i=0;i<factMatches.length;i++) {
        const key=factMatches[i][0].toLowerCase().replace(/\s+/g,' ');
        const value=factSection.slice(factMatches[i].index+factMatches[i][0].length,factMatches[i+1]?.index??factSection.length).replace(/^\s*:\s*/,'').trim();
        facts.set(key,facts.has(key)?null:value);
      }
      const loadingParts=[['Loading','loading'],['Docks','docks'],['Truck wells','truck wells'],['Drive-ins','drive ins']].filter(([,key])=>facts.get(key)).map(([label,key])=>`${label}: ${facts.get(key)}`);
      const propertyFacts={scope:selectedFactSection===null?'building':'selected-space',
        clearHeight:facts.get('clear height')||'',officeSf:facts.get('office sf')||facts.get('office')||'',
        loading:loadingParts.join('; '),docks:facts.get('docks')||'',truckWells:facts.get('truck wells')||'',
        power:'',powerSource:'',powerFallback:(facts.get('power')||'').length<=4000?(facts.get('power')||''):'',railLine:facts.get('rail line')||'',
        heavyPower:facts.get('heavy power')||'',hasRail:facts.get('has rail')||facts.get('rail served')||'',
        hasTruckwellOrDock:facts.get('has truckwell or dock')||'',
        classA:/^A$/i.test(facts.get('class')||'')?'Yes':/^[BC]$/i.test(facts.get('class')||'')?'No':''};

      // Only relevant marketing clauses may prefill Power. Preserve qualifiers,
      // ranges and thousands separators; never synthesize electrical specifications.
      const powerClauses = sourceLines => {
        const electrical = /\b(?:power|electrical|amperage|voltage)\b|\d\s*(?:amps?|amperes?|volts?|kva|kw|[av]|[- ]?phases?|ph|p)\b|\b(?:single|three)[- ]phase\b/i;
        const isElectrical = part => electrical.test(part
          .replace(/\bPower\s+(?:Road|Rd|Street|St|Drive|Dr|Avenue|Ave|Blvd|Boulevard|Lane|Ln|Court|Ct|Way|Parkway|Pkwy)\b/gi,'')
          .replace(/\b(?:Suite|Unit|Building)\s*#?\s*[\w-]+\b/gi,''));
        const qualifier = /\b(?:not|unverified|verify|verification|confirm\w*|subject|per|shared|serv\w*|upgrad\w*|transformer\w*|panels?|capacity|includ\w*|exclud\w*|propos\w*|planned|future|estimat\w*|approx\w*|allocat\w*|currently|existing)\b|\d[- ]?wire\b/i;
        const unrelated = /\b(?:offices?|parking|truck court|loading|docks?|drive[- ]ins?|sprinklers|restrooms?|occupied|landscap\w*|roof|clear height)\b/i;
        const snippets = sourceLines.flatMap(line => line.replace(/^[•·▪◦*-]\s*/, '').split(/[.!?]\s+/).flatMap(sentence => {
          const parts = sentence.split(/\s*;\s*|,(?!\d{3}(?:\D|$))|\s+(?:and|with)\s+(?=(?:\d[\d,.]*\s*)?(?:drive[- ]ins?|docks?|sprinklers|clear height|parking|offices?|restrooms)\b)/i)
            .map(part => part.trim().replace(/[.;]$/, ''));
          const out = []; let group = [], hasPower = false;
          const flush = () => { if (hasPower) out.push(group.join(', ')); group = []; hasPower = false; };
          for (const part of parts) {
            const evidence = isElectrical(part);
            const qualification = /^(?:subject to|per\b|shared (?:between|with)|serv(?:es|ing)\b|not\b|unverified|verify)/i.test(part);
            if (evidence || (qualifier.test(part) && (!unrelated.test(part) || qualification))) { group.push(part); hasPower ||= evidence; }
            else flush();
          }
          flush(); return out;
        }));
        const value = [...new Set(snippets)].join(', ');
        return value.length <= 4000 ? value : '';
      };
      // Marketing text behind an open suite cannot establish that suite's power.
      const selectedLines = spaceHeadings.length === 1
        ? txt.slice(spaceHeadings[0].index).split(/\bLeasing Contacts\b/i)[0].split(/\n/).map(line=>line.trim()).filter(Boolean) : [];
      const marketingPowerSources = selectedFactSection === null
        ? [['Sale highlights', saleHighlightLines], ['Sale notes', saleNoteLines],
           ...['Description','Property Description','Listing Description'].map(heading=>[heading,sectionLines(heading)])]
        : [['Space highlights',sectionLines('Highlights',selectedLines)],['Space notes',sectionLines('Space Notes',selectedLines)]];
      for (const [source, content] of marketingPowerSources) {
        const power = powerClauses(content);
        if (power) { propertyFacts.power = power; propertyFacts.powerSource = source; break; }
      }

      if (selectedFactSection === null) {
        const officeAmounts = [...saleHighlights.matchAll(/(?:±\s*)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:SF|sq\.?\s*ft\.?|square feet)\s+(?:of\s+)?office\b/gi)]
          .filter(match=>!/(?:[\d,.\-–—]|\bto|\bthrough|\bbetween)\s*$/i.test(saleHighlights.slice(0,match.index)))
          .map(match=>Number(match[1].replaceAll(',','')));
        const uniqueOffice = [...new Set(officeAmounts)];
        if (uniqueOffice.length === 1 && !propertyFacts.officeSf) {
          propertyFacts.officeSf = String(uniqueOffice[0]); propertyFacts.officeSource = 'Sale highlights';
        } else if (uniqueOffice.length > 1 && !propertyFacts.officeSf) {
          propertyFacts.officeReview = 'Sale highlights list multiple office sizes; confirm the offered office area.';
        }
      }

      // Diagnostic: sample of the text actually seen, so we can tell whether the
      // scraper hit the right frame/tab when a scrape comes back empty.
      const _debug = { textLen: txt.length, sample: txt.slice(0, 400) };
      return {
        street, city, state, zip, submarket, rba, acLot, salePrice, leaseRate,
        leaseType, leaseQuote, selectedSpace, propertyFacts, capRate, yearBuilt, saleHighlights, saleNotes, _debug,
      };
    },
  });

  const data = results[0]?.result || {};
  data.costarId = costarId;
  data.listingId = (tab.url || "").match(/\/listings\/(for-sale|for-lease)\/detail\/([^/]+)/)?.slice(1).join(":") || "";
  data.sourceUrl = tab.url;
  data.scrapedTabUrl = tab.url;
  data.sourceTabId = tab.id;
  if (data.leaseQuote) data.leaseQuote.sourceUrl = tab.url;
  return data;
}

// ─── Surveys ───────────────────────────────────────────────────────────────────

const SURVEY_COLS = "id,name,client_name,survey_type,created_at,updated_at";

function listSurveys() {
  return sbSelect("surveys", `select=${SURVEY_COLS}&order=updated_at.desc&limit=50`);
}

function getSurvey(id) {
  return sbSelect("surveys", `select=${SURVEY_COLS}&id=eq.${encodeURIComponent(id)}`)
    .then((rows) => rows[0] || null);
}

function createSurvey({ name, client_name, survey_type }) {
  // Mirrors the web app's insert (useSurveys.ts createSurvey): created_by and
  // share_token are left to the DB, is_public defaults false.
  return sbInsert("surveys", {
    name,
    client_name: client_name || "",
    survey_type: survey_type || "lease",
    description: null,
    is_public: false,
    hidden_fields: [],
  });
}

// ─── Flyer capture: grab the open CoStar PDF → upload to survey-files bucket ──────

async function findFlyerTab() {
  const tabs = await chrome.tabs.query({});
  const cands = tabs.filter((t) => t.url && (
    /csgpimgs\.com/i.test(t.url) ||
    /\.pdf(\?|$)/i.test(t.url) ||
    /\.pdf/i.test(t.title || "")
  ));
  if (!cands.length) return null;
  return cands.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
}

// Download the open CoStar flyer PDF → { blob, name }. Shared by survey + comp flyers.
async function downloadOpenFlyer() {
  const tab = await findFlyerTab();
  if (!tab) {
    throw new Error("No open flyer PDF found. In CoStar, click the flyer/brochure so its PDF opens in a tab, then try again.");
  }
  // Signed CDN URL; include credentials in case it needs the CoStar session.
  const resp = await fetch(tab.url, { credentials: "include" });
  if (!resp.ok) throw new Error(`Couldn't download the flyer (${resp.status}). Make sure the PDF tab is fully loaded.`);
  const blob = await resp.blob();

  let name = "flyer.pdf";
  try { name = decodeURIComponent((new URL(tab.url).pathname.split("/").pop()) || name); } catch { /* keep default */ }
  if (!/\.pdf$/i.test(name)) name += ".pdf";
  return { blob, name };
}

// Upload a blob to the survey-files storage bucket at `path` → public URL.
async function uploadToSurveyFiles(path, blob) {
  const session = await sbGetSession();
  const up = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/survey-files/${path}`, {
    method: "POST",
    headers: {
      apikey: CONFIG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": blob.type || "application/pdf",
      "x-upsert": "true",
    },
    body: blob,
  });
  if (!up.ok) {
    const t = await up.text().catch(() => "");
    throw new Error(`Upload failed: ${t.slice(0, 160) || up.status}`);
  }
  return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/survey-files/${path}`;
}

async function attachFlyer(surveyId) {
  const { blob, name } = await downloadOpenFlyer();
  const safe = name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const url = await uploadToSurveyFiles(`flyers/${surveyId}/${Date.now()}_${safe}`, blob);
  return { url, name };
}

async function attachCompFlyer() {
  const { blob, name } = await downloadOpenFlyer();
  const safe = name.replace(/[^a-zA-Z0-9.-]/g, "_");
  const url = await uploadToSurveyFiles(`comps/flyers/${Date.now()}_${safe}`, blob);
  return { url, name };
}

function listSurveyProperties(surveyId) {
  return sbListAllSurveyProperties(surveyId);
}

// ─── Survey reviewed-request transport ────────────────────────────────────────
// Durable exact requests survive panel closure and worker suspension. The map
// only serializes messages in this worker; storage is the recovery authority.
const surveySavesInFlight = new Map();

async function surveySaveContext(surveyId, accountId) {
  const session = await sbGetSession();
  if (!session.user_id || (accountId && accountId !== session.user_id))
    throw authError("Sign in to the same account that owns this Survey draft.");
  if (!/^[0-9a-f-]{36}$/i.test(surveyId || "")) throw new Error("Choose a survey before saving.");
  return { accountId: session.user_id, key: `survey_pending_v1:${session.user_id}:${surveyId}` };
}

async function getSurveyPending(surveyId) {
  const context = await surveySaveContext(surveyId);
  return { pending: await sbStorageGet(context.key) };
}

async function surveyRecoverPending(context, pending) {
  if (!pending) return { status: "none", properties: [], pending: null };
  const request = pending.request;
  SurveySpaces.validateRequest(request);
  if (request.accountId !== context.accountId) throw authError("Sign in to the account that owns this draft.");
  const ids = request.kind === "insert" ? request.rows.map((row) => row.id) : [request.id];
  const result = SurveySpaces.classifyReadback(request, await sbReadSurveyIds(request.surveyId, ids));
  if (result.status === "saved") {
    await sbStorageRemove(context.key);
    return { ...result, pending: null };
  }
  // A newer timestamp on this exact update target makes the old CAS predicate
  // impossible. This permits a fresh review without replaying the stale patch.
  const canReviewCurrent = request.kind === "update" && result.status === "changed" &&
    !!result.current?.updated_at && result.current.updated_at !== request.baseline.updated_at;
  return { ...result, pending, canReviewCurrent };
}

async function recoverSurveySave(surveyId) {
  const context = await surveySaveContext(surveyId);
  return surveyRecoverPending(context, await sbStorageGet(context.key));
}

async function abandonSurveyPending(surveyId) {
  const context = await surveySaveContext(surveyId);
  if (surveySavesInFlight.has(context.key)) throw new Error("This save is still running. Verify it before changing the draft.");
  const pending = await sbStorageGet(context.key);
  const result = await surveyRecoverPending(context, pending);
  if (!result.pending) return result;
  if (result.status === "partial") throw new Error("Some spaces already exist. Reconcile this batch before clearing its pending save.");
  if (pending.phase === "prepared" || pending.saveRejected === true || result.canReviewCurrent) {
    await sbStorageRemove(context.key);
    return { ...result, pending: null };
  }
  const error = new Error("This save may still finish on the server. Keep the reviewed payload locked and retry or verify the same request.");
  error.pending = pending; error.status = result.status; throw error;
}

function validateSurveyRequestFields(request) {
  SurveySpaces.validateRequest(request);
  const writes = request.kind === "insert" ? request.rows : [request.patch];
  for (const write of writes) {
    const result = SurveyFields.validateSurveyWrite(write, request.kind === "update" ? request.baseline : undefined);
    if (!result.valid) throw new SurveySpaces.SurveySpaceConflictError(result.issues.map((issue) => issue.message).join(" "));
    if (!SurveySpaces.sameValue(write, result.values))
      throw new SurveySpaces.SurveySpaceConflictError("Review the numeric fields before saving. The request must contain validated numbers, not unparsed text.");
    const final = { ...(request.baseline || {}), ...write };
    const pricingFields = ["monthly_base_rent", "lease_rate_psf", "monthly_opex_psf", "total_monthly_opex", "total_lease_rate"];
    const coordinated = ["rent_calculation", "tenancy", "building_sf", "suite_size", "space_option", ...pricingFields].some((key) => Object.hasOwn(write, key));
    if (final.rent_calculation?.version === 1 && coordinated) {
      const expected = SurveyRent.calculateSurveyRent(final.rent_calculation, final, final);
      if (!Object.hasOwn(write, "rent_calculation") || pricingFields.some((key) => !Object.hasOwn(write, key) || !SurveySpaces.sameValue(write[key], expected[key])))
        throw new SurveySpaces.SurveySpaceConflictError("Linked pricing and area must be reviewed together. Reopen the draft and recalculate before saving.");
    }
  }
  if (request.kind === "insert") SurveySpaces.assertUniqueSpaces(request.rows);
}

async function saveSurveyRequest(request) {
  try { validateSurveyRequestFields(request); }
  catch (error) { error.saveRejected = true; throw error; }
  const context = await surveySaveContext(request.surveyId, request.accountId);
  const running = surveySavesInFlight.get(context.key);
  if (running) {
    if (SurveySpaces.sameValue(running.request, request)) return running.promise;
    throw new Error("Another save is running for this survey. Verify its outcome before saving a different draft.");
  }
  const operation = { request, promise: null };
  operation.promise = executeSurveyRequest(context, request);
  surveySavesInFlight.set(context.key, operation);
  try { return await operation.promise; }
  finally { surveySavesInFlight.delete(context.key); }
}

async function executeSurveyRequest(context, request) {
  let pending = await sbStorageGet(context.key);
  if (pending && !SurveySpaces.sameValue(pending.request, request)) {
    const error = new Error("A reviewed save is pending in this survey. Recover it before changing or saving another draft.");
    error.pending = pending; throw error;
  }
  if (!pending) {
    pending = { request, phase: "prepared" };
    try { await sbStorageSet(context.key, pending); }
    catch (error) { error.message = `Draft could not be protected locally; no write was attempted. ${error.message}`; error.saveRejected = true; error.pending = null; throw error; }
  }
  // A rejection of a retry says nothing about an earlier lost request that may
  // still be running. Only the first definitely rejected dispatch can unlock.
  const hadUncertainDispatch = pending.phase === "dispatched";
  try {
    const recovered = await surveyRecoverPending(context, pending);
    if (recovered.status === "saved") return recovered;
    if (["partial", "changed"].includes(recovered.status)) return recovered;

    const existing = await listSurveyProperties(request.surveyId); // failure is never an empty survey
    if (request.kind === "insert") {
      const latest = SurveySpaces.classifyReadback(request, existing);
      if (latest.status === "saved") return surveyRecoverPending(context, pending);
      if (latest.status === "partial") return { ...latest, pending };
      SurveySpaces.assertUniqueSpaces(request.rows, existing);
    }
    else {
      const current = existing.find((row) => row.id === request.id);
      if (!current || !SurveySpaces.sameValue(current, request.baseline))
        return { status: "changed", current: current || null, properties: current ? [current] : [], pending };
      if (["tenancy", "address", "city", "state", "suite_number"].some((key) => Object.hasOwn(request.patch, key)))
        SurveySpaces.assertUniqueSpaces([{ ...current, ...request.patch }], existing);
    }
    const dispatched = { request: pending.request, phase: "dispatched" };
    // A failure to store the dispatch state stops before the write as well.
    await sbStorageSet(context.key, dispatched);
    pending = dispatched;
    let writeError;
    try {
      if (request.kind === "insert") await sbInsertSurveyBatch(request.rows);
      else await sbUpdateSurveyScoped(request.surveyId, request.id, request.baseline.updated_at, request.patch);
    } catch (error) { writeError = error; }
    if (writeError?.surveyWriteRejected === true && !hadUncertainDispatch) {
      const rejected = { ...pending, phase: "rejected", saveRejected: true };
      await sbStorageSet(context.key, rejected);
      pending = rejected;
      throw writeError;
    }
    // Even a failed/lost write response may represent a committed statement.
    const verified = await surveyRecoverPending(context, pending);
    if (verified.status === "saved" || verified.status === "partial" || verified.status === "changed") return verified;
    if (writeError) { writeError.pending = pending; writeError.status = "none"; throw writeError; }
    return verified;
  } catch (error) {
    // Before first dispatch there is no uncertain write. Permit correcting the
    // retained UI draft. Once dispatched, only verified recovery can clear it.
    if (pending.phase === "prepared" || pending.saveRejected === true) {
      try { await sbStorageRemove(context.key); }
      catch (storageError) {
        storageError.pending = pending; storageError.saveRejected = true;
        storageError.message = `No write is pending, but its local recovery record could not be cleared. ${storageError.message}`;
        throw storageError;
      }
      error.saveRejected = true; error.pending = null;
    } else { error.pending = pending; error.saveRejected = false; }
    throw error;
  }
}

// ─── Comps (master-app `comps` table) ────────────────────────────────────────────

const COMP_COLS =
  "id,address,property_name,city,state,zip,status,property_type,sale_type,sale_price,price_psf," +
  "rent_psf,lease_format,cap_rate,building_sf,land_area,yard_included,sub_market,submarket_cluster," +
  "listing_brokerage,listing_agent,listing_agent_phone,listing_agent_email," +
  "last_verified_at,list_date,notes,flyer_url,property_id,suite,partial_site_override,multi_tenant," +
  "clear_height,clear_height_ft,office_sf,lease_area,year_built,loading,power,class_a,heavy_power,has_rail,has_truckwell_or_dock";

// Find existing comps that likely match the CoStar listing, so the panel can offer
// "update" instead of a duplicate insert. PostgREST ilike wildcard is a literal `*`
// (never percent-encoded); the user-supplied text is encoded, then the `*` re-added.
// sbSelect appends the query string raw, so spaces in a pattern must be %20.
async function searchComps({ streetNumber, streetToken, costarId, city, state }) {
  const byId = new Map();
  const scope = `${city ? `&city=ilike.${encodeURIComponent(city)}` : ""}${state ? `&state=ilike.${encodeURIComponent(state)}` : ""}`;

  // CoStar-ID matches first — most precise (we stamp "CoStar ID: <n>" into notes).
  if (costarId) {
    const pat = `*CoStar ID: ${encodeURIComponent(costarId)}*`.replace(/ /g, "%20");
    const rows = await sbSelect("comps", `select=${COMP_COLS}&notes=ilike.${pat}${scope}&limit=5`);
    for (const r of rows) byId.set(r.id, r);
  }

  // Then street-number prefix (e.g. "4645*" → "4645 S 35th Ave").
  if (streetNumber) {
    const rows = await sbSelect(
      "comps",
      `select=${COMP_COLS}&address=ilike.${encodeURIComponent(streetNumber)}*${scope}&limit=20`
    );
    for (const r of rows) if (!byId.has(r.id)) byId.set(r.id, r);
  }

  return Array.from(byId.values()).slice(0, 20);
}

async function saveCompWithProperty(request) {
  if (!request || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.p_request_id || "")) {
    const error = new Error("Save request is missing its retry ID. Reopen the extension.");
    error.saveRejected = true;
    throw error;
  }
  return sbRpc("save_comp_with_property", request);
}

// ─── Side panel: open on toolbar-icon click ──────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ─── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const reply = async (promise) => {
    try {
      sendResponse({ ok: true, ...await promise });
    } catch (e) {
      const surveySaveMessage = ["SAVE_SURVEY_BATCH", "SAVE_SURVEY_UPDATE", "RECOVER_SURVEY_SAVE", "ABANDON_SURVEY_PENDING"].includes(msg.type);
      sendResponse({ ok: false, error: e.message, authRequired: e.code === "AUTH_REQUIRED", saveRejected: e.saveRejected === true || (!surveySaveMessage && e.code === "AUTH_REQUIRED" && !e.pending),
        ...(Object.hasOwn(e, "pending") ? { pending: e.pending } : {}),
        ...(e.status ? { status: e.status } : {}), ...(e.current ? { current: e.current } : {}) });
    }
  };

  switch (msg.type) {
    case "AUTH_STATUS":
      // Reports whether a session is stored; expiry is handled lazily on first use.
      reply(sbGetStored().then((s) => ({ connected: !!(s && s.refresh_token), email: s ? s.email : null, accountId: s?.user_id || null })));
      return true;

    case "AUTH_SEND_OTP":
      reply(sbSendOtp(msg.email).then(() => ({})));
      return true;

    case "AUTH_VERIFY_OTP":
      reply(sbVerifyOtp(msg.email, msg.token).then((s) => ({ email: s.email, accountId: s.user_id })));
      return true;

    case "AUTH_VERIFY_LINK":
      reply(sbVerifyLink(msg.link).then((s) => ({ email: s.email, accountId: s.user_id })));
      return true;

    case "AUTH_SIGN_OUT":
      reply(sbClear().then(() => ({})));
      return true;

    case "READ_COSTAR":
      reply(readCoStar({tabId: msg.tabId, survey:msg.survey === true}).then((data) => ({ data })));
      return true;

    case "LIST_SURVEYS":
      reply(listSurveys().then((surveys) => ({ surveys })));
      return true;

    case "GET_SURVEY":
      reply(getSurvey(msg.id).then((survey) => ({ survey })));
      return true;

    case "CREATE_SURVEY":
      reply(createSurvey(msg.fields || {}).then((survey) => ({ survey })));
      return true;

    case "ATTACH_FLYER":
      reply(attachFlyer(msg.surveyId).then((r) => r));
      return true;

    case "LIST_SURVEY_PROPERTIES":
      reply(listSurveyProperties(msg.surveyId).then((properties) => ({ properties })));
      return true;

    case "GET_SURVEY_PENDING":
      reply(getSurveyPending(msg.surveyId));
      return true;

    case "RECOVER_SURVEY_SAVE":
      reply(recoverSurveySave(msg.surveyId));
      return true;

    case "ABANDON_SURVEY_PENDING":
      reply(abandonSurveyPending(msg.surveyId));
      return true;

    case "SAVE_SURVEY_BATCH":
    case "SAVE_SURVEY_UPDATE":
      reply(saveSurveyRequest(msg.request));
      return true;

    case "SEARCH_COMPS":
      reply(searchComps({
        streetNumber: msg.streetNumber || "",
        streetToken: msg.streetToken || "",
        costarId: msg.costarId || "",
        city: msg.city || "",
        state: msg.state || "",
      }).then((comps) => ({ comps })));
      return true;

    case "SAVE_COMP":
      reply(saveCompWithProperty(msg.request));
      return true;

    case "ANALYZE_COMP_FLYER":
      reply(analyzeCompFlyerDraft(msg.draft));
      return true;

    case "ATTACH_COMP_FLYER":
      reply(attachCompFlyer().then((r) => r));
      return true;

    default:
      sendResponse({ ok: false, error: "Unknown message type: " + msg.type });
      return false;
  }
});
