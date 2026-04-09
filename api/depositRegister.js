import {
  API_BASE_URL,
  API_BOOKING_DEPOSIT_REGISTER_DATA_PATH,
  API_DEPOSIT_REGISTER_ADD_PATH,
  API_DEPOSIT_REGISTER_DELETE_PATH,
} from "./config";
import { AuthError } from "./errors";

/** API `depositType` for Einnahme / positive lines. */
export const DEPOSIT_TYPE_POSITIVE = "positive";

/** API `depositType` for Ausgabe / negative lines. */
export const DEPOSIT_TYPE_NEGATIVE = "negative";

/**
 * Convert UI date `DD.MM.YYYY` to API `YYYY-MM-DD`.
 * @param {string} value
 * @returns {string | null}
 */
export function germanDateDdMmYyyyToIso(value) {
  const t = String(value ?? "").trim();
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const y = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * @param {"income" | "expense"} kindId
 * @returns {typeof DEPOSIT_TYPE_POSITIVE | typeof DEPOSIT_TYPE_NEGATIVE}
 */
export function depositKindToDepositType(kindId) {
  return kindId === "expense" ? DEPOSIT_TYPE_NEGATIVE : DEPOSIT_TYPE_POSITIVE;
}

/**
 * @param {{
 *   bookingId: number;
 *   isMainFee: boolean;
 *   depositType: string;
 *   depositDate: string;
 *   paymentType: string;
 *   depositPurpose: number;
 *   description: string;
 *   deposit: string | number;
 * }} fields
 * @returns {FormData}
 */
export function buildAddDepositFormData(fields) {
  const form = new FormData();
  form.append("bookingId", String(fields.bookingId));
  form.append("isMainFee", fields.isMainFee ? "true" : "false");
  form.append("depositType", fields.depositType);
  form.append("depositDate", fields.depositDate);
  form.append("paymentType", fields.paymentType);
  form.append("depositPurpose", String(fields.depositPurpose));
  form.append("description", fields.description);
  form.append("deposit", String(fields.deposit));
  return form;
}

/**
 * @param {unknown} raw API `defaultCost` (number, numeric string, comma decimal).
 * @returns {number | null}
 */
export function parseDefaultCost(raw) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const t = raw.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * @param {unknown} raw
 * @returns {{ id: number; name: string; defaultCost: number | null; displayOnBookingsPage: boolean; isReceivingPurpose: boolean } | null}
 */
export function normalizeDepositPurpose(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const idRaw = o.id;
  let id = NaN;
  if (typeof idRaw === "number" && Number.isFinite(idRaw)) id = idRaw;
  else if (typeof idRaw === "string" && /^\d+$/.test(idRaw.trim())) {
    id = parseInt(idRaw.trim(), 10);
  }
  if (!Number.isFinite(id)) return null;
  const name = String(o.name ?? "").trim();
  if (!name) return null;
  const defaultCost = parseDefaultCost(o.defaultCost);
  return {
    id,
    name,
    defaultCost: defaultCost ?? null,
    displayOnBookingsPage: o.displayOnBookingsPage === true,
    isReceivingPurpose: o.isReceivingPurpose === true,
  };
}

/**
 * Purposes meant for the bookings cash UI (API flag).
 * @param {readonly { displayOnBookingsPage: boolean }[]} purposes
 */
export function filterDepositPurposesForBookingsPage(purposes) {
  return purposes.filter((p) => p.displayOnBookingsPage === true);
}

/**
 * One saved deposit line from `bookingDeposits` (GET deposit-register-data).
 * @param {unknown} raw
 * @returns {{
 *   serverId: number;
 *   amount: number;
 *   kind: "income" | "expense";
 *   at: Date;
 *   description: string;
 *   paymentLabel: string;
 *   isMainBookingFee: boolean;
 *   isValid: boolean;
 * } | null}
 */
export function normalizeBookingDeposit(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const idRaw = o.id;
  let serverId = NaN;
  if (typeof idRaw === "number" && Number.isFinite(idRaw)) serverId = idRaw;
  else if (typeof idRaw === "string" && /^\d+$/.test(idRaw.trim())) {
    serverId = parseInt(idRaw.trim(), 10);
  }
  if (!Number.isFinite(serverId)) return null;

  const amountParsed = parseDefaultCost(o.deposit);
  if (amountParsed == null || !Number.isFinite(amountParsed)) return null;

  const dt = String(o.depositType ?? "").trim().toLowerCase();
  let kind = /** @type {"income" | "expense"} */ ("income");
  if (dt === "negative") kind = "expense";
  else if (dt === "positive") kind = "income";
  else if (amountParsed < 0) kind = "expense";

  const amount = Math.abs(amountParsed);

  const createdAt = o.createdAt != null ? String(o.createdAt) : "";
  let at = new Date();
  if (createdAt) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) at = d;
  }

  return {
    serverId,
    amount,
    kind,
    at,
    description: String(o.description ?? "").trim() || "—",
    paymentLabel: String(o.paymentType ?? "").trim() || "—",
    isMainBookingFee: o.isMainBookingFee === true,
    isValid: o.isValid === true,
  };
}

/**
 * @param {readonly ReturnType<typeof normalizeBookingDeposit>[]} rows
 */
export function sortBookingDepositsNewestFirst(rows) {
  const list = rows.filter(Boolean);
  return [...list].sort((a, b) => b.at.getTime() - a.at.getTime());
}

/**
 * @param {readonly ReturnType<typeof normalizeBookingDeposit>[]} rows
 * @returns {{ id: string; depositServerId: number; at: Date; description: string; paymentLabel: string; amount: number; kind: "income" | "expense" }[]}
 */
