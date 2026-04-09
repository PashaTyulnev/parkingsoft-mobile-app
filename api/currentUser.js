import { API_BASE_URL, API_CURRENT_USER_PATH } from "./config";
import { AuthError } from "./errors";

/**
 * @param {unknown} raw
 * @returns {{ id: number | null; username: string; firstName: string; lastName: string; displayName: string; initials: string } | null}
 */
export function normalizeCurrentUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const idRaw = o.id;
  let id = null;
  if (typeof idRaw === "number" && Number.isFinite(idRaw)) id = idRaw;
  else if (typeof idRaw === "string" && /^\d+$/.test(idRaw.trim())) {
    id = parseInt(idRaw.trim(), 10);
  }
  const username = String(o.username ?? "").trim();
  const firstName = String(o.firstName ?? "").trim();
  const lastName = String(o.lastName ?? "").trim();
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || username || "—";
  let initials = "—";
  if (firstName && lastName) {
    initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
  } else if (username.length >= 2) {
    initials = username.slice(0, 2).toUpperCase();
  } else if (username.length === 1) {
    initials = username.toUpperCase();
  }
  return { id, username, firstName, lastName, displayName, initials };
}

/**
 * GET current user (Bearer).
 * @param {string} token
 */
export async function fetchCurrentUser(token) {
  const url = `${API_BASE_URL}${API_CURRENT_USER_PATH}`;
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
      `Current user failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Current user failed");
  }

  const user = normalizeCurrentUser(data);
  if (!user || !user.username) {
    throw new Error("Invalid current user response");
  }
  return user;
}
