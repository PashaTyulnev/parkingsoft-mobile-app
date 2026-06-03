import Constants from "expo-constants";

const DEFAULT_API_BASE = "https://parkingsoft.de";

/**
 * @returns {string | null}
 */
function apiBaseFromExpoExtra() {
  const extra =
    Constants.expoConfig?.extra ??
    Constants.manifest2?.extra ??
    Constants.manifest?.extra;
  const v = extra?.apiBaseUrl;
  return typeof v === "string" && v.length > 0 ? v.replace(/\/$/, "") : null;
}

/**
 * Metro inlines EXPO_PUBLIC_* at bundle time; extra comes from app.config.js (runtime).
 * Order: extra (authoritative after reload) → inlined env → default dev host.
 */
const fromExtra = apiBaseFromExpoExtra();
const fromEnv =
  typeof process.env.EXPO_PUBLIC_API_BASE_URL === "string" &&
  process.env.EXPO_PUBLIC_API_BASE_URL.length > 0
    ? process.env.EXPO_PUBLIC_API_BASE_URL.replace(/\/$/, "")
    : null;

export const API_BASE_URL = (fromExtra ?? fromEnv ?? DEFAULT_API_BASE).replace(
  /\/$/,
  ""
);

export const API_AUTH_PATH = "/api/external/auth";

/** Logged-in user profile (GET, Bearer). */
export const API_CURRENT_USER_PATH = "/api/external/current";

/** Current user's planned shifts (GET, Bearer). */
export const API_MY_SHIFTS_PATH = "/api/external/my-shifts";

/** Filtered bookings (date + type). */
export const API_BOOKINGS_FILTER_PATH =
  process.env.EXPO_PUBLIC_API_BOOKINGS_FILTER_PATH ??
  "/api/external/bookings/filter";

/** Search bookings (query string + paging). */
export const API_BOOKINGS_SEARCH_PATH =
  process.env.EXPO_PUBLIC_API_BOOKINGS_SEARCH_PATH ??
  "/api/external/bookings/search";

/** All bookings, paginated (GET, Bearer). */
export const API_BOOKINGS_ALL_PATH =
  process.env.EXPO_PUBLIC_API_BOOKINGS_ALL_PATH ??
  "/api/external/bookings/all";

/** All selectable detail-status definitions (GET). */
export const API_BOOKINGS_DETAIL_STATUS_ALL_PATH =
  "/api/external/bookings/detail/status/all";

/** Set booking detail status (POST). */
export const API_BOOKINGS_DETAIL_STATUS_PATH =
  "/api/external/bookings/detail/status";

/** Edit booking notice / note (POST multipart/form-data, Bearer). */
export const API_BOOKINGS_EDIT_PATH = "/api/external/bookings/edit";

/** Deposit register meta + purposes for cash UI (GET ?bookingId=). */
export const API_BOOKING_DEPOSIT_REGISTER_DATA_PATH =
  "/api/external/booking/deposit-register-data";

/** Add cash-register line (POST multipart/form-data, Bearer). */
export const API_DEPOSIT_REGISTER_ADD_PATH =
  "/api/external/deposit-register/addDeposit";

/** Delete deposit line (GET ?depositId=, Bearer). May respond with redirect. */
export const API_DEPOSIT_REGISTER_DELETE_PATH =
  "/api/external/deposit-register/deleteDeposit";

/** Booking handover / return protocol (GET/POST multipart). */
export const API_BOOKINGS_PROTOCOL_PATH_PREFIX = "/api/external/bookings";

/** Time tracker (GET, Bearer). */
export const API_TIMETRACKER_CHECKIN_PATH = "/api/external/timetracker/checkin";
export const API_TIMETRACKER_CHECKOUT_PATH =
  "/api/external/timetracker/checkout";

/** Current timetracker state (GET, Bearer). */
export const API_TIMETRACKER_STATUS_PATH = "/api/external/timetracker/status";

/** Last action per user for team status (GET, Bearer). */
export const API_TIMETRACKER_LAST_USER_INFORMATION_PATH =
  "/api/external/timetracker/last_user_information";

/** Monthly overview (GET, Bearer). Query: year, month, optional userId. */
export const API_TIMETRACKER_OVERVIEW_ALL_PATH =
  "/api/external/timetracker/overview_all";

/** Aggregated totals for posted overview rows (POST, Bearer). Body: JSON array. */
export const API_TIMETRACKER_USER_TOTALS_PATH =
  "/api/external/timetracker/user_totals";