export function modalEntriesFromBookingDeposits(rows) {
  return sortBookingDepositsNewestFirst(rows).map((d) => ({
    id: `dep-${d.serverId}`,
    depositServerId: d.serverId,
    at: d.at,
    description: d.description,
    paymentLabel: d.paymentLabel,
    amount: d.amount,
    kind: d.kind,
  }));
}

/**
 * @param {unknown} json
 * @returns {{
 *   booking: Record<string, unknown> | null;
 *   bookingIsPayed: boolean;
 *   bookingFeePayedTo: string | null;
 *   depositPurposes: ReturnType<typeof normalizeDepositPurpose>[];
 *   bookingDeposits: NonNullable<ReturnType<typeof normalizeBookingDeposit>>[];
 * }}
 */
export function parseDepositRegisterData(json) {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid deposit register response");
  }
  const o = /** @type {Record<string, unknown>} */ (json);
  const rawList = Array.isArray(o.depositPurposes) ? o.depositPurposes : [];
  const normalized = rawList
    .map((row) => normalizeDepositPurpose(row))
    .filter(Boolean);
  const forPage = filterDepositPurposesForBookingsPage(
    /** @type {typeof normalized} */ (normalized)
  );
  const booking =
    o.booking && typeof o.booking === "object"
      ? /** @type {Record<string, unknown>} */ (o.booking)
      : null;

  const rawDeps = Array.isArray(o.bookingDeposits) ? o.bookingDeposits : [];
  const bookingDeposits = /** @type {NonNullable<ReturnType<typeof normalizeBookingDeposit>>[]} */ (
    rawDeps.map((row) => normalizeBookingDeposit(row)).filter((row) => row != null)
  );

  return {
    booking,
    bookingIsPayed: o.bookingIsPayed === true,
    bookingFeePayedTo:
      o.bookingFeePayedTo == null
        ? null
        : String(o.bookingFeePayedTo).trim() || null,
    depositPurposes: forPage,
    bookingDeposits,
  };
}

/**
 * @param {string | number} bookingId
 * @returns {string}
 */
export function buildDepositRegisterDataUrl(bookingId) {
  const u = new URL(
    `${API_BASE_URL}${API_BOOKING_DEPOSIT_REGISTER_DATA_PATH}`
  );
  u.searchParams.set("bookingId", String(bookingId));
  return u.toString();
}

/**
 * GET deposit register purposes + booking snapshot (Bearer).
 * @param {string} token
 * @param {number} bookingId
 */
export async function fetchDepositRegisterData(token, bookingId) {
  const url = buildDepositRegisterDataUrl(bookingId);
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
      `Deposit register failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Deposit register failed");
  }

  return parseDepositRegisterData(data);
}

/**
 * POST new deposit line (multipart/form-data). Do not set Content-Type; runtime sets boundary.
 * @param {string} token
 * @param {FormData} formData
 * @returns {Promise<unknown>}
 */
export async function postAddDeposit(token, formData) {
  const url = `${API_BASE_URL}${API_DEPOSIT_REGISTER_ADD_PATH}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (res.status === 401 || res.status === 403) {
    throw new AuthError("Session expired or unauthorized");
  }

  const text = await res.text();
  let data = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    const o = /** @type {Record<string, unknown>} */ (data);
    const msg =
      o.message ||
      o.detail ||
      o.error ||
      (typeof text === "string" && text.trim() ? text.trim() : null) ||
      `Add deposit failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Add deposit failed");
  }

  return data;
}

/**
 * Best-effort deposit row id from add-deposit JSON (shape varies by backend).
 * @param {unknown} data
 * @returns {number | null}
 */
export function extractDepositIdFromAddResponse(data) {
  if (!data || typeof data !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (data);
  const nested =
    o.data && typeof o.data === "object"
      ? /** @type {Record<string, unknown>} */ (o.data)
      : null;
  const dep =
    o.deposit && typeof o.deposit === "object"
      ? /** @type {Record<string, unknown>} */ (o.deposit)
      : null;
  const candidates = [
    o.depositId,
    o.id,
    nested?.depositId,
    nested?.id,
    dep?.id,
    dep?.depositId,
  ];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
    if (typeof c === "string" && /^\d+$/.test(c.trim())) {
      return parseInt(c.trim(), 10);
    }
  }
  return null;
}

/**
 * @param {number | string} depositId
 * @returns {string}
 */
export function buildDeleteDepositUrl(depositId) {
  const u = new URL(`${API_BASE_URL}${API_DEPOSIT_REGISTER_DELETE_PATH}`);
  u.searchParams.set("depositId", String(depositId));
  return u.toString();
}

/**
 * GET delete deposit (Bearer). Backend may return 302 to an internal URL — we do not follow redirects.
 * @param {string} token
 * @param {number} depositId
 */
export async function fetchDeleteDeposit(token, depositId) {
  const url = buildDeleteDepositUrl(depositId);
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    redirect: "manual",
  });

  if (res.status === 401 || res.status === 403) {
    throw new AuthError("Session expired or unauthorized");
  }

  const ok =
    (res.status >= 200 && res.status < 300) ||
    res.status === 301 ||
    res.status === 302 ||
    res.status === 303 ||
    res.status === 307 ||
    res.status === 308;

  if (ok) {
    try {
      await res.text();
    } catch {
      /* ignore */
    }
    return;
  }

  let data = {};
  const text = await res.text();
  if (text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }
  const o = /** @type {Record<string, unknown>} */ (data);
  const msg =
    o.message ||
    o.detail ||
    o.error ||
    (typeof text === "string" && text.trim() ? text.trim() : null) ||
    `Delete deposit failed (${res.status})`;
  throw new Error(typeof msg === "string" ? msg : "Delete deposit failed");
}
