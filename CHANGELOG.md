# Changelog

## Unreleased

- Config: Default-API-Host auf **`https://parkingsoft.de`** geändert (vorher `dev.parkingsoft.de`); `api/config.js`, `app.config.js`, `.env.example`.

- Buchungen: **Notiz speichern** — `POST /api/external/bookings/edit` (multipart: `note` als HTML aus Klartext, `bookingId`, `reference`, `internalId` wie Detail-Status: `"null"` oder Zeilen-ID bei `isNative`); `api/bookingEdit.js`; Button unter dem Notizfeld.

- Buchungen: **paymentStatus** (`FB` / `FO` u. a.) aus API auf der Karte als Chip; `bookingPaymentStatusDisplayMeta` + Feld `paymentStatus` in `normalizeBooking`.

- Buchungen: **Ankünfte morgen** / **Rückreisen morgen** — zweite Umschaltzeile; `bookings/filter` mit lokalem **morgen** als `dateFrom`/`dateTo` und passendem `type`; „heute“-Buttons setzen wieder den aktuellen Tag; Listenüberschrift z. B. „Ankünfte morgen“ (`bookingsListDate` in `App.js`).

- Buchungen: **Kasse** (💰) — `GET …/deposit-register-data` liefert **`bookingDeposits`**; Liste im Modal daraus; nach **Hinzufügen** / **Löschen** erneuter GET zur Aktualisierung (`modalEntriesFromBookingDeposits`, `normalizeBookingDeposit`). **Speichern** `POST …/addDeposit`; **Löschen** `GET …/deleteDeposit?depositId=` (`redirect: manual`, 2xx/3xx = OK).

- Buchungen: Karten-Chip **Shuttle** / **Valet** aus API-`product` (`S` / `V`); `bookingProductDisplayMeta` in `api/bookings.js`.

- Zeiterfassung: `GET …/timetracker/last_user_information` — Team-Status (letzte Aktion pro Mitarbeiter: Check-in / Check-out / Pause) auf „Meine Zeiten“ mit Filterchips; Standardfilter **Eingecheckt**; `api/timetracker.js` + Tests.

- Dev: Dependency `@expo/ngrok`, Script `npm run start:tunnel`; Hinweise in `docs/DEBUG_TUNNEL.md` und optional `NGROK_AUTHTOKEN` in `.env.example` (stabilerer Expo-Tunnel).

- Login: optionale biometrische Anmeldung (Face ID / Fingerabdruck) nach normalem Login — Token in `expo-secure-store`, `expo-local-authentication`; Entsperr-Screen beim App-Start; Umschalten über Avatar-Menü „Konto“. Nur iOS/Android; Web unverändert (Passwort). Native Build: `expo prebuild` / EAS für Plugin-Config (Face-ID-Text).

- Navigation: Tab „Abwesenheiten“ vorübergehend inaktiv (nicht antippbar, kein Inhalt); `AbsencesPage`-Code aus `App.js` entfernt bis Reaktivierung.

- Schichten: `GET /api/external/my-shifts` (Bearer); `api/myShifts.js`, `ShiftsPage` mit API-Farbbalken, Datum/Zeit, Status, optional `shiftBegin`/`shiftEnd`; Tests `api/__tests__/myShifts.test.js`.
- Schichten: API-Name „Manuelle Schicht“ wird als „Zugewiesene schicht“ angezeigt.

- Bookings: linker Kartenbalken neutral grau (`#636366`), wenn für die aktive Liste kein API-`detailStatus` für Ankunft/Rückreise gesetzt ist.

- Auth: `GET /api/external/current` (Bearer) — `api/currentUser.js`; header shows name, username, initials on avatar; tests in `api/__tests__/currentUser.test.js`.
- Zeiterfassung: `GET …/timetracker/checkin` und `…/checkout` (Bearer); `GET …/timetracker/status` für aktuellen Zustand (`type`, PHP-`DateTime`-Felder `timestamp` / `mainCheckin`); Anzeige beim Tab „Meine Zeiten“ und nach Check-in/out; `api/timetracker.js`; Tests in `api/__tests__/timetracker.test.js`.
- Zeiterfassung: Monatsübersicht `GET …/timetracker/overview_all?year=&month=` und optional `userId=` (aus `current`, falls vorhanden); Liste eigener Schichten mit Monatsnavigation, Pull-to-refresh, Filter nach `username`; `EmployeeTimePage` + Tests.
- Zeiterfassung: `POST …/timetracker/user_totals` mit gefilterten Overview-Zeilen; Monatssummen (Netto/Brutto/Pause/Nacht) in `EmployeeTimePage`; `api/timetracker.js` + Tests.

