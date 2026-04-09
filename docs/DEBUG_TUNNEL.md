# Expo: Metro mit `--tunnel`

## Projekt-Setup

- **`@expo/ngrok`** ist als **Dependency** eingetragen (nicht nur transitiv). Ohne lokales Paket kann `expo start --tunnel` mit Fehlern wie `Cannot read properties of undefined (reading 'body')` abbrechen.
- Start:
  ```bash
  npm run start:tunnel
  ```
  oder
  ```bash
  npx expo start --tunnel
  ```

## Wenn der Tunnel weiterhin fehlschlägt

1. **Ngrok-Authtoken** (kostenlos): [Dashboard → Your Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)  
   In **`.env`** (wird über `app.config.js` / dotenv geladen):
   ```env
   NGROK_AUTHTOKEN=dein_token_hier
   ```
   Terminal neu öffnen, dann erneut `npm run start:tunnel`.

2. **Dienste prüfen**  
   - https://status.ngrok.com/  
   - https://status.expo.dev/

3. **Netzwerk**  
   VPN, Firmen-Firewall oder Proxy können Tunnel blockieren — dann **`npx expo start --lan`** im gleichen WLAN nutzen.

4. **CLI aktualisieren**  
   ```bash
   npx expo@latest start --tunnel
   ```

---

## Fehler: `emulator-5562` / `cannot connect to 127.0.0.1:5562` (Windows)

Beim Start mit **`--tunnel`** ruft die Expo-CLI **`adb reverse`** für **alle** in `adb devices` gelisteten Android-Geräte auf. Steht dort ein **defekter oder alter Emulator** (z. B. `emulator-5562`, Verbindung abgelehnt / *connection refused*), **bricht der Tunnel** ab — **bevor** Ngrok fertig ist.

### So behebst du das

1. **Alle Android-Emulatoren beenden**, die du nicht aktiv nutzt (Android Studio → schließen).
2. ADB neu starten und Liste prüfen:
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```
3. Es sollen nur noch **ein lauffähiges Gerät** oder **`List of devices attached` leer** (wenn du nur mit **Expo Go auf dem iPhone** oder per **QR/Tunnel** ohne Android arbeitest) sinnvoll sein. **Offline**- oder **unauthorized**-Einträge entfernen (Emulator neu starten, USB neu stecken, ggf. PC neu starten).
4. Erneut:
   ```bash
   npm run start:tunnel
   ```

**Nur iOS / physisches Android per Tunnel:** Trotzdem kann ein **Geister-Eintrag** `emulator-…` in `adb devices` stören — Schritt 2–3 ist dann trotzdem nötig.

---

## Fehler: `Cannot read properties of undefined (reading 'body')`

Oft **Ngrok** (Ausfall, Rate-Limit, fehlendes Token). Zuerst **`NGROK_AUTHTOKEN`** in `.env` setzen (siehe oben), dann Status-Seiten prüfen.
