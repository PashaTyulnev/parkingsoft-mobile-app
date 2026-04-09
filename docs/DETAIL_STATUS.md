# Fahrzeug-Status (`detailStatus`)

Die API liefert pro Buchung unter `detailStatus` getrennte Status für **Ankunft** (`arrivalStatus`) und **Rückreise** (`departureStatus`). Die App zeigt im Block **Fahrzeug-Status** je Bein eine **vereinheitlichte Beschriftung** aus `nameInternal` (Fallback: API-`name`) und die Farbe aus `color` (Bootstrap-Klassen wie `btn-success`).

### Anzeige in der App (nach `nameInternal`)

| Muster / `nameInternal` | Text in der App |
|-------------------------|-----------------|
| `*_finished` (z. B. `arrival_finished`, `departure_finished`) | **Erfolgreich** |
| `*_changed` (z. B. `arrival_changed`, `departure_changed`) | **Änderung!** |
| `noshow` | **Nicht erschienen (No-Show)** |
| sonst | API-Feld `name` unverändert |

Unbekannte Internals, die auf `*_finished` bzw. `*_changed` enden, werden ebenfalls auf **Erfolgreich** bzw. **Änderung!** gemappt.

## Beine unabhängig lesen

- **Nur Ankunft gesetzt, Rückreise `null`**  
  Der Ankunftsprozess hat bereits einen Status; die Rückreise ist für diesen Datensatz noch nicht gesetzt (oder nicht relevant). Beispiel: Ankunft erfolgreich (`arrival_finished`), Rückreise folgt später.

- **Beide gesetzt (grün / „finished“)**  
  Ankunft und Rückreise sind aus Sicht des Systems abgeschlossen (z. B. `arrival_finished` und `departure_finished`). Beispiel: **Berit Hartmann** – Ankunft und Rückreise jeweils erfolgreich.

- **Nur Ankunft sichtbar mit Erfolg**  
  Beispiel: **Mona Wikert** – Ankunft erfolgreich; Rückreise-Status fehlt noch (`null`).

- **Ankunft mit Hinweis / Änderung**  
  Gelb (`btn-warning`) bedeutet z. B. eine geänderte Ankunft (`arrival_changed`). Beispiel: **Gabriele Waldmann**.

- **Nur Rückreise gesetzt**  
  Beispiel: **Timon Gottschalk** – Rückreise erfolgreich; Ankunftsstatus kann leer sein, wenn der Fokus der Liste/Filter auf dem anderen Bein liegt oder der Ankunftsstatus nicht mitgeliefert wird.

## No-Show (`noshow`)

Wenn Ankunft oder Rückreise **nicht wahrgenommen** wurde, kann die API z. B. liefern:

- `name` / `nameInternal`: `noshow`
- `color`: `btn-danger` (in der App: **rot**)

No-Show kann **pro Bein** vorkommen (nur Ankunft, nur Rückreise oder beide).

## Farben (vereinfacht)

| API `color`   | Bedeutung in der App |
|---------------|----------------------|
| `btn-success` | positiv / abgeschlossen |
| `btn-warning` | Änderung / Aufmerksamkeit |
| `btn-danger`  | kritisch, z. B. No-Show |

Weitere Klassen (`btn-info`, `btn-primary`, …) werden auf die App-Palette gemappt; Details siehe `mapBootstrapBtnClassToColor` in `api/bookings.js`.

## Filter in der Buchungsliste (API)

Reihenfolge der Chips: **Alle** → **Erwartet** → **Reingefahren** → **Änderung** → **Valet**.

- **Erwartet** („statuslos“): Für das **aktive Bein** (Ankunft bzw. Rückreise je nach Tab) liefert die API **keinen** Status (`arrivalStatus` / `departureStatus` fehlt oder ist nicht darstellbar) – typisch: Fahrzeug noch nicht eingecheckt bzw. Rückreise-Bein noch nicht gesetzt.
- **Reingefahren**: Erfolgreich abgeschlossenes Bein (`*_finished`).
- **Ankünfte heute** / **Rückreisen heute**: bei **Reingefahren** bezieht sich das auf **Ankunfts-** bzw. **Rückreise-**Bein.

**Alle** zeigt die komplette Liste (API-Filter Tag/Typ wie bisher).

**Änderung** filtert nach **API-Ankunftsstatus** mit Änderung (`nameInternal` endet auf `_changed`) – unabhängig vom Tab.

**Valet** filtert nach **`product === "V"`**.

Die **oberen** Filterchips richten sich nach **API** wie oben.

## Status setzen (API)

Nach Login lädt die App **`GET /api/external/bookings/detail/status/all`** (Bearer) und zeigt auf der Karte passend zum Tab nur passende Einträge:

- **Ankünfte:** `arrival_*` und **noshow**
- **Rückreisen:** `departure_*` und **noshow**

Tipp auf einen Button sendet **`POST /api/external/bookings/detail/status`** mit JSON:

| Feld | Bedeutung |
|------|-----------|
| `reference` | Aus der Buchung: Feld **`reference`** |
| `internalId` | Wenn **`isNative === false`**: immer der String **`"null"`**. Wenn **`isNative === true`**: String mit **`detailStatus.id`**, sonst ebenfalls **`"null"`**. |
| `statusId` | ID des gewählten Status aus der Statusliste (z. B. `"1"`) |
| `note` | Darf leer sein (`""`); optional Inhalt aus dem Notizfeld der Karte |

Nach Erfolg wertet die App die **200-Response** sofort aus (`newStatus`, `statusType`, `note`) und **aktualisiert die Karte ohne Warten** auf den erneuten Listenabruf. Anschließend läuft wie bisher ein **Refresh** der Liste zur Abstimmung mit dem Server.

`detailStatus.rowId` kommt aus dem Filter-Response (`detailStatus.id`).
