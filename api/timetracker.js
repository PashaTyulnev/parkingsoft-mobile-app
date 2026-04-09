import {
  API_BASE_URL,
  API_TIMETRACKER_CHECKIN_PATH,
  API_TIMETRACKER_CHECKOUT_PATH,
  API_TIMETRACKER_STATUS_PATH,
  API_TIMETRACKER_LAST_USER_INFORMATION_PATH,
  API_TIMETRACKER_OVERVIEW_ALL_PATH,
  API_TIMETRACKER_USER_TOTALS_PATH,
} from "./config";
import { AuthError } from "./errors";

/** Query keys for `overview_all`. */
export const TIMETRACKER_OVERVIEW_QUERY_YEAR = "year";
export const TIMETRACKER_OVERVIEW_QUERY_MONTH = "month";
export const TIMETRACKER_OVERVIEW_QUERY_USER_ID = "userId";

/** PHP datetime `date` field pattern (wall clock). */
const PHP_DATETIME_DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?$/;

/**
 * @param {Date} d
 * @returns {string} HH:mm
 */
function formatClock(d) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * @param {unknown} value
 * @returns {string | null} HH:mm
 */
export function parseValueToClockTime(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return formatClock(d);
  }
  const s = String(value).trim();
  const hm = s.match(/^(\d{1,2}):(\d{2})/);
  if (hm) {
    return `${String(Number(hm[1])).padStart(2, "0")}:${hm[2]}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return formatClock(d);
  return null;
}

/**
 * Pick a display time from API JSON (shape may vary).
 * @param {unknown} data
 * @param {"checkin" | "checkout"} kind
 * @returns {string | null}
 */
export function pickClockTimeFromTimetrackerJson(data, kind) {
  if (!data || typeof data !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (data);
  const keys =
    kind === "checkin"
      ? ["checkIn", "checkin", "check_in", "time", "startTime", "start", "clock"]
      : ["checkOut", "checkout", "check_out", "time", "endTime", "end", "clock"];
  for (const k of keys) {
    if (k in o) {
      const t = parseValueToClockTime(o[k]);
      if (t) return t;
    }
  }
  return null;
}

/**
 * PHP `DateTime` serialized to JSON: `{ date, timezone_type, timezone }`.
 * Uses wall time from `date` (e.g. Europe/Berlin).
 * @param {unknown} obj
 * @returns {string | null} HH:mm
 */
export function parsePhpDateTimeObjectToHHmm(obj) {
  if (!obj || typeof obj !== "object") return null;
  const dateStr = /** @type {Record<string, unknown>} */ (obj).date;
  if (typeof dateStr !== "string") return null;
  const m = dateStr.match(/\d{4}-\d{2}-\d{2}\s+(\d{2}):(\d{2})(?::\d{2})?/);
  if (!m) return null;
  return `${m[1]}:${m[2]}`;
}

/**
 * @param {unknown} obj
 * @returns {{ dateDE: string; timeHM: string; sortValue: number } | null}
 */
export function parsePhpDateTimeObjectToParts(obj) {
  if (!obj || typeof obj !== "object") return null;
  const dateStr = /** @type {Record<string, unknown>} */ (obj).date;
  if (typeof dateStr !== "string") return null;
  const m = dateStr.match(PHP_DATETIME_DATE_RE);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  if (![y, mo, d, h, mi].every((n) => Number.isFinite(n))) return null;
  return {
    dateDE: `${String(d).padStart(2, "0")}.${String(mo).padStart(2, "0")}.${y}`,
    timeHM: `${m[4]}:${m[5]}`,
    sortValue: Date.UTC(y, mo - 1, d, h, mi),
  };
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function stringOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

/**
 * @typedef {{ id: number | null; username: string }} CurrentUserLike
 */

/**
 * One row from `overview_all` for the UI list.
 * @param {unknown} raw
 * @returns {{ timeTrackerId: number; username: string; startDateDE: string; startTime: string; endDateDE: string; endTime: string | null; isOpenShift: boolean; totalWorkingTime: string | null; shiftDuration: string | null; pauseDuration: string; sortValue: number } | null}
 */
export function normalizeTimeTrackerOverviewItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const idRaw = o.timeTrackerId;
  const timeTrackerId =
    typeof idRaw === "number" && Number.isFinite(idRaw)
      ? idRaw
      : parseInt(String(idRaw ?? ""), 10);
  if (!Number.isFinite(timeTrackerId)) return null;

  const start = parsePhpDateTimeObjectToParts(o.shiftStart);
  const end = o.shiftEnd != null ? parsePhpDateTimeObjectToParts(o.shiftEnd) : null;

  return {
    timeTrackerId,
    username: String(o.username ?? ""),
    startDateDE: start?.dateDE ?? "",
    startTime: start?.timeHM ?? "—",
    endDateDE: end?.dateDE ?? "",
    endTime: end?.timeHM ?? null,
    isOpenShift: o.shiftEnd == null,
    totalWorkingTime: stringOrNull(o.totalWorkingTime),
    shiftDuration: stringOrNull(o.shiftDuration),
    pauseDuration: String(o.pauseDuration ?? "00:00"),
    sortValue: start?.sortValue ?? 0,
  };
}

/**
 * Keeps only rows for the logged-in user (API may return multiple users).
 * @param {Array<{ username: string }>} rows
 * @param {CurrentUserLike | null | undefined} user
 * @returns {typeof rows}
 */
export function filterOverviewRowsForCurrentUser(rows, user) {
  if (!user?.username) return rows;
  const want = user.username.toLowerCase();
  return rows.filter((r) => r.username.toLowerCase() === want);
}

/**
 * @param {unknown} raw
 * @param {CurrentUserLike | null | undefined} currentUser
 */
export function parseTimeTrackerOverviewResponse(raw, currentUser) {
  const arr = Array.isArray(raw) ? raw : [];
  const mapped = /** @type {NonNullable<ReturnType<typeof normalizeTimeTrackerOverviewItem>>[]} */ (
    arr.map(normalizeTimeTrackerOverviewItem).filter(Boolean)
  );
  const filtered = filterOverviewRowsForCurrentUser(mapped, currentUser);
  filtered.sort((a, b) => b.sortValue - a.sortValue);
  return filtered;
}

/**
 * Raw `overview_all` rows for the logged-in user (for `user_totals` POST body).
 * @param {unknown} raw
 * @param {CurrentUserLike | null | undefined} user
 * @returns {unknown[]}
 */
export function filterRawOverviewForCurrentUser(raw, user) {
  if (!Array.isArray(raw)) return [];
  if (!user?.username) return [];
  const want = user.username.toLowerCase();
  return raw.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const u = String(/** @type {Record<string, unknown>} */ (row).username ?? "").toLowerCase();
    return u === want;
  });
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatPhpDateTimeStringDE(value) {
  if (value == null) return "—";
  const s = String(value).trim();
  if (!s) return "—";
  const p = parsePhpDateTimeObjectToParts({ date: s });
  if (!p) return s;
  return `${p.dateDE} ${p.timeHM}`;
}

/**
 * Normalized `user_totals` POST response for UI.
 * @param {unknown} raw
 * @returns {{ totalWorkingTime: string; totalPause: string; totalShiftDuration: string; dateFromLabel: string; dateToLabel: string; username: string; totalNightShiftPause: string; totalNightShiftWorkingTime: string; totalNightShiftWithoutPause: string } | null}
 */
export function normalizeUserTotalsResponse(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  return {
    totalWorkingTime: stringOrNull(o.totalWorkingTime) ?? "—",
    totalPause: stringOrNull(o.totalPause) ?? "—",
    totalShiftDuration: stringOrNull(o.totalShiftDuration) ?? "—",
    dateFromLabel: formatPhpDateTimeStringDE(o.dateFrom),
    dateToLabel: formatPhpDateTimeStringDE(o.dateTo),
    username: String(o.username ?? ""),
    totalNightShiftPause: stringOrNull(o.totalNightShiftPause) ?? "—",
    totalNightShiftWorkingTime: stringOrNull(o.totalNightShiftWorkingTime) ?? "—",
    totalNightShiftWithoutPause: stringOrNull(o.totalNightShiftWithoutPause) ?? "—",
  };
}

/**
 * Map `/timetracker/status` body to display times.
 * @param {unknown} raw
 * @returns {{ kind: string; checkIn: string; checkOut: string }}
 */
export function normalizeTimeTrackerStatusPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return { kind: "", checkIn: "", checkOut: "" };
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
  const kind = String(o.type ?? "").toLowerCase();
  const ts = parsePhpDateTimeObjectToHHmm(o.timestamp);
  const mainIn = parsePhpDateTimeObjectToHHmm(o.mainCheckin);

  if (kind === "checkout") {
    return {
      kind,
      checkIn: mainIn ?? "",
      checkOut: ts ?? "",
    };
  }
  if (kind === "checkin") {
    return {
      kind,
      checkIn: mainIn ?? ts ?? "",
      checkOut: "",
    };
  }
  if (mainIn && ts) {
    return { kind, checkIn: mainIn, checkOut: ts };
  }
  return {
    kind,
    checkIn: mainIn ?? ts ?? "",
    checkOut: "",
  };
}

/**
 * @param {string} token
 * @param {string} path
 */
async function timeTrackerGet(token, path) {
  const url = `${API_BASE_URL}${path}`;
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
      `Timetracker request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Timetracker request failed");
  }

  return data;
}

