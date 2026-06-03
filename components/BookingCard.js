import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { catalogStatusButtonLabel } from "../api/bookingDetailStatus";
import {
  bookingPaymentStatusDisplayMeta,
  bookingProductDisplayMeta,
  bookingPhoneTelUri,
  isDetailLegMissing,
} from "../api/bookings";

/** Left accent when the active leg has no API detail status. */
const NO_DETAIL_STATUS_ACCENT = "#636366";

/** @typedef {"arrival" | "departure"} DayMode */

/**
 * @typedef {{ id: number; name: string; nameInternal: string; chipTone: string; position: number }} DetailStatusOption
 */

/**
 * @param {string | undefined} badgeId
 * @param {{ green: string; yellow: string; teal: string }} C
 */
function getBadgeMetaFromBookingBadge(badgeId, C) {
  if (badgeId === "Reingefahren") {
    return { color: C.green, bg: "rgba(48,209,88,0.15)", label: "Bestätigt" };
  }
  if (badgeId === "Valet") {
    return { color: C.teal, bg: "rgba(64,203,224,0.15)", label: "Valet" };
  }
  return { color: C.yellow, bg: "rgba(255,214,10,0.15)", label: "Änderung" };
}

/**
 * @param {"green" | "yellow" | "red" | "blue"} colorKey
 * @param {{ green: string; yellow: string; red: string; blue: string }} C
 */
function chipColors(colorKey, C) {
  if (colorKey === "green") {
    return { border: C.green, bg: "rgba(48,209,88,0.12)", activeBg: C.green };
  }
  if (colorKey === "red") {
    return { border: C.red, bg: "rgba(255,69,58,0.12)", activeBg: C.red };
  }
  if (colorKey === "blue") {
    return { border: C.blue, bg: "rgba(10,132,255,0.15)", activeBg: C.blue };
  }
  return { border: C.yellow, bg: "rgba(255,214,10,0.12)", activeBg: C.yellow };
}

/**
 * Left accent: API-mapped leg color for current list mode (`detailStatus.*.color`).
 * If the leg has no status from the API, uses neutral gray (not booking badge color).
 * @param {DayMode} mode
 * @param {{ detailStatus?: { arrival?: { color?: string; nameInternal?: string } | null; departure?: { color?: string; nameInternal?: string } | null } }} item
 * @param {string} fallbackHex when leg exists but color string missing
 */
function sideAccentColorForDayMode(mode, item, fallbackHex) {
  const leg = mode === "departure" ? item.detailStatus?.departure : item.detailStatus?.arrival;
  if (isDetailLegMissing(leg)) {
    return NO_DETAIL_STATUS_ACCENT;
  }
  const c = leg?.color;
  return typeof c === "string" && c.length > 0 ? c : fallbackHex;
}

function InfoCol({ label, value, mono, color, C }) {
  return (
    <View style={s.infoCol}>
      <Text style={[s.infoLabel, { color: C.text3 }]}>{label}</Text>
      <Text style={[s.infoVal, mono && s.mono, { color: color ?? C.text }]}>{value}</Text>
    </View>
  );
}

/**
 * @param {DayMode} dayMode
 * @param {boolean} allActive
 * @param {{ arrivalTime?: string; departureTime?: string; pax?: number }} item
 */
function compactTimeLabel(dayMode, allActive, item) {
  const arr = item.arrivalTime ?? "—";
  const dep = item.departureTime ?? "—";
  const pax = `${item.pax ?? 1} Pax`;
  if (allActive) {
    return `Ank. ${arr} · Rück. ${dep} · ${pax}`;
  }
  if (dayMode === "departure") {
    return `Rückreise ${dep} · ${pax}`;
  }
  return `Ankunft ${arr} · ${pax}`;
}

/**
 * @param {object} props
 * @param {ReturnType<typeof bookingProductDisplayMeta>} props.productMeta
 * @param {object | null} props.productChipColors
 * @param {ReturnType<typeof bookingPaymentStatusDisplayMeta>} props.payMeta
 * @param {object | null} props.payChipColors
 * @param {{ label: string; color: string; bg: string }} props.statusMeta
 */
