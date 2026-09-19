/* Monthly Survey calculator ported from Master App dc082c935668da0b7bb8e4c8ad403e7f15a4a120.
 * Sources: src/lib/survey-rent.ts, SurveyRentFields.tsx and parseSuiteArea from
 * src/lib/comp-intake.ts. Exact decimal arithmetic matches the existing DB trigger.
 * Browser load order: survey-fields.js, then this file. No remote runtime imports.
 */
(function (root, factory) {
  const fields = root.SurveyFields || (typeof require === 'function' ? require('./survey-fields.js') : null);
  const api = factory(fields);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SurveyRent = api;
})(globalThis, function (fields) {
  'use strict';
  if (!fields) throw new Error('Load survey-fields.js before survey-rent.js.');
  const { parseNumericInput, clone } = fields;
  const MONEY_OPTIONS = { label: 'Monthly amount', allowCurrency: true, maxDecimals: 2 };
  const RATE_OPTIONS = { label: 'Monthly rate', allowCurrency: true, maxDecimals: 4 };
  const ACRE_OPTIONS = { label: 'Acres included in this lease', maxDecimals: 4 };

  // Persisted numeric JSON may serialize tiny sources using e-notation. Entry
  // strings deliberately reject that syntax; expand saved values losslessly.
  function decimalInputString(value) {
    if (value == null) return '';
    const text = String(value);
    if (!/[eE]/.test(text)) return text;
    const [coefficient, exponent] = text.toLowerCase().split('e');
    const sign = coefficient.startsWith('-') ? '-' : '';
    const unsigned = coefficient.replace(/^-/, '');
    const point = (unsigned.split('.')[0].length) + Number(exponent);
    const digits = unsigned.replace('.', '');
    if (point <= 0) return sign + '0.' + '0'.repeat(-point) + digits;
    if (point >= digits.length) return sign + digits + '0'.repeat(point - digits.length);
    return sign + digits.slice(0, point) + '.' + digits.slice(point);
  }

  function nonnegative(value) {
    if (typeof value !== 'number') return null;
    const parsed = parseNumericInput(value);
    return parsed.valid ? parsed.value : null;
  }
  function positive(value) { const number = nonnegative(value); return number !== null && number > 0 ? number : null; }
  function parseSuiteArea(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const match = value.trim().match(/^(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:sf|sq\.?\s*ft\.?|square feet)?$/i);
    if (!match) return null;
    const result = parseNumericInput(match[1], { allowCurrency: true });
    const amount = result.valid && result.value !== null && result.value > 0 ? result.value : null;
    return amount === null ? null : amount * (match[2] ? 1000 : 1);
  }
  function resolveSurveyRentArea(area) {
    const option = area.space_option;
    if (option != null) {
      if (!["fixed", "range", "combined"].includes(option.kind) || option.review) return null;
      if (option.kind === "range") {
        const min = parseNumericInput(option.min, { integer: true, min: 1 });
        const max = parseNumericInput(option.max, { integer: true, min: 1 });
        const proposed = parseNumericInput(option.proposed, { integer: true, min: 1 });
        return min.valid && max.valid && proposed.valid && proposed.value !== null && min.value !== null && max.value !== null && proposed.value >= min.value && proposed.value <= max.value ? proposed.value : null;
      }
      // Explicit offering metadata always uses the offered area, including ST.
      return positive(parseSuiteArea(area.suite_size));
    }
    if (area.tenancy === 'ST') return positive(area.building_sf);
    if (area.tenancy === 'MT' || area.tenancy == null || area.tenancy === '') {
      if (typeof area.suite_size !== 'string' || positive(parseSuiteArea(area.suite_size)) === null) return null;
      const quantity = area.suite_size.trim().match(/^([\d,.]+)\s*(k)?/i);
      return positive(Number(`${quantity[1].replaceAll(',', '')}e${quantity[2] ? 3 : 0}`));
    }
    return null;
  }
  const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value);
  function amountError(value, label) { return value === null ? null : nonnegative(value) === null ? `${label} must be a nonnegative, finite number or blank.` : null; }
  function validateRentCalculation(calculation) {
    if (!isRecord(calculation) || calculation.version !== 1) return 'Rent calculation format is not supported.';
    const acresError = amountError(calculation.offered_acres, 'Offered acres');
    if (acresError) return acresError;
    if (calculation.rent !== null) {
      if (!isRecord(calculation.rent) || typeof calculation.rent.basis !== 'string' || !['total', 'sf', 'acre'].includes(calculation.rent.basis)) return 'Choose monthly total, per SF, or per acre for base rent.';
      const error = amountError(calculation.rent.amount, 'Base rent');
      if (error) return error;
    }
    if (calculation.expenses !== null) {
      if (!isRecord(calculation.expenses) || typeof calculation.expenses.basis !== 'string' || !['total', 'sf'].includes(calculation.expenses.basis)) return 'Choose monthly total or per SF for additional expenses.';
      if (typeof calculation.expenses.treatment !== 'string' || !['additional', 'included', 'unknown'].includes(calculation.expenses.treatment)) return 'Choose how additional expenses are charged.';
      const error = amountError(calculation.expenses.amount, 'Additional expenses');
      if (error) return error;
    }
    return null;
  }

  function decimal(value) {
    const [coefficient, exponent = '0'] = String(value).split('e');
    const scale = (coefficient.split('.')[1]?.length ?? 0) - Number(exponent);
    const digits = BigInt(coefficient.replace('.', ''));
    return scale < 0 ? { numerator: digits * 10n ** BigInt(-scale), denominator: 1n } : { numerator: digits, denominator: 10n ** BigInt(scale) };
  }
  function supported(value) { return value.numerator <= BigInt(Number.MAX_SAFE_INTEGER) * value.denominator ? value : null; }
  function divided(value, divisor) {
    if (value === null || divisor === null) return null;
    const denominator = decimal(divisor);
    return supported({ numerator: value.numerator * denominator.denominator, denominator: value.denominator * denominator.numerator });
  }
  function round(value, places) {
    if (value === null || supported(value) === null) return null;
    const scaled = value.numerator * 10n ** BigInt(places);
    const rounded = (scaled * 2n + value.denominator) / (value.denominator * 2n);
    return nonnegative(Number(`${rounded}e-${places}`));
  }
  function totalFromQuote(amount, basis, sf, acres) {
    if (amount === null) return null;
    const quote = decimal(amount);
    if (basis === 'total') return quote;
    const area = basis === 'sf' ? sf : acres;
    if (area === null) return null;
    const size = decimal(area);
    return supported({ numerator: quote.numerator * size.numerator, denominator: quote.denominator * size.denominator });
  }
  function calculateSurveyRent(calculation, area, legacy = {}) {
    const error = validateRentCalculation(calculation);
    if (error) throw new Error(error);
    const sf = resolveSurveyRentArea(area);
    const acres = positive(calculation.offered_acres);
    const result = {
      monthly_base_rent: nonnegative(legacy.monthly_base_rent),
      lease_rate_psf: nonnegative(legacy.lease_rate_psf),
      monthly_opex_psf: nonnegative(legacy.monthly_opex_psf),
      total_monthly_opex: nonnegative(legacy.total_monthly_opex),
      total_lease_rate: null, lease_rate_per_acre: null, areaSf: sf,
    };
    if (calculation.rent !== null) {
      const { amount, basis } = calculation.rent;
      const total = totalFromQuote(amount, basis, sf, acres);
      result.monthly_base_rent = round(total, 2);
      result.lease_rate_psf = round(basis === 'sf' && amount !== null ? decimal(amount) : divided(total, sf), 4);
      result.lease_rate_per_acre = round(basis === 'acre' && amount !== null ? decimal(amount) : divided(total, acres), 4);
    }
    if (calculation.expenses !== null) {
      const { amount, basis, treatment } = calculation.expenses;
      if (treatment === 'included') { result.total_monthly_opex = 0; result.monthly_opex_psf = 0; }
      else if (treatment === 'unknown') { result.total_monthly_opex = null; result.monthly_opex_psf = null; }
      else {
        const total = totalFromQuote(amount, basis, sf, null);
        result.total_monthly_opex = round(total, 2);
        result.monthly_opex_psf = round(basis === 'sf' && amount !== null ? decimal(amount) : divided(total, sf), 4);
      }
    }
    if (calculation.rent !== null && calculation.expenses !== null && result.monthly_base_rent !== null && result.total_monthly_opex !== null) {
      const base = decimal(result.monthly_base_rent), expenses = decimal(result.total_monthly_opex);
      result.total_lease_rate = round({ numerator: base.numerator * expenses.denominator + expenses.numerator * base.denominator, denominator: base.denominator * expenses.denominator }, 2);
    }
    return result;
  }

  function createSurveyRentDraft(calculation = null, isNew = false) {
    if (!calculation) return isNew ? { rent: { basis: 'total', amount: '' }, expenses: { basis: 'total', amount: '', treatment: 'unknown' }, offered_acres: '' } : null;
    const error = validateRentCalculation(calculation);
    if (error) throw new Error(error);
    return {
      rent: calculation.rent ? { ...clone(calculation.rent), amount: decimalInputString(calculation.rent.amount), preservePrecision: true } : null,
      expenses: calculation.expenses ? { ...clone(calculation.expenses), amount: decimalInputString(calculation.expenses.amount), preservePrecision: true } : null,
      offered_acres: decimalInputString(calculation.offered_acres),
      // Preserve extensions to valid version-1 metadata on coordinated saves.
      metadata: clone(calculation),
      original_offered_acres: calculation.offered_acres,
    };
  }
  function quoteOptions(quote) {
    const options = { ...(quote.basis === 'total' ? MONEY_OPTIONS : RATE_OPTIONS) };
    if (quote.preservePrecision) delete options.maxDecimals;
    return options;
  }
  function draftCalculation(draft, strict = true) {
    if (!draft) return null;
    const read = (amount, options, field, requireValid = strict) => {
      const result = parseNumericInput(amount, options);
      if (requireValid && !result.valid) { const error = new Error(result.error ?? 'Enter a valid amount.'); error.field = field; throw error; }
      return result.valid ? result.value : null;
    };
    const acresOptions = { ...ACRE_OPTIONS };
    if (typeof draft.original_offered_acres === 'number' && parseNumericInput(draft.offered_acres).value === draft.original_offered_acres) delete acresOptions.maxDecimals;
    const quote = (group, expense = false) => {
      if (!group) return null;
      const { preservePrecision, ...saved } = group;
      const original = draft.metadata?.[expense ? 'expenses' : 'rent'];
      return { ...(original || {}), ...saved, amount: read(group.amount, quoteOptions(group), expense ? 'expenses_' + group.basis : 'rent_' + group.basis, strict && (!expense || group.treatment === 'additional')) };
    };
    const calculation = {
      ...(draft.metadata || {}), version: 1,
      rent: quote(draft.rent), expenses: quote(draft.expenses, true),
      offered_acres: read(draft.offered_acres, acresOptions, 'offered_acres'),
    };
    if (strict) { const error = validateRentCalculation(calculation); if (error) throw new Error(error); }
    return calculation;
  }
  function getSurveyRentWrite(draft, area, legacy = {}) {
    const calculation = draftCalculation(draft, true);
    const values = calculation ? calculateSurveyRent(calculation, area, legacy) : legacy;
    return {
      rent_calculation: calculation,
      monthly_base_rent: values.monthly_base_rent ?? null,
      lease_rate_psf: values.lease_rate_psf ?? null,
      monthly_opex_psf: values.monthly_opex_psf ?? null,
      total_monthly_opex: values.total_monthly_opex ?? null,
      total_lease_rate: values.total_lease_rate ?? null,
    };
  }
  function preview(draft, area, legacy = {}) {
    const calculation = draftCalculation(draft, false);
    const values = calculateSurveyRent(calculation ?? { version: 1, rent: null, expenses: null, offered_acres: null }, area, legacy);
    if (!calculation) values.total_lease_rate = legacy.total_lease_rate ?? null;
    return values;
  }
  function displayed(value, basis, unreviewed = false) {
    if (value == null) return '';
    if (unreviewed) return value.toString();
    return basis === 'total' ? value.toFixed(2) : value.toFixed(4).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  }
  function baseDraft(draft) { return draft ? clone(draft) : { rent: null, expenses: null, offered_acres: '' }; }
  function editRent(draft, basis, amount, preservePrecision = false) {
    return { ...baseDraft(draft), rent: { ...(draft?.rent || {}), basis, amount, preservePrecision } };
  }
  function editExpenses(draft, basis, amount, preservePrecision = false) {
    return { ...baseDraft(draft), expenses: { ...(draft?.expenses || {}), basis, amount, preservePrecision, treatment: 'additional' } };
  }
  function changeExpenseTreatment(draft, treatment) {
    const next = baseDraft(draft);
    const expenses = next.expenses ?? { basis: 'total', amount: '' };
    const amount = treatment !== 'additional' && !parseNumericInput(expenses.amount, quoteOptions(expenses)).valid ? '' : expenses.amount;
    return { ...next, expenses: { ...expenses, amount, treatment } };
  }

  return { MONEY_OPTIONS, RATE_OPTIONS, ACRE_OPTIONS, decimalInputString, parseSuiteArea, resolveSurveyRentArea,
    validateRentCalculation, calculateSurveyRent, createSurveyRentDraft, quoteOptions,
    draftCalculation, getSurveyRentWrite, preview, displayed, editRent, editExpenses, changeExpenseTreatment };
});
