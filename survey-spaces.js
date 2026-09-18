/* Survey offering identity and retry contracts. Ported from master-app
 * dc082c935668da0b7bb8e4c8ad403e7f15a4a120: available-spaces.ts and
 * save-available-spaces.ts. No database or browser dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SurveySpaces = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Verified SurveyProperty contract, intentionally narrower than the full row:
  // saved client feedback/favorites, timestamps and ownership are read-only here.
  // property_name is a Comp column and is not part of survey_properties.
  const WRITE_FIELDS = new Set([
    "address", "city", "state", "zip", "latitude", "longitude",
    "building_sf", "land_area_ac", "suite_size", "suite_number", "office_sf",
    "sale_price", "cap_rate", "zoning", "tenancy", "lease_rate_psf", "lease_type",
    "total_lease_rate", "num_private_offices", "monthly_base_rent", "monthly_opex_psf",
    "total_monthly_opex", "rent_calculation", "power", "loading", "clear_height",
    "date_available", "for_sale_or_lease", "availability", "yard_area", "flyer_url",
    "photo_url", "notes", "notes_2", "internal_notes", "internal_status",
  ]);
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const normalizeIdentityPart = (value) => String(value ?? "").trim().replace(/\s+/gu, " ").toLowerCase();
  function surveyBuildingKey(property) {
    return JSON.stringify([property.address, property.city, property.state].map(normalizeIdentityPart));
  }
  function groupSurveySpaces(rows) {
    const groups = [], buildings = new Map();
    for (const row of rows) {
      if (row.tenancy !== "MT" || !normalizeIdentityPart(row.address)) {
        groups.push({ key: `property:${row.id}`, property: row, spaces: [row] });
        continue;
      }
      const key = `building:${surveyBuildingKey(row)}`;
      if (buildings.has(key)) buildings.get(key).spaces.push(row);
      else {
        const group = { key, property: row, spaces: [row] };
        buildings.set(key, group); groups.push(group);
      }
    }
    return groups;
  }
  function availableSpaceSeed(property) {
    const seed = { tenancy: "MT", for_sale_or_lease: [...(property.for_sale_or_lease || [])] };
    for (const key of ["address", "city", "state", "zip", "latitude", "longitude", "building_sf", "land_area_ac", "zoning", "photo_url"])
      if (Object.hasOwn(property, key)) seed[key] = clone(property[key]);
    return seed;
  }
  function getSpaceLabel(property) {
    const label = property.suite_number?.trim();
    if (!label) return "Available space";
    return /^(?:suites?|spaces?)\b/i.test(label) ? label : `Suite ${label}`;
  }
  function normalizeSpaceLabel(value) {
    return normalizeIdentityPart(value).replace(/^suite\s+/, "");
  }
  class SurveySpaceConflictError extends Error {
    constructor(message) { super(message); this.name = "SurveySpaceConflictError"; this.saveRejected = true; }
  }
  function assertUniqueSpaces(rows, existing = []) {
    const ids = new Set(rows.map((row) => row.id));
    if (ids.size !== rows.length) throw new SurveySpaceConflictError("Each space must have its own identifier.");
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.tenancy !== "MT") continue;
      const others = [...rows.filter((_other, index) => index !== i), ...existing.filter((other) => !ids.has(other.id))];
      if (others.some((other) => surveyBuildingKey(other) === surveyBuildingKey(row) && normalizeSpaceLabel(other.suite_number) === normalizeSpaceLabel(row.suite_number)))
        throw new SurveySpaceConflictError(`“${row.suite_number || "Available space"}” already exists at this property. Use a distinct option label or edit the existing space.`);
    }
  }
  // JSON key order must not turn unchanged metadata into an edit/conflict.
  function sameValue(a, b) {
    if (a === b) return true;
    if (a == null || b == null || typeof a !== typeof b) return false;
    if (typeof a !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a), other = Object.keys(b);
    return keys.length === other.length && keys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]));
  }
  function createBatchRequest({ accountId, surveyId, rows, requestId }) {
    const request = { version: 1, kind: "insert", requestId: requestId || crypto.randomUUID(), accountId, surveyId,
      rows: rows.map((row) => ({ ...clone(row), id: row.id || crypto.randomUUID(), survey_id: surveyId })) };
    validateRequest(request); assertUniqueSpaces(request.rows); return request;
  }
  function createUpdateRequest({ accountId, surveyId, id, baseline, patch, requestId }) {
    const request = { version: 1, kind: "update", requestId: requestId || crypto.randomUUID(), accountId, surveyId, id,
      baseline: clone(baseline), patch: clone(patch) };
    validateRequest(request); return request;
  }
  function validateRequest(request) {
    const fail = (message) => { throw new SurveySpaceConflictError(message); };
    if (!request || request.version !== 1 || !UUID.test(request.requestId || "") || !UUID.test(request.accountId || "") || !UUID.test(request.surveyId || ""))
      fail("Save request is missing its account, survey or stable retry identifier. Reopen the reviewed draft.");
    if (request.kind === "insert") {
      if (!Array.isArray(request.rows) || !request.rows.length || request.rows.length > 100) fail("Choose between 1 and 100 spaces in this survey.");
      if (request.rows.some((row) => !row || !UUID.test(row.id || "") || row.survey_id !== request.surveyId)) fail("Each space needs its own identifier in the selected survey.");
      if (new Set(request.rows.map((row) => row.id)).size !== request.rows.length) fail("Each space must have its own identifier.");
    } else if (request.kind === "update") {
      if (!UUID.test(request.id || "") || request.baseline?.id !== request.id || request.baseline?.survey_id !== request.surveyId || !request.baseline.updated_at)
        fail("Reload the exact saved space before reviewing an update.");
      if (!request.patch || typeof request.patch !== "object" || Array.isArray(request.patch) || !Object.keys(request.patch).length) fail("There are no reviewed changes to save.");
    } else fail("Unsupported Survey save request.");
    const writes = request.kind === "insert" ? request.rows : [request.patch];
    for (const write of writes) {
      for (const key of Object.keys(write)) {
        if (request.kind === "insert" && ["id", "survey_id"].includes(key)) continue;
        if (!WRITE_FIELDS.has(key)) fail(`Unsupported Survey field “${key}”. This save cannot change record identity, ownership, client feedback or votes.`);
      }
    }
    return request;
  }
  function classifyReadback(request, rows) {
    if (!Array.isArray(rows)) throw new Error("Could not verify the saved spaces. Retry the same request.");
    const ids = request.kind === "insert" ? request.rows.map((row) => row.id) : [request.id];
    const scoped = rows.filter((row) => row.survey_id === request.surveyId && ids.includes(row.id));
    const found = new Set(scoped.map((row) => row.id));
    if (!found.size) return { status: "none", properties: [] };
    if (found.size !== ids.length) return { status: "partial", properties: scoped };
    if (request.kind === "insert") return { status: "saved", properties: scoped };
    const current = scoped[0];
    if (Object.keys(request.patch).every((key) => sameValue(current[key], request.patch[key]))) return { status: "saved", properties: scoped, current };
    if (sameValue(current, request.baseline)) return { status: "none", properties: scoped, current };
    return { status: "changed", properties: scoped, current };
  }
  return { surveyBuildingKey, groupSurveySpaces, availableSpaceSeed, getSpaceLabel, normalizeSpaceLabel,
    SurveySpaceConflictError, assertUniqueSpaces, sameValue, createBatchRequest, createUpdateRequest, validateRequest, classifyReadback };
});
