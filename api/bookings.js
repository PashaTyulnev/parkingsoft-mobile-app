import {
  API_BASE_URL,
  API_BOOKINGS_FILTER_PATH,
  API_BOOKINGS_SEARCH_PATH,
  API_BOOKINGS_ALL_PATH,
} from "./config";
import { AuthError } from "./errors";

export const BOOKINGS_FILTER_LIMIT = 100;
export const BOOKINGS_FILTER_PAGE = 1;

/** API `product` code for Valet (filter chip „Valet“). */
export const BOOKING_PRODUCT_VALET = "V";

/** API `product` code for Shuttle. */
export const BOOKING_PRODUCT_SHUTTLE = "S";

/**
 * Display label + key for booking card chip (`product` / `productCode`).
 * @param {unknown} product
 * @returns {{ key: "valet" | "shuttle"; label: string } | null}
 */
export function bookingProductDisplayMeta(product) {
  const p = String(product ?? "").trim().toUpperCase();
  if (p === BOOKING_PRODUCT_VALET) return { key: "valet", label: "Valet" };
  if (p === BOOKING_PRODUCT_SHUTTLE) return { key: "shuttle", label: "Shuttle" };
  return null;
}

/** API `paymentStatus` (e.g. filter / billing). */
export const BOOKING_PAYMENT_STATUS_FB = "FB";

/** API `paymentStatus` (e.g. filter / billing). */
export const BOOKING_PAYMENT_STATUS_FO = "FO";

/**
 * Chip for booking card (`paymentStatus`).
 * @param {unknown} paymentStatus
 * @returns {{ key: "fb" | "fo" | "other"; label: string } | null}
 */
export function bookingPaymentStatusDisplayMeta(paymentStatus) {
  const p = String(paymentStatus ?? "").trim().toUpperCase();
  if (!p) return null;
  if (p === BOOKING_PAYMENT_STATUS_FB) return { key: "fb", label: "FB" };
  if (p === BOOKING_PAYMENT_STATUS_FO) return { key: "fo", label: "FO" };
  return { key: "other", label: p };
}

/** List filter chip: no API status yet for the active leg (expected / not checked in). */
export const BOOKING_FILTER_LABEL_EXPECTED = "Erwartet";

/**
 * Local calendar date as YYYY-MM-DD (for API query params).
 * @param {Date} [date]
 * @returns {string}
 */
export function localDateYyyyMmDd(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * @param {"arrival" | "departure"} filterType
 * @param {Date} [date]
 * @returns {string} Full URL with query string
 */
export function buildBookingsFilterUrl(filterType, date = new Date()) {
  const day = localDateYyyyMmDd(date);
  const params = new URLSearchParams({
    dateFrom: day,
    dateTo: day,
    type: filterType,
    limit: String(BOOKINGS_FILTER_LIMIT),
    page: String(BOOKINGS_FILTER_PAGE),
  });
  return `${API_BASE_URL}${API_BOOKINGS_FILTER_PATH}?${params.toString()}`;
}

/**
 * @param {{
 *  searchString: string;
 *  type: "arrival" | "departure" | "service" | "changed" | "noshow" | "";
 *  page: number;
 *  limit: number;
 *  dateFrom?: string;
 *  dateTo?: string;
 * }} args
 * @returns {string} Full URL with query string
 */
export function buildBookingsSearchUrl(args) {
  const params = new URLSearchParams({
    searchString: String(args.searchString ?? "").trim(),
    type: String(args.type ?? ""),
    page: String(args.page ?? 1),
    limit: String(args.limit ?? 10),
  });
  // Guard against accidental boolean values like `false` being stringified and sent to the backend.
  // Backend expects null or YYYY-MM-DD strings.
  if (typeof args.dateFrom === "string") {
    const from = args.dateFrom.trim();
    if (from) params.set("dateFrom", from);
  }
  if (typeof args.dateTo === "string") {
    const to = args.dateTo.trim();
    if (to) params.set("dateTo", to);
  }
  return `${API_BASE_URL}${API_BOOKINGS_SEARCH_PATH}?${params.toString()}`;
}

/**
 * @param {{ page: number; limit: number }} args
 * @returns {string} Full URL with query string
 */
export function buildBookingsAllUrl(args) {
  const params = new URLSearchParams({
    page: String(args.page ?? 1),
    limit: String(args.limit ?? 20),
  });
  return `${API_BASE_URL}${API_BOOKINGS_ALL_PATH}?${params.toString()}`;
}

/**
 * @param {unknown} json
 * @returns {unknown[]}
 */
export function extractBookingsList(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const o = /** @type {Record<string, unknown>} */ (json);
    if (Array.isArray(o.bookings)) return o.bookings;
    if (Array.isArray(o["hydra:member"])) return o["hydra:member"];
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.items)) return o.items;
  }
  return [];
}

