import { Platform } from "react-native";
import { API_BASE_URL, API_BOOKINGS_EDIT_PATH } from "./config";
import { AuthError } from "./errors";

/** API expects literal string `"null"` for `internalId` when no detail row id (non-native). */
export const BOOKING_EDIT_INTERNAL_ID_STRING_NULL = "null";

/**
 * Plain text from the app editor → minimal HTML for `note` (API expects HTML).
 * @param {string} plain
 * @returns {string}
 */
export function plainNoteToEditNoticeHtml(plain) {
  const t = String(plain ?? "");
  const escaped = t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r\n|\r|\n/g, "<br/>");
  return `<div>${escaped}</div>`;
}

/**
 * `internalId` for bookings/edit — same rules as detail-status when native.
 * @param {{ isNative?: boolean; detailStatus?: { rowId?: number | null } | null } | null | undefined} item
 * @returns {string}
 */
export function bookingEditInternalIdFromItem(item) {
  if (!item || typeof item !== "object") return BOOKING_EDIT_INTERNAL_ID_STRING_NULL;
  if (item.isNative !== true) return BOOKING_EDIT_INTERNAL_ID_STRING_NULL;
  const rid = item.detailStatus?.rowId;
  if (rid != null && Number.isFinite(Number(rid))) return String(rid);
  return BOOKING_EDIT_INTERNAL_ID_STRING_NULL;
}

/**
 * @param {{
 *   note: string;
 *   bookingId: number;
 *   reference: string;
 *   internalId: string;
 * }} fields
 * @returns {FormData}
 */
export function buildBookingEditFormData(fields) {
  const form = new FormData();
  form.append("note", fields.note);
  form.append("bookingId", String(fields.bookingId));
  form.append("reference", String(fields.reference ?? "").trim());
  form.append("internalId", fields.internalId);
  return form;
}

/**
 * Multipart body for environments where `fetch` + `FormData` does not send correctly (e.g. RN Web).
 * @param {{
 *   note: string;
 *   bookingId: number;
 *   reference: string;
 *   internalId: string;
 * }} fields
 * @returns {{ body: string; contentType: string }}
 */
export function buildBookingEditMultipartBody(fields) {
  const boundary = `----PSBookingEdit${Date.now()}${Math.random().toString(36).slice(2, 11)}`;
  const crlf = "\r\n";
  const part = (name, value) =>
    `--${boundary}${crlf}Content-Disposition: form-data; name="${name}"${crlf}${crlf}${String(value ?? "")}${crlf}`;
  const body =
    part("note", fields.note) +
    part("bookingId", String(fields.bookingId)) +
    part("reference", String(fields.reference ?? "").trim()) +
    part("internalId", fields.internalId) +
    `--${boundary}--${crlf}`;
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

/**
 * POST booking note edit (multipart). On **web**, sends a manual multipart body; native uses `FormData`.
 * @param {string} token
 * @param {{
 *   note: string;
 *   bookingId: number;
 *   reference: string;
 *   internalId: string;
 * }} fields
 * @returns {Promise<unknown>}
 */
export async function postBookingEdit(token, fields) {
  const url = `${API_BASE_URL}${API_BOOKINGS_EDIT_PATH}`;
  const isWeb = Platform.OS === "web";

  let res;
  if (isWeb) {
    const { body, contentType } = buildBookingEditMultipartBody(fields);
    res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body,
    });
  } else {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: buildBookingEditFormData(fields),
    });
  }

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
      `Booking edit failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Booking edit failed");
  }

  return data;
}
