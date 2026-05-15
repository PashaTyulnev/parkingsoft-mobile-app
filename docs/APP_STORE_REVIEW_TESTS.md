# App Store Review – Testhinweise (Apple)

Dieses Dokument beschreibt, was für die **Apple App Review** getestet werden soll. Den **kurzen Auszug oder die komplette Checkliste** könnt ihr in **App Store Connect → App → App-Informationen → App-Überprüfung** unter **„Hinweise für die Überprüfung“** einfügen. **Demo-Zugangsdaten** dort unbedingt angeben (siehe unten).

---

## Voraussetzungen

- **Internetverbindung** (HTTPS zur Parkingsoft-API).
- **iPhone oder iPad** mit iOS-Version gemäß eurer minimalen Deployment-Target-Angabe in Xcode/EAS.
- Optional: **Face ID / Touch ID** für den Biometrie-Pfad (ohne Biometrie funktioniert die normale Passwort-Anmeldung).

---

## Demo-Konto (Pflicht für Review)

In **App Store Connect** bei den Review-Hinweisen eintragen:

| Feld | Wert |
|------|------|
| Benutzername | *(vom Betreiber bereitgestellter Test-User)* |
| Passwort | *(sicheres Test-Passwort)* |

Hinweis für Prüfer: Konto muss **aktive Berechtigungen** für Buchungen, Zeiterfassung und Schichten haben, damit alle Tabs sinnvoll befüllt sind.

---

## Testablauf (empfohlen)

### 1. Erster Start und Anmeldung

1. App starten → Anmeldebildschirm **„Parkingsoft“** erscheint.
2. Demo-**Benutzername** und **Passwort** eingeben → Anmelden.
3. Erwartung: Wechsel zur Hauptansicht mit **Kopfzeile** (Titel, Datum, Benutzer) und **unterer Tab-Leiste**.

### 2. Tab „Buchungen“

1. Tab **„Buchungen“** (erster Tab) prüfen.
2. Filter (z. B. „Alle“) und Tages-/Ankunft-/Abflug-Steuerung wie in der UI sichtbar nutzen.
3. Erwartung: Liste lädt oder zeigt verständlichen **Fehler-/Leerzustand**; keine Abstürze.
4. Optional: eine Buchung öffnen bzw. Aktionen nutzen, die für den Test-User freigeschaltet sind (z. B. Notizen, Status – je nach API).

### 3. Tab „Meine Zeiten“

1. Tab **„Meine Zeiten“** wählen.
2. Erwartung: Zeiterfassungsstatus und Übersicht laden; **Einchecken/Auschecken** nur testen, wenn vom Betreiber für den Demo-User erlaubt.
3. Monatsnavigation (vorheriger/nächster Monat) kurz anwählen.

### 4. Tab „Schichten“

1. Tab **„Schichten“** wählen.
2. Erwartung: Schichtliste oder klarer Leer-/Fehlerzustand.

### 5. Konto / Abmelden

1. **Avatar** oben rechts antippen.
2. **Abmelden** wählen (bzw. angebotene Konto-Aktionen).
3. Erwartung: Rückkehr zum **Login**; erneute Anmeldung mit Demo-Konto möglich.

### 6. Biometrie (optional)

- Wenn im Test-Konto **Biometrie** aktiviert wurde: App neu starten → ggf. Entsperr-Bildschirm → Face ID/Touch ID oder **„Mit Passwort fortfahren“** laut Anweisung testen.
- Ohne Biometrie: nur Passwort-Anmeldung aus Schritt 1.

### 7. Tab „Abwesenheiten“

- Derzeit **deaktiviert** (ausgegraut). Kein Absturz bei Antippen; keine Funktion erwartet.

---

## Typische Apple-Prüfpunkte (interne Checkliste)

- [ ] Kein Absturz bei Start ohne Netz (verständliche Fehlermeldung oder Ladezustand).
- [ ] Keine toten Schaltflächen in den **aktiven** Tabs.
- [ ] **Datenschutz**: nur serverseitig legitimierte Daten; keine versteckten Zahlungs- oder Abo-Fallen (falls nicht vorhanden, in Metadaten klar halten).
- [ ] **Hintergrundnutzung / Tracking**: nur was in **Datenschutzerklärung** und den iOS-Berechtigungstexten angegeben ist.
- [ ] **Anmeldung**: ohne Demo-Konto ist die Nutzung eingeschränkt – deshalb Demo-Zugang in den Review-Hinweisen Pflicht.

---

## Kurztext für „Hinweise für die Überprüfung“ (Copy-Paste-Vorlage)

```
Parkingsoft ist eine interne Mitarbeiter-App für Buchungen, Zeiten und Schichten.

Demo-Zugang:
Benutzername: <EINTRAGEN>
Passwort: <EINTRAGEN>

Bitte nach Login die Tabs „Buchungen“, „Meine Zeiten“ und „Schichten“ öffnen.
Abmelden über Avatar oben rechts → Abmelden.
Biometrie ist optional; Anmeldung mit Benutzername/Passwort reicht.
Tab „Abwesenheiten“ ist derzeit deaktiviert.

Die App benötigt eine aktive Internetverbindung zu unserem Backend.
```

---

*Letzte inhaltliche Ausrichtung anhand der App-Struktur (Login, drei aktive Tabs, Biometrie, Abmelden). Bei API- oder Rollenänderungen dieses Dokument und die Review-Hinweise anpassen.*