/**
 * @param {string | number | undefined} value
 * @param {string} fallback
 */
function formatPrice(value, fallback = "—") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "number") {
    return `${value.toFixed(2).replace(".", ",")} €`;
  }
  return String(value);
}

/**
 * @param {unknown} isoOrString
 */
function formatGermanDateTime(isoOrString) {
  if (isoOrString === undefined || isoOrString === null || isoOrString === "") {
    return "—";
  }
  const d = new Date(String(isoOrString));
  if (Number.isNaN(d.getTime())) {
    return String(isoOrString);
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}. ${hh}:${mi}`;
}

/**
 * @param {unknown} html
 * @returns {string}
 */
export function stripHtml(html) {
  if (html === undefined || html === null) return "";
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parkingsoft: arrivalDate "22.03.2026" + arrivalTime "10:00"
 * @param {unknown} datePart
 * @param {unknown} timePart
 * @returns {string}
 */
function joinGermanDateAndTime(datePart, timePart) {
  const d = datePart != null ? String(datePart).trim() : "";
  const t = timePart != null ? String(timePart).trim() : "";
  if (!d && !t) return "—";
  if (d && t) return `${d} ${t}`;
  return d || t;
}

/**
 * @param {number} ms
 */
function daysFromMs(ms) {
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

/**
 * @param {Record<string, unknown>} raw
 */
function computeDays(raw) {
  const dur = raw.duration;
  if (typeof dur === "number" && Number.isFinite(dur) && dur > 0) {
    return dur;
  }
  const arrTs = raw.arrivalTimestamp;
  const depTs = raw.departureTimestamp;
  if (typeof arrTs === "number" && typeof depTs === "number" && depTs > arrTs) {
    return daysFromMs((depTs - arrTs) * 1000);
  }
  const a = raw.arrival ?? raw.arrivalAt;
  const b = raw.departure ?? raw.departureAt;
  if (!a || !b) return Number(raw.days ?? raw.dayCount ?? 1) || 1;
  const start = new Date(String(a)).getTime();
  const end = new Date(String(b)).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return Number(raw.days ?? 1) || 1;
  }
  return daysFromMs(end - start);
}

const DETAIL_STATUS_LABEL_SUCCESS = "Erfolgreich";
const DETAIL_STATUS_LABEL_CHANGED = "Änderung!";

/** Known API detail leg status internals → German UI label. */
const DETAIL_LEG_INTERNAL_LABEL_DE = Object.freeze({
  noshow: "Nicht erschienen (No-Show)",
  arrival_finished: DETAIL_STATUS_LABEL_SUCCESS,
  departure_finished: DETAIL_STATUS_LABEL_SUCCESS,
  arrival_changed: DETAIL_STATUS_LABEL_CHANGED,
  departure_changed: DETAIL_STATUS_LABEL_CHANGED,
});

/**
 * @param {string} rawName
 * @param {string} nameInternal
 */
function resolveDetailLegLabel(rawName, nameInternal) {
  const internal = nameInternal.trim().toLowerCase();
  const direct =
    internal && Object.prototype.hasOwnProperty.call(DETAIL_LEG_INTERNAL_LABEL_DE, internal)
      ? DETAIL_LEG_INTERNAL_LABEL_DE[/** @type {keyof typeof DETAIL_LEG_INTERNAL_LABEL_DE} */ (internal)]
      : undefined;
  if (direct) return direct;
  if (rawName.toLowerCase() === "noshow" || internal === "noshow") {
    return DETAIL_LEG_INTERNAL_LABEL_DE.noshow;
  }
  if (internal.endsWith("_finished")) return DETAIL_STATUS_LABEL_SUCCESS;
  if (internal.endsWith("_changed")) return DETAIL_STATUS_LABEL_CHANGED;
  return rawName;
}

/** @type {readonly string[]} */
const ALLOWED_BADGES = ["Reingefahren", "Änderung", "Valet"];

/**
 * @param {Record<string, unknown>} raw
 */
function normalizeBadge(raw) {
  const exact = String(raw.status ?? raw.badge ?? raw.state ?? "").trim();
  if (ALLOWED_BADGES.includes(exact)) return exact;
  const lower = exact.toLowerCase();
  if (lower === "confirmed" || lower === "confirm") return "Reingefahren";
  return "Änderung";
}

/**
 * Bootstrap-style class from API → app color.
 * @param {unknown} className
 * @param {{ green: string; yellow: string; red: string; blue: string; text2: string }} theme
 */
export function mapBootstrapBtnClassToColor(className, theme) {
  const c = String(className ?? "").toLowerCase();
  if (c.includes("success")) return theme.green;
  if (c.includes("warning")) return theme.yellow;
  if (c.includes("danger")) return theme.red;
  if (c.includes("info")) return theme.blue;
  if (c.includes("primary")) return theme.blue;
  if (c.includes("secondary")) return theme.text2;
  return theme.text2;
}

/**
 * @param {unknown} obj
 * @param {{ green: string; yellow: string; red: string; blue: string; text2: string }} theme
 * @returns {{ label: string; color: string; nameInternal: string } | null}
 */
export function normalizeDetailLegStatus(obj, theme) {
  if (!obj || typeof obj !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (obj);
  const rawName = o.name != null ? String(o.name).trim() : "";
  if (!rawName) return null;
  const nameInternal = String(o.nameInternal ?? "").trim();
  return {
    label: resolveDetailLegLabel(rawName, nameInternal),
    color: mapBootstrapBtnClassToColor(o.color, theme),
    nameInternal,
  };
}

/**
 * Normalized detail leg: successful *finished* (excludes noshow).
 * @param {{ nameInternal?: string } | null | undefined} leg
 * @returns {boolean}
 */
export function isDetailLegFinishedSuccess(leg) {
  if (!leg || typeof leg !== "object") return false;
  const internal = String(leg.nameInternal ?? "").trim().toLowerCase();
  if (!internal || internal === "noshow") return false;
  return internal.endsWith("_finished");
}

/**
 * Normalized detail leg: *changed* state (excludes noshow).
 * @param {{ nameInternal?: string } | null | undefined} leg
 * @returns {boolean}
 */
export function isDetailLegChanged(leg) {
  if (!leg || typeof leg !== "object") return false;
  const internal = String(leg.nameInternal ?? "").trim().toLowerCase();
  if (!internal || internal === "noshow") return false;
  return internal.endsWith("_changed");
}

/**
 * No normalized leg from API (`arrivalStatus` / `departureStatus` was null or not mappable).
 * @param {unknown} leg
 * @returns {boolean}
 */
export function isDetailLegMissing(leg) {
  return leg == null || typeof leg !== "object";
}

/**
 * @param {{ product?: string } | null | undefined} booking
 * @returns {boolean}
 */
export function isBookingProductValet(booking) {
  if (!booking || typeof booking !== "object") return false;
  return String(booking.product ?? "").trim().toUpperCase() === BOOKING_PRODUCT_VALET;
}

/**
 * @param {{ product?: string } | null | undefined} booking
 * @returns {boolean}
 */
export function isBookingProductShuttle(booking) {
  if (!booking || typeof booking !== "object") return false;
  return String(booking.product ?? "").trim().toUpperCase() === BOOKING_PRODUCT_SHUTTLE;
}

/**
 * Numeric API booking id from a normalized list row (`item.id` is often a string).
 * @param {unknown} bookingListItem
 * @returns {number | null}
 */
export function numericBookingIdFromListItem(bookingListItem) {
  if (!bookingListItem || typeof bookingListItem !== "object") return null;
  const raw = /** @type {{ id?: unknown }} */ (bookingListItem).id;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return parseInt(raw.trim(), 10);
  }
  return null;
}

/**
 * @param {unknown} ds
 * @returns {number | null}
 */
export function parseDetailStatusRowId(ds) {
  if (!ds || typeof ds !== "object") return null;
  const id = /** @type {Record<string, unknown>} */ (ds).id;
  if (typeof id === "number" && Number.isFinite(id)) return id;
  if (typeof id === "string" && /^\d+$/.test(id.trim())) {
    return parseInt(id.trim(), 10);
  }
  return null;
}

export function buildDetailStatusBlock(raw, theme) {
  const ds = raw.detailStatus;
  if (!ds || typeof ds !== "object") {
    return { arrival: null, departure: null, note: "", rowId: null };
  }
  const d = /** @type {Record<string, unknown>} */ (ds);
  const arrival = normalizeDetailLegStatus(d.arrivalStatus, theme);
  const departure = normalizeDetailLegStatus(d.departureStatus, theme);
  const note = String(d.note ?? "").trim();
  const rowId = parseDetailStatusRowId(d);
  return { arrival, departure, note, rowId };
}

/**
 * @param {unknown} noticeRaw
 * @param {{ teal: string; red: string }} theme
 * @returns {{ text: string; color: string }}
 */
function remarkFromNotice(noticeRaw, theme) {
  const rawStr = String(noticeRaw ?? "");
  const plain = stripHtml(noticeRaw);
  const looksRed =
    /#ff0000|#f00\b|rgb\s*\(\s*255\s*,\s*0\s*,\s*0\s*\)/i.test(rawStr);
  return {
    text: plain,
    color: looksRed ? theme.red : theme.teal,
  };
}

/**
 * @param {Record<string, unknown>} r
 */
function buildFlightLabel(r) {
  const arr = r.flightNumberArrival;
  const dep = r.flightNumberDeparture;
  const a = arr != null && String(arr).trim() ? String(arr).trim() : "";
  const d = dep != null && String(dep).trim() ? String(dep).trim() : "";
  if (a && d) return `${a} · ${d}`;
  return a || d || "—";
}

/**
 * @param {Record<string, unknown>} r
 */
function buildGuestName(r) {
  const first = String(r.firstName ?? "").trim();
  const last = String(r.lastName ?? "").trim();
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  const customer =
    r.customer && typeof r.customer === "object"
      ? /** @type {Record<string, unknown>} */ (r.customer)
      : null;
  return String(
    r.name ??
      r.customerName ??
      r.guestName ??
      customer?.fullName ??
      customer?.name ??
      "—"
  );
}

/**
 * Map API row to UI booking shape (Parkingsoft filter + generic fallbacks).
 * @param {unknown} raw
 * @param {number} index
 * @param {{ teal: string; red: string; green: string; yellow: string; blue: string; text2: string }} theme
 */
export function normalizeBooking(raw, index, theme) {
  const r = /** @type {Record<string, unknown>} */ (
    raw && typeof raw === "object" ? raw : {}
  );

  const id = String(r.id ?? r.reference ?? `idx-${index}`);
  const reference =
    r.reference != null && String(r.reference).trim()
      ? String(r.reference).trim()
      : id;

  const hasParkingsoftDates =
    r.arrivalDate != null ||
    r.departureDate != null ||
    r.arrivalTime != null ||
    r.departureTime != null;

  const arrival = hasParkingsoftDates
    ? joinGermanDateAndTime(r.arrivalDate, r.arrivalTime)
    : formatGermanDateTime(r.arrival ?? r.arrivalAt);

  const departure = hasParkingsoftDates
    ? joinGermanDateAndTime(r.departureDate, r.departureTime)
    : formatGermanDateTime(r.departure ?? r.departureAt);

  const noticeRaw = r.notice ?? r.remark ?? r.notes ?? r.comment ?? "";
  const remarkInfo = remarkFromNotice(noticeRaw, theme);

  const product = String(r.product ?? r.productCode ?? "").trim();
  const isNative = r.isNative === true;
  const paymentStatus = String(
    r.paymentStatus ?? r.payment_status ?? ""
  )
    .trim()
    .toUpperCase();

  return {
    id,
    reference,
    product,
    paymentStatus,
    isNative,
    name: buildGuestName(r),
    pax: Number(r.passengers ?? r.pax ?? r.persons ?? 1) || 1,
    arrival,
    departure,
    days: computeDays(r),
    flight: buildFlightLabel(r),
    plate: String(
      r.licensePlate ??
        r.plate ??
        r.numberPlate ??
        r.registration ??
        "—"
    ),
    brand: String(r.model ?? r.brand ?? r.vehicleBrand ?? r.vehicleModel ?? "—"),
    price: formatPrice(
      /** @type {string | number | undefined} */ (r.price ?? r.totalPrice)
    ),
    remark: remarkInfo.text,
    remarkColor: remarkInfo.color,
    badge: normalizeBadge(r),
    detailStatus: buildDetailStatusBlock(r, theme),
  };
}

/**
 * GET /api/external/bookings/filter?... with Bearer token.
 * @param {string} token
 * @param {{ teal: string; red: string; green: string; yellow: string; blue: string; text2: string }} theme
 * @param {"arrival" | "departure"} filterType
 * @param {Date} [forDate] defaults to today (local)
 */
export async function fetchBookingsFiltered(token, theme, filterType, forDate) {
  const url = buildBookingsFilterUrl(filterType, forDate ?? new Date());
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
      `Bookings request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Bookings request failed");
  }

  return extractBookingsList(data).map((row, i) =>
    normalizeBooking(row, i, theme)
  );
}