- Bookings: **Notiz** multiline field under **price**; value = stripped API `notice` (`item.remark` / `remarkColor`) until edited locally; sent with detail-status POST.

- Default API host: `https://dev.parkingsoft.de`; resolved via `app.config.js` → `expo.extra.apiBaseUrl` and `expo-constants` (avoids stuck `127.0.0.1` from Metro cache / OS env).
- Bookings: map filter API body (`bookings[]`, `firstName`/`lastName`, `arrivalDate`/`Time`, `notice` HTML strip, `confirmed` → status chip, `reference` in card).
- Bookings: show `detailStatus` per leg (Ankunft / Rückreise) with API `name` and color from `color` (`btn-success` / `btn-warning` / …); optional `detailStatus.note`.
- Bookings: `noshow` / `btn-danger` → red badge; German label „Nicht erschienen (No-Show)“; docs in `docs/DETAIL_STATUS.md`.
- Bookings: detail leg labels from `nameInternal` — `*_finished` → „Erfolgreich“, `*_changed` → „Änderung!“ (plus No-Show mapping).
- Bookings: filter „Reingefahren“ uses API `detailStatus` — Ankünfte: nur `arrival` mit `*_finished`; Rückreisen: nur `departure` mit `*_finished`; Stat-Karte „Reingefahren“ zählt dasselbe.
- Bookings: filter „Änderung“ = API `detailStatus.arrival` mit `*_changed`; „Valet“ = `product === "V"`; Stat „Änderung“ zählt Ankunfts-Änderungen; `product` on normalized booking.
- Bookings: **Status** on card — `GET …/bookings/detail/status/all`, filter by tab; `POST …/bookings/detail/status` with `reference`, `internalId` (rules by `isNative` + `detailStatus.rowId`), `statusId`, `note`; `detailStatus.rowId` on normalized booking; `api/bookingDetailStatus.js` + tests.
- Bookings: after successful detail-status **POST**, merge 200 body (`newStatus`, `statusType`, `note`) into local booking state for immediate UI; then refresh list.
- Bookings: detail-status **POST** — `internalId` is string **`"null"`** when **`isNative`** is false; when native, use `detailStatus.rowId` as string or `"null"`; booking field **`isNative`** from API on normalized booking.
- Bookings: on **Rückreisen heute**, card shows **Rückreise** date/time before **Ankunft** (info row + Fahrzeug-Status order).
- Bookings: left card accent bar uses API `detailStatus` color for the active leg (arrival vs departure list mode); falls back to booking badge color if leg missing.
- Bookings: filter **Erwartet** (no API leg status for active tab) before **Reingefahren**; stat card + `isDetailLegMissing` / `BOOKING_FILTER_LABEL_EXPECTED` in `api/bookings.js`.
- Bookings: `GET /api/external/bookings/filter` with `dateFrom`/`dateTo` (today local), `type` arrival|departure, `limit` 100, `page` 1, Bearer token.
- External API auth (`POST /api/external/auth`) with token storage and Bearer authorization for bookings.
- Configurable API base URL via `EXPO_PUBLIC_API_BASE_URL` (see `.env.example`).
- Apple-style login screen; app shell only after successful token response.
- Fix Metro/Babel: `babel-preset-expo` as direct dependency; web support via `react-dom` + `react-native-web`.
- Reduce RN warnings: no horizontal `ScrollView` inside `FlatList` rows; stable list header / `renderItem`; safe `Intl` fallback.
- Login: clearer German messages on network failure; Jest tests for `api/auth.js`; debug notes in `docs/DEBUG_AUTH.md`.
