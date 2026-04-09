import { API_BASE_URL, API_MY_SHIFTS_PATH } from "./config";
import { AuthError } from "./errors";

/** Fallback when API `color` is missing or invalid. */
export const DEFAULT_MY_SHIFT_ACCENT = "#3b82f6";

/** Known `status` values from API (extend when backend adds more). */
export const MY_SHIFT_STATUS_PENDING = "pending";

/** API `name` for planner-assigned rows (show friendlier label in UI). */
export const MY_SHIFT_NAME_API_MANUAL = "Manuelle Schicht";

/** Display text for {@link MY_SHIFT_NAME_API_MANUAL}. */
export const MY_SHIFT_NAME_DISPLAY_ASSIGNED = "Zugewiesene schicht";

/**
 * @param {unknown} rawName API `name` field
 * @returns {string} Label for cards (never exposes internal "Manuelle Schicht" wording)
 */
export function mapMyShiftDisplayName(rawName) {
  const t = String(rawName ?? "").trim();
  if (!t) return "—";
  if (t.toLowerCase() === MY_SHIFT_NAME_API_MANUAL.toLowerCase()) {
    return MY_SHIFT_NAME_DISPLAY_ASSIGNED;
  }
  return t;
}

/**
 * @param {unknown} status
 * @returns {string} German label for UI
 */
export function mapMyShiftStatusLabel(status) {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  if (s === MY_SHIFT_STATUS_PENDING) return "Ausstehend";
  if (s === "approved" || s === "confirmed" || s === "accepted") return "Bestätigt";
  if (s === "cancelled" || s === "canceled" || s === "rejected") return "Abgesagt";
  if (s === "completed" || s === "done") return "Abgeschlossen";
  if (!s) return "—";
  return String(status ?? "").trim() || "—";
}

/**
 * @param {unknown} iso
 * @returns {string} HH:mm or "—"
 */
export function extractTimeHMFromIso(iso) {
  if (iso == null) return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * @param {unknown} iso
 * @returns {string} Short German date label
 */
export function formatMyShiftDateDE(iso) {
  if (iso == null) return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(d);
  } catch {
    return d.toLocaleDateString("de-DE");
  }
}

/**
 * @param {unknown} raw
 * @returns {number}
 */
function parseShiftSortKey(raw) {
  if (raw == null) return 0;
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * @param {unknown} color
 * @returns {string} Hex accent color
 */
function sanitizeShiftAccentColor(color) {
  if (typeof color !== "string") return DEFAULT_MY_SHIFT_ACCENT;
  const t = color.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
  if (/^#[0-9A-Fa-f]{3}$/.test(t)) return t;
  return DEFAULT_MY_SHIFT_ACCENT;
}

/**
 * @param {unknown} raw
 * @returns {{ id: string; name: string; color: string; status: string; statusLabel: string; note: string; dateLabel: string; timeRange: string; sortKey: number; stampedLabel: string | null } | null}
 */
export function normalizeMyShiftItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const idRaw = o.id;
  const idStr =
    typeof idRaw === "number" && Number.isFinite(idRaw)
      ? String(idRaw)
      : String(idRaw ?? "").trim();
  if (!idStr) return null;

  const status = String(o.status ?? "").trim();
  const note = o.note != null ? String(o.note).trim() : "";

  const begin = extractTimeHMFromIso(o.shiftBegin);
  const end = extractTimeHMFromIso(o.shiftEnd);
  let stampedLabel = null;
  if (begin !== "—" && end !== "—") stampedLabel = `Erfasst: ${begin} – ${end}`;
  else if (begin !== "—") stampedLabel = `Erfasst ab: ${begin}`;
  else if (end !== "—") stampedLabel = `Erfasst bis: ${end}`;

  const tf = extractTimeHMFromIso(o.timeFrom);
  const tt = extractTimeHMFromIso(o.timeTo);
  const timeRange = tf !== "—" && tt !== "—" ? `${tf} – ${tt}` : tf !== "—" ? tf : tt;

  return {
    id: idStr,
    name: mapMyShiftDisplayName(o.name),
    color: sanitizeShiftAccentColor(o.color),
    status,
    statusLabel: mapMyShiftStatusLabel(status),
    note,
    dateLabel: formatMyShiftDateDE(o.date),
    timeRange,
    sortKey: parseShiftSortKey(o.date),
    stampedLabel,
  };
}

/**
 * @param {unknown} raw
 * @returns {NonNullable<ReturnType<typeof normalizeMyShiftItem>>[]}
 */
export function parseMyShiftsResponse(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const rows = /** @type {NonNullable<ReturnType<typeof normalizeMyShiftItem>>[]} */ (
    arr.map(normalizeMyShiftItem).filter(Boolean)
  );
  rows.sort((a, b) => a.sortKey - b.sortKey);
  return rows;
}

/**
 * @param {string} token
 * @returns {Promise<unknown>}
 */
export async function fetchMyShifts(token) {
  const url = `${API_BASE_URL}${API_MY_SHIFTS_PATH}`;
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
      `My shifts failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "My shifts failed");
  }

  return data;
}