/**
 * GET /api/external/bookings/search?... with Bearer token.
 * @param {string} token
 * @param {{ teal: string; red: string; green: string; yellow: string; blue: string; text2: string }} theme
 * @param {{
 *  searchString: string;
 *  type: "arrival" | "departure" | "service" | "changed" | "noshow" | "";
 *  page: number;
 *  limit: number;
 *  dateFrom?: string;
 *  dateTo?: string;
 * }} args
 * @returns {Promise<{ bookings: unknown[]; amount: number; pagesAmount: number; currentPage: number; limit: number; type: string }>}
 */
export async function fetchBookingsSearch(token, theme, args) {
  const url = buildBookingsSearchUrl(args);
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

  /** @type {any} */
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const o = /** @type {Record<string, unknown>} */ (data);
    const msg = o.message || o.detail || o.error || `Bookings request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Bookings request failed");
  }

  const list = extractBookingsList(data).map((row, i) => normalizeBooking(row, i, theme));
  const o = /** @type {Record<string, unknown>} */ (data);
  return {
    bookings: list,
    amount: Number(o.amount ?? list.length) || 0,
    pagesAmount: Number(o.pagesAmount ?? 1) || 1,
    currentPage: Number(o.currentPage ?? args.page ?? 1) || 1,
    limit: Number(o.limit ?? args.limit ?? list.length) || 0,
    type: String(o.type ?? args.type ?? ""),
  };
}

/**
 * GET /api/external/bookings/all?... with Bearer token.
 * @param {string} token
 * @param {{ teal: string; red: string; green: string; yellow: string; blue: string; text2: string }} theme
 * @param {{ page: number; limit: number }} args
 * @returns {Promise<{ bookings: unknown[]; amount: number; pagesAmount: number; currentPage: number; limit: number; type: string }>}
 */
export async function fetchBookingsAll(token, theme, args) {
  const url = buildBookingsAllUrl(args);
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

  /** @type {any} */
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const o = /** @type {Record<string, unknown>} */ (data);
    const msg = o.message || o.detail || o.error || `Bookings request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Bookings request failed");
  }

  const list = extractBookingsList(data).map((row, i) => normalizeBooking(row, i, theme));
  const o = /** @type {Record<string, unknown>} */ (data);
  return {
    bookings: list,
    amount: Number(o.amount ?? list.length) || 0,
    pagesAmount: Number(o.pagesAmount ?? 1) || 1,
    currentPage: Number(o.currentPage ?? args.page ?? 1) || 1,
    limit: Number(o.limit ?? args.limit ?? list.length) || 0,
    type: String(o.type ?? "both"),
  };
}
