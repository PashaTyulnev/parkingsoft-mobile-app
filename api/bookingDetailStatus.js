import {
  API_BASE_URL,
  API_BOOKINGS_DETAIL_STATUS_ALL_PATH,
  API_BOOKINGS_DETAIL_STATUS_PATH,
} from "./config";
import { AuthError } from "./errors";
import { normalizeDetailLegStatus } from "./bookings";

/** API expects literal string `"null"` for `internalId` when not using a row id (e.g. non-native booking). */
export const DETAIL_STATUS_INTERNAL_ID_STRING_NULL = "null";

/**
 * @param {unknown} className
 * @returns {"green" | "yellow" | "red" | "blue"}
 */
export function bootstrapBtnClassToChipTone(className) {
  const c = String(className ?? "").toLowerCase();
  if (c.includes("success")) return "green";
  if (c.includes("danger")) return "red";
  if (c.includes("warning")) return "yellow";
  if (c.includes("info") || c.includes("primary")) return "blue";
  return "yellow";
}

/**
 * @param {string} name
 * @param {string} nameInternal
 */
export function catalogStatusButtonLabel(name, nameInternal) {
  const ni = String(nameInternal).trim().toLowerCase();
  if (ni === "noshow") return "Nicht erschienen (No-Show)";
  const n = String(name).trim();
  return n || ni;
}

/**
 * @param {unknown} raw
 * @returns {{ id: number; name: string; nameInternal: string; chipTone: "green" | "yellow" | "red" | "blue"; position: number; colorBootstrap: string } | null}
 */
export function normalizeDetailStatusCatalogItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const idRaw = o.id;
  let id = NaN;
  if (typeof idRaw === "number" && Number.isFinite(idRaw)) id = idRaw;
  else if (typeof idRaw === "string" && /^\d+$/.test(idRaw.trim())) {
    id = parseInt(idRaw.trim(), 10);
  }
  if (!Number.isFinite(id)) return null;
  const nameInternal = String(o.nameInternal ?? "").trim();
  const name = String(o.name ?? "").trim();
  const colorBootstrap = String(o.color ?? "").trim() || "btn-secondary";
  return {
    id,
    name,
    nameInternal,
    chipTone: bootstrapBtnClassToChipTone(o.color),
    position: Number(o.position) || 0,
    colorBootstrap,
  };
}

/**
 * @param {unknown} json
 * @returns {unknown[]}
 */
function extractStatusArray(json) {
  if (Array.isArray(json)) return json;
  return [];
}

/**
 * @param {"arrival" | "departure"} dayMode
 * @param {readonly { nameInternal: string }[]} items
 */
export function filterDetailStatusesForDayMode(items, dayMode) {
  const filtered = items.filter((row) => {
    const ni = String(row.nameInternal ?? "").trim().toLowerCase();
    if (ni === "noshow") return true;
    if (dayMode === "departure") return ni.startsWith("departure_");
    return ni.startsWith("arrival_");
  });
  return [...filtered].sort((a, b) => a.position - b.position);
}

/**
 * @param {string} reference
 * @param {number | null | undefined} detailRowId `detailStatus.id` when `isNative === true`
 * @param {string | number} statusId catalog status id
 * @param {string} note
 * @param {boolean} [isNative] from booking `isNative` — if false, `internalId` is always `"null"`
 * @returns {{ reference: string; internalId: string; statusId: string; note: string }}
 */
export function buildDetailStatusSetBody(reference, detailRowId, statusId, note, isNative) {
  const ref = String(reference ?? "").trim();
  const noteStr = String(note ?? "");
  const sid = String(statusId);
  if (isNative !== true) {
    return {
      reference: ref,
      internalId: DETAIL_STATUS_INTERNAL_ID_STRING_NULL,
      statusId: sid,
      note: noteStr,
    };
  }
  const hasRow =
    detailRowId != null && Number.isFinite(Number(detailRowId));
  return {
    reference: ref,
    internalId: hasRow ? String(detailRowId) : DETAIL_STATUS_INTERNAL_ID_STRING_NULL,
    statusId: sid,
    note: noteStr,
  };
}