/**
 * @param {string} token
 * @param {string} path
 * @param {unknown} jsonBody
 */
async function timeTrackerPostJson(token, path, jsonBody) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(jsonBody),
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
      `Timetracker request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Timetracker request failed");
  }

  return data;
}

/**
 * @param {string} token
 * @returns {Promise<unknown>}
 */
export async function fetchTimeTrackerCheckIn(token) {
  return timeTrackerGet(token, API_TIMETRACKER_CHECKIN_PATH);
}

/**
 * @param {string} token
 * @returns {Promise<unknown>}
 */
export async function fetchTimeTrackerCheckout(token) {
  return timeTrackerGet(token, API_TIMETRACKER_CHECKOUT_PATH);
}

/**
 * Current check-in / check-out state for today (or server-defined window).
 * @param {string} token
 * @returns {Promise<unknown>}
 */
export async function fetchTimeTrackerStatus(token) {
  return timeTrackerGet(token, API_TIMETRACKER_STATUS_PATH);
}

/** Filter chips for team status list. */
export const LAST_USER_FILTER_ALL = "all";
export const LAST_USER_FILTER_CHECKIN = "checkin";
export const LAST_USER_FILTER_CHECKOUT = "checkout";
export const LAST_USER_FILTER_PAUSE = "pause";
export const LAST_USER_FILTER_OTHER = "other";

/**
 * Map API `type` to a filter bucket (`pause*` / `pause_*` → pause).
 * @param {unknown} typeRaw
 * @returns {typeof LAST_USER_FILTER_CHECKIN | typeof LAST_USER_FILTER_CHECKOUT | typeof LAST_USER_FILTER_PAUSE | typeof LAST_USER_FILTER_OTHER}
 */
export function lastUserInformationFilterCategory(typeRaw) {
  const t = String(typeRaw ?? "")
    .trim()
    .toLowerCase();
  if (t === LAST_USER_FILTER_CHECKOUT) return LAST_USER_FILTER_CHECKOUT;
  if (t === LAST_USER_FILTER_CHECKIN) return LAST_USER_FILTER_CHECKIN;
  if (t.includes("pause")) return LAST_USER_FILTER_PAUSE;
  return LAST_USER_FILTER_OTHER;
}

/**
 * @param {typeof LAST_USER_FILTER_CHECKIN | typeof LAST_USER_FILTER_CHECKOUT | typeof LAST_USER_FILTER_PAUSE | typeof LAST_USER_FILTER_OTHER} category
 */
export function lastUserInformationStatusLabelDE(category) {
  if (category === LAST_USER_FILTER_CHECKIN) return "Eingecheckt";
  if (category === LAST_USER_FILTER_CHECKOUT) return "Ausgecheckt";
  if (category === LAST_USER_FILTER_PAUSE) return "Pause";
  return "Sonstiges";
}

/**
 * @param {unknown} lastActionTimeStamp PHP DateTime JSON
 * @returns {{ sortValue: number; display: string }}
 */
export function parseLastUserActionTimestampDisplay(lastActionTimeStamp) {
  if (!lastActionTimeStamp || typeof lastActionTimeStamp !== "object") {
    return { sortValue: 0, display: "—" };
  }
  const o = /** @type {Record<string, unknown>} */ (lastActionTimeStamp);
  const dateStr = o.date;
  const tz = String(o.timezone ?? "UTC").toUpperCase();
  if (typeof dateStr !== "string") return { sortValue: 0, display: "—" };
  const trimmed = dateStr.trim();
  const withT = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  let iso = withT;
  if (tz === "UTC" || tz === "Etc/UTC" || tz === "Etc/GMT" || tz === "GMT") {
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso)) {
      iso = `${iso}Z`;
    }
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { sortValue: 0, display: "—" };
  const sortValue = d.getTime();
  let display = "—";
  try {
    display = new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  } catch {
    display = d.toLocaleString("de-DE");
  }
  return { sortValue, display };
}

/**
 * @param {unknown} raw
 * @returns {{ timeTrackerId: number; username: string; userId: number | null; typeRaw: string; filterCategory: ReturnType<typeof lastUserInformationFilterCategory>; statusLabel: string; lastActionDisplay: string; sortValue: number } | null}
 */
export function normalizeLastUserInformationItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const idRaw = o.timeTrackerId;
  const timeTrackerId =
    typeof idRaw === "number" && Number.isFinite(idRaw)
      ? idRaw
      : parseInt(String(idRaw ?? ""), 10);
  if (!Number.isFinite(timeTrackerId)) return null;
  const username = String(o.username ?? "").trim() || "—";
  const uidRaw = o.userId;
  const userId =
    typeof uidRaw === "number" && Number.isFinite(uidRaw)
      ? uidRaw
      : /^\d+$/.test(String(uidRaw ?? "").trim())
        ? parseInt(String(uidRaw).trim(), 10)
        : null;
  const typeRaw = String(o.type ?? "").trim();
  const filterCategory = lastUserInformationFilterCategory(typeRaw);
  const { sortValue, display } = parseLastUserActionTimestampDisplay(o.lastActionTimeStamp);
  return {
    timeTrackerId,
    username,
    userId,
    typeRaw,
    filterCategory,
    statusLabel: lastUserInformationStatusLabelDE(filterCategory),
    lastActionDisplay: display,
    sortValue,
  };
}

/**
 * @param {unknown} raw
 */
export function parseLastUserInformationResponse(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const rows = /** @type {NonNullable<ReturnType<typeof normalizeLastUserInformationItem>>[]} */ (
    arr.map(normalizeLastUserInformationItem).filter(Boolean)
  );
  rows.sort((a, b) => b.sortValue - a.sortValue);
  return rows;
}

/**
 * @param {string} token
 * @returns {Promise<unknown>}
 */
export async function fetchTimetrackerLastUserInformation(token) {
  return timeTrackerGet(token, API_TIMETRACKER_LAST_USER_INFORMATION_PATH);
}

/**
 * Monthly timetracker list (GET, Bearer).
 * @param {string} token
 * @param {{ year: number; month: number; userId: number | null }} params month 1–12
 * @returns {Promise<unknown>} JSON body (expected array)
 */
export async function fetchTimeTrackerOverviewAll(token, params) {
  const qs = new URLSearchParams();
  qs.set(TIMETRACKER_OVERVIEW_QUERY_YEAR, String(params.year));
  qs.set(TIMETRACKER_OVERVIEW_QUERY_MONTH, String(params.month));
  if (params.userId != null && Number.isFinite(params.userId)) {
    qs.set(TIMETRACKER_OVERVIEW_QUERY_USER_ID, String(params.userId));
  }
  const path = `${API_TIMETRACKER_OVERVIEW_ALL_PATH}?${qs.toString()}`;
  return timeTrackerGet(token, path);
}

/**
 * Server-side totals for the given overview rows (POST body = same shape as `overview_all` items).
 * @param {string} token
 * @param {unknown[]} overviewRows
 * @returns {Promise<unknown>}
 */
export async function postTimeTrackerUserTotals(token, overviewRows) {
  return timeTrackerPostJson(token, API_TIMETRACKER_USER_TOTALS_PATH, overviewRows);
}