function BookingTopBadges({ productMeta, productChipColors, payMeta, payChipColors, statusMeta }) {
  return (
    <View style={s.cardTopBadges}>
      {productMeta && productChipColors ? (
        <View style={[s.productChip, { backgroundColor: productChipColors.bg }]}>
          <Text style={[s.productChipText, { color: productChipColors.color }]}>
            {productMeta.label}
          </Text>
        </View>
      ) : null}
      {payMeta && payChipColors ? (
        <View style={[s.productChip, { backgroundColor: payChipColors.bg }]}>
          <Text style={[s.productChipText, { color: payChipColors.color }]}>
            {payMeta.label}
          </Text>
        </View>
      ) : null}
      <View style={[s.badge, { backgroundColor: statusMeta.bg }]}>
        <Text style={[s.badgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
      </View>
    </View>
  );
}

/**
 * @param {object} props
 * @param {object} props.item
 * @param {DayMode} props.dayMode
 * @param {boolean} props.allActive
 * @param {boolean} props.expanded
 * @param {() => void} props.onToggleExpand
 * @param {string} props.note Plain text (API `notice` stripped via `item.remark` until user edits)
 * @param {(id: string, note: string) => void} props.onChangeNote
 * @param {() => void} props.onPressSaveNote
 * @param {boolean} props.noteSaving
 * @param {readonly DetailStatusOption[]} props.detailStatusOptions
 * @param {(item: object, statusId: string) => Promise<void>} props.onSetDetailStatus
 * @param {boolean} props.detailStatusSaving
 * @param {() => void} props.onPressCashRegister
 * @param {boolean} props.hasHandoverProtocol
 * @param {() => void} props.onPressHandoverProtocol
 * @param {object} props.C
 */
export default function BookingCard({
  item,
  dayMode,
  allActive,
  expanded,
  onToggleExpand,
  note,
  onChangeNote,
  onPressSaveNote,
  noteSaving,
  detailStatusOptions,
  onSetDetailStatus,
  detailStatusSaving,
  onPressCashRegister,
  hasHandoverProtocol,
  onPressHandoverProtocol,
  C,
}) {
  const [pickedStatusId, setPickedStatusId] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    const leg =
      dayMode === "departure" ? item.detailStatus?.departure : item.detailStatus?.arrival;
    const internal = leg?.nameInternal ? String(leg.nameInternal).trim() : "";
    if (!internal) {
      setPickedStatusId(null);
      return;
    }
    const match = detailStatusOptions.find((o) => o.nameInternal === internal);
    setPickedStatusId(match ? String(match.id) : null);
  }, [
    dayMode,
    item.id,
    item.detailStatus?.arrival?.nameInternal,
    item.detailStatus?.departure?.nameInternal,
    detailStatusOptions,
  ]);

  const statusMeta = getBadgeMetaFromBookingBadge(item.badge, C);
  const productMeta = bookingProductDisplayMeta(item.product);
  const productChipColors = productMeta
    ? productMeta.key === "valet"
      ? { color: C.teal, bg: "rgba(64,203,224,0.15)" }
      : { color: C.blue, bg: "rgba(10,132,255,0.15)" }
    : null;
  const payMeta = bookingPaymentStatusDisplayMeta(item.paymentStatus);
  const payChipColors = payMeta
    ? payMeta.key === "fb"
      ? { color: C.green, bg: "rgba(48,209,88,0.15)" }
      : payMeta.key === "fo"
        ? { color: C.orange, bg: "rgba(255,159,10,0.2)" }
        : { color: C.text2, bg: "rgba(255,255,255,0.08)" }
    : null;
  const accentColor = sideAccentColorForDayMode(dayMode, item, statusMeta.color);
  const departureFirst = dayMode === "departure";

  const arrivalTimeCol = (
    <InfoCol label="Ankunft" value={item.arrivalTime ?? "—"} mono C={C} />
  );
  const departureTimeCol = (
    <InfoCol label="Rückreise" value={item.departureTime ?? "—"} mono C={C} />
  );
  const paxCol = <InfoCol label="Passagiere" value={String(item.pax ?? 1)} C={C} />;
  const daysCol = <InfoCol label="Tage" value={String(item.days)} C={C} />;

  const arrivalLegRow = (
    <View style={s.detailLegRow}>
      <Text style={[s.detailLegKey, { color: C.text3 }]}>Ankunft</Text>
      <Text
        style={[s.detailLegVal, { color: item.detailStatus?.arrival?.color ?? C.text3 }]}
        numberOfLines={2}
      >
        {item.detailStatus?.arrival?.label ?? "—"}
      </Text>
    </View>
  );
  const departureLegRow = (
    <View style={s.detailLegRow}>
      <Text style={[s.detailLegKey, { color: C.text3 }]}>Rückreise</Text>
      <Text
        style={[s.detailLegVal, { color: item.detailStatus?.departure?.color ?? C.text3 }]}
        numberOfLines={2}
      >
        {item.detailStatus?.departure?.label ?? "—"}
      </Text>
    </View>
  );

  const timeLine = compactTimeLabel(dayMode, allActive, item);
  const hasPhone = Boolean(item.phone);

  const handleCall = useCallback(() => {
    const uri = bookingPhoneTelUri(item.phone);
    if (!uri) return;
    void (async () => {
      try {
        const supported = await Linking.canOpenURL(uri);
        if (!supported) {
          Alert.alert("Anrufen", "Auf diesem Gerät ist kein Telefon verfügbar.");
          return;
        }
        await Linking.openURL(uri);
      } catch {
        Alert.alert("Anrufen", "Der Anruf konnte nicht gestartet werden.");
      }
    })();
  }, [item.phone]);

  return (
    <View
      style={[
        s.card,
        { backgroundColor: C.surface, borderColor: C.border },
        !expanded && s.cardCompact,
      ]}
    >
      <View style={[s.cardAccent, { backgroundColor: accentColor }]} />
      <View style={[s.cardInner, !expanded && s.cardInnerCompact]}>
        <Pressable
          onPress={onToggleExpand}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Buchung einklappen" : "Buchung ausklappen"}
          style={({ pressed }) => [
            expanded ? s.cardTop : s.compactHeader,
            pressed && { opacity: 0.92 },
            Platform.OS === "web" ? { cursor: "pointer" } : null,
          ]}
        >
          <View style={s.compactMain}>
            <Text style={[s.cardName, { color: C.text }]} numberOfLines={expanded ? 2 : 1}>
              {item.name}
            </Text>
            {expanded ? (
              <Text style={[s.cardId, { color: C.text2 }]}>
                {item.reference ?? item.id} · {item.pax} Pax
              </Text>
            ) : (
              <Text style={[s.compactTime, s.mono, { color: C.text2 }]} numberOfLines={1}>
                {timeLine}
              </Text>
            )}
          </View>
          <View style={s.compactHeaderRight}>
            <BookingTopBadges
              productMeta={productMeta}
              productChipColors={productChipColors}
              payMeta={payMeta}
              payChipColors={payChipColors}
              statusMeta={statusMeta}
            />
            {hasPhone ? (
              <TouchableOpacity
                onPress={handleCall}
                accessibilityRole="button"
                accessibilityLabel={`Anrufen ${item.phoneDisplay ?? item.phone}`}
                style={[s.callBtnCompact, { backgroundColor: C.green, borderColor: C.green }]}
              >
                <Text style={s.callBtnCompactIcon} allowFontScaling={false}>
                  📞
                </Text>
              </TouchableOpacity>
            ) : null}
            <Text style={[s.expandChevron, { color: C.text3 }]} allowFontScaling={false}>
              {expanded ? "▲" : "▼"}
            </Text>
          </View>
        </Pressable>

        {!expanded ? null : (
          <>
        {hasPhone ? (
          <TouchableOpacity
            onPress={handleCall}
            accessibilityRole="button"
            accessibilityLabel="Anrufen"
            style={[s.callBtn, { backgroundColor: "rgba(48,209,88,0.15)", borderColor: C.green }]}
          >
            <Text style={s.callBtnIcon} allowFontScaling={false}>
              📞
            </Text>
            <View style={s.callBtnTextWrap}>
              <Text style={[s.callBtnTitle, { color: C.green }]}>Anrufen</Text>
              {item.phoneDisplay ? (
                <Text style={[s.callBtnNumber, { color: C.text2 }]} numberOfLines={1}>
                  {item.phoneDisplay}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={s.infoRow}>
          {departureFirst ? (
            <>
              {departureTimeCol}
              {arrivalTimeCol}
              {paxCol}
              {daysCol}
            </>
          ) : (
            <>
              {arrivalTimeCol}
              {departureTimeCol}
              {paxCol}
              {daysCol}
            </>
          )}
        </View>
        <View style={s.infoRow}>
          <InfoCol label="Fahrzeug" value={item.plate} mono C={C} />
          <InfoCol label="Marke" value={item.brand} C={C} />
          <InfoCol label="✈ Flug" value={item.flight} color={C.teal} C={C} />
        </View>

        <View style={[s.detailBlock, { borderTopColor: C.border }]}>
          <Text style={[s.detailBlockTitle, { color: C.text2 }]}>Fahrzeug-Status</Text>
          {departureFirst ? (
            <>
              {departureLegRow}
              {arrivalLegRow}
            </>
          ) : (
            <>
              {arrivalLegRow}
              {departureLegRow}
            </>
          )}
          {item.detailStatus?.note ? (
            <Text style={[s.detailServerNote, { color: C.text2 }]} numberOfLines={4}>
              {item.detailStatus.note}
            </Text>
          ) : null}
        </View>

        <View style={[s.cardFooter, { borderTopColor: C.border }]}>
          <View style={s.priceRow}>
            <Text style={[s.price, { color: C.green }]}>{item.price}</Text>
            <TouchableOpacity
              onPress={onPressCashRegister}
              accessibilityRole="button"
              accessibilityLabel="Kasse — Zusatzkosten"
              style={[s.cashBtn, { backgroundColor: C.surface2, borderColor: C.border }]}
            >
              <Text style={s.cashBtnIcon} allowFontScaling={false}>
                💰
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[s.noteLabel, { color: C.text2, marginTop: 10 }]}>Notiz</Text>
          <TextInput
            style={[
              s.noteInput,
              {
                borderColor: C.border,
                backgroundColor: C.surface2,
                color: item.remarkColor ?? C.text,
              },
            ]}
            placeholder="Notiz"
            placeholderTextColor={C.text3}
            value={note}
            onChangeText={(value) => onChangeNote(item.id, value)}
            multiline
          />
          <Pressable
            onPress={onPressSaveNote}
            disabled={noteSaving}
            accessibilityRole="button"
            accessibilityLabel="Notiz speichern"
            style={({ pressed }) => [
              s.noteSaveBtn,
              { backgroundColor: C.blue, borderColor: C.blue },
              noteSaving && s.noteSaveBtnDisabled,
              Platform.OS === "web" && !noteSaving ? { cursor: "pointer" } : null,
              pressed && !noteSaving ? { opacity: 0.88 } : null,
            ]}
          >
            {noteSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.noteSaveBtnText}>Notiz speichern</Text>
            )}
          </Pressable>

          <Pressable
            onPress={onPressHandoverProtocol}
            accessibilityRole="button"
            accessibilityLabel={
              hasHandoverProtocol ? "Protokoll öffnen" : "Protokoll erstellen"
            }
            style={({ pressed }) => [
              s.protocolBtn,
              {
                backgroundColor: hasHandoverProtocol ? C.surface2 : C.teal,
                borderColor: hasHandoverProtocol ? C.border : C.teal,
              },
              Platform.OS === "web" ? { cursor: "pointer" } : null,
              pressed ? { opacity: 0.88 } : null,
            ]}
          >
            <Text
              style={[
                s.protocolBtnText,
                { color: hasHandoverProtocol ? C.text : "#04120a" },
              ]}
            >
              {hasHandoverProtocol ? "Protokoll öffnen" : "Protokoll erstellen"}
            </Text>
          </Pressable>
        </View>

        <View style={s.statusWrap}>
          <Text style={[s.noteLabel, { color: C.text2 }]}>Status</Text>
          {detailStatusOptions.length === 0 ? (
            <Text style={[s.statusEmpty, { color: C.text3 }]}>Keine Statusoptionen geladen.</Text>
          ) : null}
          {detailStatusSaving ? (
            <View style={s.statusSavingRow}>
              <ActivityIndicator color={C.blue} />
              <Text style={[s.statusSavingText, { color: C.text2 }]}>Status wird gespeichert …</Text>
            </View>
          ) : null}
          <View style={s.statusRow}>
            {detailStatusOptions.map((option) => {
              const tone = /** @type {"green" | "yellow" | "red" | "blue"} */ (option.chipTone);
              const pal = chipColors(tone, C);
              const selected = pickedStatusId === String(option.id);
              const chipTextColor =
                selected && (tone === "red" || tone === "blue")
                  ? "#fff"
                  : selected
                    ? "#04120a"
                    : C.text;
              const label = catalogStatusButtonLabel(option.name, option.nameInternal);
              return (
                <TouchableOpacity
                  key={option.id}
                  accessibilityRole="button"
                  disabled={detailStatusSaving}
                  style={[
                    s.statusChip,
                    { backgroundColor: pal.bg, borderColor: pal.border },
                    selected && { backgroundColor: pal.activeBg },
                    detailStatusSaving && s.statusChipDisabled,
                  ]}
                  onPress={() => void onSetDetailStatus(item, String(option.id))}
                >
                  <Text style={[s.statusChipText, { color: chipTextColor }]} numberOfLines={2}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, marginBottom: 10, flexDirection: "row", overflow: "hidden" },
  cardCompact: { marginBottom: 6, borderRadius: 12 },
  cardAccent: { width: 3 },
  cardInner: { flex: 1, padding: 14 },
  cardInnerCompact: { paddingVertical: 10, paddingHorizontal: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  compactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  compactMain: { flex: 1, minWidth: 0, paddingRight: 6 },
  compactHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 6,
    maxWidth: "58%",
  },
  compactTime: { fontSize: 12, fontWeight: "500", marginTop: 3 },
  expandChevron: { fontSize: 11, fontWeight: "700", marginLeft: 2 },
  callBtnCompact: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  callBtnCompactIcon: { fontSize: 18 },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  callBtnIcon: { fontSize: 22 },
  callBtnTextWrap: { flex: 1, minWidth: 0 },
  callBtnTitle: { fontSize: 15, fontWeight: "700" },
  callBtnNumber: { fontSize: 13, marginTop: 2, fontWeight: "500" },
  cardTopBadges: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" },
  cardName: { fontSize: 15, fontWeight: "600" },
  cardId: { fontSize: 11, fontFamily: "monospace", marginTop: 2 },
  productChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  productChipText: { fontSize: 11, fontWeight: "600" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  infoRow: { flexDirection: "row", marginBottom: 8 },
  detailBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  detailBlockTitle: { fontSize: 11, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  detailLegRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 6, gap: 8 },
  detailLegKey: { fontSize: 11, fontWeight: "600", width: 72, paddingTop: 1 },
  detailLegVal: { flex: 1, fontSize: 13, fontWeight: "600" },
  detailServerNote: { fontSize: 12, marginTop: 4, fontStyle: "italic" },
  infoCol: { flex: 1 },
  infoLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  infoVal: { fontSize: 13, fontWeight: "500" },
  mono: { fontFamily: "monospace", fontSize: 12 },
  cardFooter: { marginTop: 8, paddingTop: 10, borderTopWidth: 1 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  price: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  cashBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cashBtnIcon: { fontSize: 22 },
  statusWrap: { marginTop: 12 },
  noteLabel: { fontSize: 11, marginBottom: 6, fontWeight: "600" },
  statusRow: { flexDirection: "column", gap: 8, paddingBottom: 8 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    width: "100%",
    alignItems: "center",
  },
  statusChipText: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  statusChipDisabled: { opacity: 0.45 },
  statusEmpty: { fontSize: 12, marginBottom: 6 },
  statusSavingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  statusSavingText: { fontSize: 12, fontWeight: "500" },
  noteInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 72,
    textAlignVertical: "top",
  },
  noteSaveBtn: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  noteSaveBtnDisabled: { opacity: 0.55 },
  noteSaveBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  protocolBtn: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
  },
  protocolBtnText: { fontSize: 14, fontWeight: "600" },
});