/**
 * GET all detail status options.
 * @param {string} token
 */
export async function fetchBookingDetailStatusesAll(token) {
  const url = `${API_BASE_URL}${API_BOOKINGS_DETAIL_STATUS_ALL_PATH}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new AuthError("Session expired or unauthorized");
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const o = /** @type {Record<string, unknown>} */ (data);
    const msg =
      o.message ||
      o.detail ||
      o.error ||
      `Detail status list failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Detail status list failed");
  }

  const list = extractStatusArray(data);
  /** @type {{ id: number; name: string; nameInternal: string; chipTone: string; position: number }[]} */
  const out = [];
  for (const row of list) {
    const n = normalizeDetailStatusCatalogItem(row);
    if (n) out.push(n);
  }
  return out;
}

/**
 * @param {unknown} json
 * @returns {{ newStatus: string; statusType: "arrival" | "departure"; note: string } | null}
 */
export function parseDetailStatusPostResponse(json) {
  if (!json || typeof json !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (json);
  const newStatus = String(o.newStatus ?? "").trim();
  if (!newStatus) return null;
  const st = String(o.statusType ?? "arrival").trim().toLowerCase();
  return {
    newStatus,
    statusType: st === "departure" ? "departure" : "arrival",
    note: String(o.note ?? ""),
  };
}

/**
 * @param {string} nameInternal
 */
function inferBootstrapClassFromInternal(nameInternal) {
  const ni = String(nameInternal).toLowerCase();
  if (ni === "noshow") return "btn-danger";
  if (ni.endsWith("_changed")) return "btn-warning";
  if (ni.endsWith("_finished")) return "btn-success";
  return "btn-secondary";
}

/**
 * @param {string} newStatus nameInternal from POST response
 * @param {readonly { nameInternal: string; name: string; colorBootstrap: string }[]} catalog
 * @param {{ green: string; yellow: string; red: string; blue: string; text2: string }} theme
 */
export function buildLegFromPostResponse(newStatus, catalog, theme) {
  const cat = catalog.find((c) => c.nameInternal === newStatus);
  const colorBootstrap = cat?.colorBootstrap || inferBootstrapClassFromInternal(newStatus);
  const displayName = cat?.name?.trim() ? cat.name : newStatus;
  const leg = normalizeDetailLegStatus(
    { name: displayName, nameInternal: newStatus, color: colorBootstrap },
    theme
  );
  return leg;
}

/**
 * Merge POST 200 payload into a normalized booking (instant UI).
 * @param {object} booking
 * @param {{ newStatus: string; statusType: "arrival" | "departure"; note: string }} parsed
 * @param {readonly { nameInternal: string; name: string; colorBootstrap: string }[]} catalog
 * @param {{ green: string; yellow: string; red: string; blue: string; text2: string }} theme
 */
export function patchBookingDetailStatusFromPostResponse(booking, parsed, catalog, theme) {
  const leg = buildLegFromPostResponse(parsed.newStatus, catalog, theme);
  const key = parsed.statusType === "departure" ? "departure" : "arrival";
  return {
    ...booking,
    detailStatus: {
      ...booking.detailStatus,
      [key]: leg,
      note: parsed.note,
    },
  };
}

/**
 * POST set detail status on booking.
 * @param {string} token
 * @param {{ reference: string; internalId: string; statusId: string; note: string }} body
 */
export async function postBookingDetailStatus(token, body) {
  const url = `${API_BASE_URL}${API_BOOKINGS_DETAIL_STATUS_PATH}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    throw new AuthError("Session expired or unauthorized");
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const o = /** @type {Record<string, unknown>} */ (data);
    const msg =
      o.message ||
      o.detail ||
      o.error ||
      `Set detail status failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Set detail status failed");
  }

  return data;
}
