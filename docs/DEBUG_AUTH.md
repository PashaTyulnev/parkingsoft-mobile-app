# Login / Netzwerk debuggen

## Was „Network request failed“ meistens ist

Die App erreicht die URL unter `EXPO_PUBLIC_API_BASE_URL` nicht (falscher Host, Firewall, Server aus, falsches Protokoll).

### Standard (dieses Projekt)

- API-Basis: **`https://dev.parkingsoft.de`** ([Parkingsoft Dev](https://dev.parkingsoft.de/)) – erreichbar vom Handy über das Internet (kein LAN nötig).
- Die URL kommt aus **`app.config.js`** → `expo.extra.apiBaseUrl` (lädt `.env` mit **`override: true`**, damit eine alte **`EXPO_PUBLIC_*` System-Umgebungsvariable** unter Windows nicht dauerhaft `127.0.0.1` erzwingt).
- Nach Änderung an `.env` oder `app.config.js`: **`npx expo start -c`**

### Lokales Symfony (optional)

| Umgebung | Typische URL |
|----------|----------------|
| **PC-Browser / iOS Simulator** (Mac) | `http://127.0.0.1:8000` |
| **Android Emulator** | `http://10.0.2.2:8000` (Host-Rechner) |
| **Physisches Handy** | `http://<LAN-IP-des-PC>:8000` (gleiches WLAN) |

Passe `.env` an und starte Metro neu (`npx expo start -c`).

### In der App prüfen

- Beim Login erscheint jetzt eine **längere deutsche Fehlermeldung** mit der **vollen URL**.
- In **Dev** siehst du in der Konsole: `[auth] POST failed` mit `url` und Fehlerobjekt.

### Manuell testen (Terminal)

```bash
curl -sS -X POST "http://127.0.0.1:8000/api/external/auth" \
  -H "Content-Type: application/json" \
  -d '{"username":"USER","password":"PASS"}'
```

Wenn `curl` scheitert, liegt es nicht an der App.

### Automatisierte Tests

```bash
npm test
```

Prüft u. a. erfolgreichen Login, HTTP-Fehler und Netzwerk-Mapping (`api/__tests__/auth.test.js`).
