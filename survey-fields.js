/* Survey form contracts ported from Master App dc082c935668da0b7bb8e4c8ad403e7f15a4a120.
 * Sources: src/lib/numeric-fields.ts, src/lib/surveys/numeric-fields.ts,
 * src/lib/types.ts. This bundle is local-only and has no DOM/Chrome dependencies.
 * Load this before survey-rent.js in browser/service-worker contexts.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SurveyFields = api;
})(globalThis, function (root) {
  'use strict';

  const SURVEY_NUMERIC_OPTIONS = {
    building_sf: { label: 'Total Building SF', integer: true },
    office_sf: { label: 'Office SF', integer: true },
    land_area_ac: { label: 'Land Area (AC)', maxDecimals: 4 },
    sale_price: { label: 'Sale Price ($)', maxDecimals: 2, allowCurrency: true },
    cap_rate: { label: 'Cap Rate (%)', max: 100, maxDecimals: 4, allowPercent: true },
    lease_rate_psf: { label: 'Monthly Base Rate ($/SF/month)', maxDecimals: 4, allowCurrency: true },
    monthly_base_rent: { label: 'Monthly Base Rent ($)', maxDecimals: 2, allowCurrency: true },
    monthly_opex_psf: { label: 'Monthly Opex ($/SF/month)', maxDecimals: 4, allowCurrency: true },
    total_monthly_opex: { label: 'Total Monthly Opex ($)', maxDecimals: 2, allowCurrency: true },
    total_lease_rate: { label: 'Total with Opex ($/month)', maxDecimals: 2, allowCurrency: true },
    num_private_offices: { label: 'Private Offices', integer: true, max: 2147483647 },
    latitude: { label: 'Latitude', min: -90, max: 90 },
    longitude: { label: 'Longitude', min: -180, max: 180 },
  };
  const SURVEY_RENT_FIELDS = ['lease_rate_psf', 'monthly_base_rent', 'monthly_opex_psf', 'total_monthly_opex', 'total_lease_rate'];
  const RENT_AREA_FIELDS = ['tenancy', 'building_sf', 'suite_size'];
  const SURVEY_AVAILABILITY_OPTIONS = ['Available', 'Confirmed', 'Confirming Availability', 'Not Available', 'Available/Interested'];
  const SURVEY_TENANCY_OPTIONS = ['ST', 'MT'];
  const SURVEY_LEASE_TYPES = ['Full Service Gross', 'Modified Gross', 'Industrial Gross', 'NNN'];
  const SURVEY_INTERNAL_STATUS_OPTIONS = ['Confirmed with broker', 'Waiting for response', 'Need to follow up', 'Not responsive'];
  const EXPENSE_TREATMENTS = ['additional', 'included', 'unknown'];
  // Deliberately excludes client feedback/votes/comments and server-maintained fields.
  const EDITABLE_FIELDS = [
    'address', 'city', 'state', 'zip', 'latitude', 'longitude',
    'tenancy', 'building_sf', 'land_area_ac', 'suite_number', 'suite_size', 'office_sf',
    'sale_price', 'cap_rate', 'zoning', 'lease_type', 'for_sale_or_lease',
    'availability', 'date_available', 'notes', 'notes_2', 'internal_notes', 'internal_status',
    'power', 'loading', 'clear_height', 'yard_area', 'flyer_url', 'photo_url', 'num_private_offices',
  ];
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const rentApi = () => root.SurveyRent || (typeof require === 'function' ? require('./survey-rent.js') : null);

  function decimalIdentity(text) {
    const negative = text.startsWith('-');
    const [mantissa, exponent] = text.replace(/^-/, '').toLowerCase().split('e');
    let digits = mantissa.replace('.', '').replace(/^0+/, '');
    if (!digits) return '0';
    let scale = Number(exponent ?? 0) - (mantissa.split('.')[1]?.length ?? 0);
    while (digits.endsWith('0')) { digits = digits.slice(0, -1); scale++; }
    return `${negative ? '-' : ''}${digits}e${scale}`;
  }

  /** Validate the entire quantity; never salvage numeric prefixes, prose or ranges. */
  function parseNumericInput(value, options = {}) {
    const label = options.label ?? 'Value';
    const fail = reason => ({ valid: false, value: null, error: `${label} ${reason}` });
    if (value == null || (typeof value === 'string' && !value.trim())) return { valid: true, value: null, error: null };
    if (typeof value !== 'number' && typeof value !== 'string') return fail('must be a number; leave unknown values blank.');
    let text = String(value).trim();
    if (typeof value === 'string') {
      if (options.allowCurrency) text = text.replace(/^\$\s*/, '');
      if (options.allowPercent) text = text.replace(/\s*%$/, '');
      if (!/^-?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/.test(text)) {
        return fail('must be one number, with optional thousands commas. Put ranges or explanations in Notes.');
      }
    }
    const amount = typeof value === 'number' ? value : Number(text.replaceAll(',', ''));
    if (!Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER) return fail('must be a finite number within the supported range.');
    if (typeof value === 'string' && decimalIdentity(text.replaceAll(',', '')) !== decimalIdentity(String(amount))) return fail('has more precision than can be stored safely.');
    if (amount < (options.min ?? 0)) return fail(`must be at least ${(options.min ?? 0).toLocaleString('en-US')}.`);
    if (options.max !== undefined && amount > options.max) return fail(`must be at most ${options.max.toLocaleString('en-US')}.`);
    if (options.integer && !Number.isInteger(amount)) return fail('must be a whole number.');
    if (options.maxDecimals !== undefined) {
      const [mantissa, exponent] = text.replaceAll(',', '').toLowerCase().split('e');
      const decimals = Math.max(0, (mantissa.split('.')[1]?.replace(/0+$/, '').length ?? 0) - Number(exponent ?? 0));
      if (decimals > options.maxDecimals) return fail(`must have no more than ${options.maxDecimals} decimal places.`);
    }
    return { valid: true, value: amount, error: null };
  }

  function numericInputError(value, options) { return parseNumericInput(value, options).error; }
  function numericDraft(value, options) {
    const result = parseNumericInput(value, options);
    if (!result.valid) return value;
    if (result.value === null) return '';
    return value.trim().replace(/^\$\s*/, '').replace(/\s*%$/, '').replaceAll(',', '');
  }
  function surveyNumericOptions(field, raw, previous) {
    const options = { ...SURVEY_NUMERIC_OPTIONS[field] };
    if (typeof previous === 'number' && String(raw) === String(previous)) {
      delete options.maxDecimals;
      if (field !== 'num_private_offices') delete options.integer;
    }
    return options;
  }
  function parseSurveyNumericFields(input, { previous, preserveNumericPrecision = false } = {}) {
    const values = {}, issues = [];
    for (const field of Object.keys(SURVEY_NUMERIC_OPTIONS)) {
      if (!own(input, field)) continue;
      const raw = input[field];
      const options = surveyNumericOptions(field, raw, previous?.[field]);
      if (preserveNumericPrecision && typeof raw === 'number') {
        delete options.maxDecimals;
        if (field !== 'num_private_offices') delete options.integer;
      }
      const result = parseNumericInput(raw, options);
      if (!result.valid) issues.push({ field, message: result.error || `${options.label} is invalid.` });
      else values[field] = result.value;
    }
    const building = 'building_sf' in input ? values.building_sf : previous?.building_sf;
    const office = 'office_sf' in input ? values.office_sf : previous?.office_sf;
    const sizeChanged = !previous || ['building_sf', 'office_sf'].some(field => field in input && String(input[field]) !== String(previous[field]));
    if (sizeChanged && typeof building === 'number' && typeof office === 'number' && office > building) {
      issues.push({ field: 'office_sf', message: 'Office SF cannot exceed Total Building SF.' });
    }
    return { valid: issues.length === 0, values, issues };
  }
  function normalizeSurveyNumericWrite(input, previous) {
    const result = parseSurveyNumericFields(input, { previous, preserveNumericPrecision: true });
    if (!result.valid) throw new Error(result.issues.map(issue => issue.message).join(' '));
    return { ...input, ...result.values };
  }

  /** JSON object order is immaterial; array order and null are meaningful. */
  function structuralEqual(left, right) {
    if (Object.is(left, right)) return true;
    if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
    if (Array.isArray(left) !== Array.isArray(right)) return false;
    const keys = Object.keys(left), other = Object.keys(right);
    return keys.length === other.length && keys.every(key => own(right, key) && structuralEqual(left[key], right[key]));
  }

  function hydrateDraft(row = {}, { isNew = false } = {}) {
    const rent = rentApi();
    const baseline = clone(row);
    const metadata = baseline.rent_calculation ?? null;
    const rentSupported = metadata === null || rent.validateRentCalculation(metadata) === null;
    return {
      baseline,
      values: clone(row),
      rentDraft: rentSupported ? rent.createSurveyRentDraft(metadata, isNew) : null,
      isNew,
      rentSupported,
      compatibilityMessage: rentSupported ? null : 'This saved pricing format is not supported by this extension. Pricing is preserved; review it in Master App.',
    };
  }

  /** Save boundary used by both mounted form serializers and the worker. */
  function validateSurveyWrite(input, previous, { preserveNumericPrecision = true } = {}) {
    const rent = rentApi();
    const parsed = parseSurveyNumericFields(input, { previous, preserveNumericPrecision });
    const values = { ...input, ...parsed.values };
    const issues = [...parsed.issues];
    const resulting = { ...(previous || {}), ...values };
    if ((!previous || own(input, 'address')) && (typeof resulting.address !== 'string' || !resulting.address.trim())) {
      issues.push({ field: 'address', message: 'Enter the property address.' });
    }
    if (own(input, 'yard_area') && input.yard_area !== null && typeof input.yard_area !== 'boolean') {
      issues.push({ field: 'yard_area', message: 'Choose Yes, No, or Unknown for yard area.' });
    }
    if (own(input, 'for_sale_or_lease') && input.for_sale_or_lease !== null && (!Array.isArray(input.for_sale_or_lease) || input.for_sale_or_lease.some(value => typeof value !== 'string'))) {
      issues.push({ field: 'for_sale_or_lease', message: 'Choose the property offering types.' });
    }
    const sizeChanged = !previous || ['tenancy', 'suite_size', 'office_sf'].some(field => own(input, field) && !structuralEqual(values[field], previous[field]));
    if (sizeChanged && resulting.tenancy === 'MT') {
      const area = rent.resolveSurveyRentArea(resulting);
      if (area !== null && typeof resulting.office_sf === 'number' && resulting.office_sf > area) {
        issues.push({ field: 'office_sf', message: 'Office SF cannot exceed Suite Size.' });
      }
    }
    if (own(input, 'rent_calculation') && input.rent_calculation !== null) {
      const error = rent.validateRentCalculation(input.rent_calculation);
      // Unknown saved metadata is opaque; an unrelated update must never rewrite it.
      if (error && (!previous || !structuralEqual(input.rent_calculation, previous.rent_calculation))) issues.push({ field: 'rent_calculation', message: error });
    }
    return { valid: issues.length === 0, values, issues };
  }

  /**
   * values contains raw control values keyed by real database field names.
   * rentDraft is owned by SurveyRent; it is the only source of linked pricing.
   * Existing rows emit a minimal patch, preserving untouched unsupported values.
   * New rows expose only writable form fields; identity belongs to batch transport.
   * No client feedback field can be emitted by this form serializer.
   */
  function serializeDraft(draft) {
    const rent = rentApi();
    const baseline = draft.baseline || {};
    const input = draft.values || {};
    const isNew = !!draft.isNew;
    const patch = {}, issues = [];
    for (const field of EDITABLE_FIELDS) {
      if (!own(input, field)) continue;
      const raw = input[field];
      if (!isNew && (structuralEqual(raw, baseline[field]) || (raw === '' && baseline[field] == null))) continue;
      let value = raw;
      if (own(SURVEY_NUMERIC_OPTIONS, field)) {
        const parsed = parseNumericInput(raw, surveyNumericOptions(field, raw, isNew ? undefined : baseline[field]));
        if (!parsed.valid) { issues.push({ field, message: parsed.error }); continue; }
        value = parsed.value;
      } else if (typeof raw === 'string' && !raw.trim()) value = null;
      if (!isNew && structuralEqual(value, baseline[field])) continue;
      patch[field] = clone(value);
    }
    const resulting = { ...baseline, ...patch };
    const metadata = baseline.rent_calculation ?? null;
    const supported = draft.rentSupported !== false && (metadata === null || rent.validateRentCalculation(metadata) === null);
    const areaChanged = RENT_AREA_FIELDS.some(field => own(patch, field));
    let pricingChanged = false;
    if (supported) {
      try {
        const current = rent.draftCalculation(draft.rentDraft ?? null, true);
        pricingChanged = !structuralEqual(current, metadata);
        if (isNew || pricingChanged || (areaChanged && metadata !== null)) {
          // Full coordinated outputs prevent the trigger's legacy-client detachment path.
          Object.assign(patch, rent.getSurveyRentWrite(draft.rentDraft ?? null, resulting, baseline));
        }
      } catch (error) {
        issues.push({ field: error.field || 'rent_calculation', message: error.message });
      }
    } else if (areaChanged || draft.rentDraft !== null) {
      issues.push({ field: 'rent_calculation', message: 'Saved pricing uses an unsupported format. Review pricing or area changes in Master App; other details can be edited here.' });
    }
    const validated = validateSurveyWrite(patch, isNew ? undefined : baseline);
    issues.push(...validated.issues);
    // New-row callers use values directly as the insert payload. A cloned saved
    // row must not leak identity, feedback, server timestamps or unknown columns.
    // Existing-row values remain a complete read model; only patch may be written.
    const values = isNew ? { ...validated.values } : { ...baseline, ...validated.values };
    return { valid: issues.length === 0, values, patch: validated.values, issues, pricingChanged, areaChanged };
  }

  return {
    SURVEY_NUMERIC_OPTIONS, SURVEY_RENT_FIELDS, RENT_AREA_FIELDS, EDITABLE_FIELDS,
    SURVEY_AVAILABILITY_OPTIONS, SURVEY_TENANCY_OPTIONS, SURVEY_LEASE_TYPES,
    SURVEY_INTERNAL_STATUS_OPTIONS, EXPENSE_TREATMENTS,
    parseNumericInput, numericInputError, numericDraft, surveyNumericOptions,
    parseSurveyNumericFields, normalizeSurveyNumericWrite, structuralEqual, clone,
    hydrateDraft, serializeDraft, validateSurveyWrite,
  };
});
