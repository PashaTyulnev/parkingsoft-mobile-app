import { API_AUTH_PATH, API_BASE_URL } from "./config";

const NETWORK_HINT_DE =
  "Android-Emulator: oft http://10.0.2.2:8000 statt 127.0.0.1. " +
  "Physisches Gerät: LAN-IP des PCs (z. B. 192.168.x.x). " +
  "Web: CORS am Backend. Prüfe EXPO_PUBLIC_API_BASE_URL in .env und ob der Server läuft.";

/**
 * Maps low-level fetch errors to a clearer message for the UI.
 * @param {unknown} err
 * @param {string} url
 * @returns {Error}
 */
export function toLoginNetworkError(err, url) {
  const msg = err && typeof err === "object" && "message" in err
    ? String(/** @type {{ message?: string }} */ (err).message)
    : String(err);

  const isNetwork =
    err instanceof TypeError ||
    msg.includes("Network request failed") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError");

  if (isNetwork) {
    return new Error(
      `Netzwerkfehler: Server nicht erreichbar unter ${url}. ${NETWORK_HINT_DE}`
    );
  }

  return err instanceof Error ? err : new Error(msg);
}

/**
 * Login using an injectable fetch (easier to test).
 * @param {typeof fetch} fetchFn
 * @param {{ baseUrl: string, authPath: string }} endpoints
 * @param {string} username
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function loginWithFetch(fetchFn, endpoints, username, password) {
  const base = endpoints.baseUrl.replace(/\/$/, "");
  const url = `${base}${endpoints.authPath}`;

  let res;
  try {
    res = await fetchFn(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });
  } catch (err) {
    const logDebug =
      typeof __DEV__ !== "undefined" &&
      __DEV__ &&
      typeof process !== "undefined" &&
      process.env.NODE_ENV !== "test";
    if (logDebug) {
      console.warn("[auth] POST failed", { url, err });
    }
    throw toLoginNetworkError(err, url);
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg =
      data.message ||
      data.detail ||
      data.error ||
      `Login fehlgeschlagen (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Login fehlgeschlagen");
  }

  if (!data.token || typeof data.token !== "string") {
    throw new Error("Kein Token in der Antwort");
  }

  return data.token;
}

/**
 * @param {string} username
 * @param {string} password
 * @returns {Promise<string>} Bearer token
 */
export async function login(username, password) {
  return loginWithFetch(global.fetch, {
    baseUrl: API_BASE_URL,
    authPath: API_AUTH_PATH,
  }, username, password);
}

/**
 * Full login URL (for debugging / support).
 * @returns {string}
 */
export function getLoginUrl() {
  return `${API_BASE_URL.replace(/\/$/, "")}${API_AUTH_PATH}`;
}
