import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { numericBookingIdFromListItem } from "../api/bookings";
import {
  buildAddDepositFormData,
  depositKindToDepositType,
  fetchDeleteDeposit,
  fetchDepositRegisterData,
  germanDateDdMmYyyyToIso,
  modalEntriesFromBookingDeposits,
  postAddDeposit,
} from "../api/depositRegister";
import { AuthError } from "../api/errors";
import { useAuth } from "../contexts/AuthContext";

const ENTRY_KINDS = [
  { id: "income", label: "Einnahme" },
  { id: "expense", label: "Ausgabe" },
];

/** Labels = API `paymentType` (multipart POST). */
const PAYMENT_TYPES = [
  { id: "bar", label: "Bar" },
  { id: "sumup", label: "Sumup" },
  { id: "paypal", label: "Paypal" },
  { id: "invoice", label: "Rechnung" },
  { id: "account_db", label: "Konto (DB)" },
  { id: "open", label: "Offen" },
];

function formatDeDate(d) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${day}.${month}.${y}`;
}

function formatDeDateTime(d) {
  return `${formatDeDate(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function parseAmountEuros(raw) {
  const t = String(raw ?? "").trim().replace(",", ".");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n : NaN;
}

function formatEuro(n) {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/**
 * Summe field (de-DE) from numeric defaultCost — applied immediately on purpose chip tap.
 * @param {number} n
 */
function formatSummeFromDefaultCost(n) {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("de-DE", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * @param {Record<string, unknown> | null | undefined} b
 * @returns {string | null}
 */
function displayNameFromDepositBooking(b) {
  if (!b || typeof b !== "object") return null;
  const fn = String(b.firstName ?? "").trim();
  const ln = String(b.lastName ?? "").trim();
  const full = [fn, ln].filter(Boolean).join(" ");
  return full || null;
}

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {{ id?: string | number; reference?: string; name?: string } | null} props.booking
 * @param {object} props.C theme (same shape as App.js)
 */
export default function BookingCashModal({ visible, onClose, booking, C }) {
  const { token, logout } = useAuth();

  const refLabel = booking?.reference ?? String(booking?.id ?? "—");
  const listCustomerName = booking?.name ?? "—";

  const [depositData, setDepositData] = useState(/** @type {Awaited<ReturnType<typeof fetchDepositRegisterData>> | null} */ (null));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null));
  const [idError, setIdError] = useState(/** @type {string | null} */ (null));

  const [entries, setEntries] = useState(/** @type {object[]} */ ([]));
  const [kindId, setKindId] = useState("income");
  const [paymentId, setPaymentId] = useState("bar");
  const [entryDate, setEntryDate] = useState(() => formatDeDate(new Date()));
  const [purpose, setPurpose] = useState("");
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [selectedPurposeId, setSelectedPurposeId] = useState(/** @type {number | null} */ (null));
  const [addingDeposit, setAddingDeposit] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState(/** @type {string | null} */ (null));

  const scrollRef = useRef(/** @type {import("react-native").ScrollView | null} */ (null));
  const newEntrySectionYRef = useRef(0);

  const onNewEntrySectionLayout = useCallback((e) => {
    newEntrySectionYRef.current = e.nativeEvent.layout.y;
  }, []);

  const scrollToNewEntryForm = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const y = newEntrySectionYRef.current;
        scrollRef.current?.scrollTo({
          y: Math.max(0, y - 10),
          animated: true,
        });
      });
    });
  }, []);

  const bookingNumericId = useMemo(
    () => (booking ? numericBookingIdFromListItem(booking) : null),
    [booking?.id]
  );

  useEffect(() => {
    if (!visible || !booking) {
      return;
    }

    const bid = numericBookingIdFromListItem(booking);
    if (bid == null) {
      setIdError(
        "Für die Kasse wird eine numerische Buchungs-ID benötigt (API `id`)."
      );
      setLoadError(null);
      setDepositData(null);
      setLoading(false);
      setEntries([]);
      setSelectedPurposeId(null);
      setPurpose("");
      setDescription("");
      setAmountText("");
      setKindId("income");
      setPaymentId("bar");
      return;
    }

    setIdError(null);

    if (!token) {
      setLoadError("Nicht angemeldet.");
      setDepositData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setDepositData(null);
    setEntries([]);
    setSelectedPurposeId(null);
    setPurpose("");
    setDescription("");
    setAmountText("");
    setKindId("income");
    setPaymentId("bar");
    setEntryDate(formatDeDate(new Date()));

    (async () => {
      try {
        const data = await fetchDepositRegisterData(token, bid);
        if (cancelled) return;
        setDepositData(data);
        setEntries(modalEntriesFromBookingDeposits(data.bookingDeposits));
      } catch (e) {
        if (cancelled) return;
        if (e instanceof AuthError) {
          await logout();
          onClose();
          return;
        }
        setLoadError(e instanceof Error ? e.message : "Laden fehlgeschlagen");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [visible, booking, token, logout, onClose]);

  const apiBooking = depositData?.booking ?? null;
  const headerRef =
    apiBooking && apiBooking.reference != null
      ? String(apiBooking.reference).trim() || refLabel
      : refLabel;
  const headerName =
    displayNameFromDepositBooking(apiBooking) ?? listCustomerName;

  const totalEuros = useMemo(() => {
    return entries.reduce((sum, e) => {
      const sign = e.kind === "expense" ? -1 : 1;
      return sum + sign * e.amount;
    }, 0);
  }, [entries]);

  const paymentLabelById = useMemo(() => {
    const m = {};
    for (const p of PAYMENT_TYPES) m[p.id] = p.label;
    return m;
  }, []);

  const purposes = depositData?.depositPurposes ?? [];

  const pickQuickPurpose = useCallback(
    (p) => {
      setSelectedPurposeId(p.id);
      setPurpose(p.name);
      setDescription(p.name);
      setKindId(p.isReceivingPurpose ? "expense" : "income");
      if (p.defaultCost != null) {
        setAmountText(formatSummeFromDefaultCost(p.defaultCost));
      } else {
        setAmountText("");
      }
      scrollToNewEntryForm();
    },
    [scrollToNewEntryForm]
  );

  const handleAdd = useCallback(async () => {
    if (selectedPurposeId == null) {
      Alert.alert("Kasse", "Bitte einen Zweck über die Schnellauswahl wählen.");
      return;
    }
    if (bookingNumericId == null || !token) {
      Alert.alert("Kasse", "Buchung oder Sitzung ungültig.");
      return;
    }
    const isoDate = germanDateDdMmYyyyToIso(entryDate);
    if (!isoDate) {
      Alert.alert("Kasse", "Bitte Datum als TT.MM.JJJJ eingeben.");
      return;
    }
    const amount = parseAmountEuros(amountText);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Kasse", "Bitte eine gültige Summe eingeben.");
      return;
    }
    const pay = paymentLabelById[paymentId] ?? PAYMENT_TYPES[0].label;
    const form = buildAddDepositFormData({
      bookingId: bookingNumericId,
      isMainFee: false,
      depositType: depositKindToDepositType(
        /** @type {"income" | "expense"} */ (kindId)
      ),
      depositDate: isoDate,
      paymentType: pay,
      depositPurpose: selectedPurposeId,
      description: description.trim() || purpose || "",
      deposit: amount,
    });

    setAddingDeposit(true);
    try {
      await postAddDeposit(token, form);
      setAmountText("");
      try {
        const refreshed = await fetchDepositRegisterData(token, bookingNumericId);
        setDepositData(refreshed);
        setEntries(modalEntriesFromBookingDeposits(refreshed.bookingDeposits));
      } catch (refErr) {
        if (refErr instanceof AuthError) {
          await logout();
          onClose();
          return;
        }
        Alert.alert(
          "Kasse",
          "Eintrag gespeichert. Liste wird beim nächsten Öffnen der Kasse aktualisiert."
        );
      }
    } catch (e) {
      if (e instanceof AuthError) {
        await logout();
        onClose();
        return;
      }
      Alert.alert("Kasse", e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setAddingDeposit(false);
    }
  }, [
    selectedPurposeId,
    bookingNumericId,
    token,
    entryDate,
    amountText,
    description,
    purpose,
    paymentId,
    kindId,
    paymentLabelById,
    logout,
    onClose,
  ]);

  const confirmDelete = useCallback(
    (localId) => {
      const row = entries.find((e) => e.id === localId);
      const serverId =
        row && typeof row.depositServerId === "number" && Number.isFinite(row.depositServerId)
          ? row.depositServerId
          : null;
      const title = serverId != null ? "Eintrag löschen?" : "Aus Liste entfernen?";
      const message =
        serverId != null
          ? "Der Eintrag wird auf dem Server gelöscht."
          : "Keine Server-ID (z. B. Antwort nach Hinzufügen ohne id) — nur aus der Liste entfernen.";

      Alert.alert(title, message, [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschen",
          style: "destructive",
          onPress: () => {
            void (async () => {
              if (serverId != null && token) {
                setDeletingEntryId(localId);
                try {
                  await fetchDeleteDeposit(token, serverId);
                  if (bookingNumericId != null) {
                    try {
                      const refreshed = await fetchDepositRegisterData(
                        token,
                        bookingNumericId
                      );
                      setDepositData(refreshed);
                      setEntries(
                        modalEntriesFromBookingDeposits(refreshed.bookingDeposits)
                      );
                    } catch {
                      setEntries((prev) =>
                        prev.filter((e) => e.id !== localId)
                      );
                    }
                  } else {
                    setEntries((prev) => prev.filter((e) => e.id !== localId));
                  }
                } catch (e) {
                  if (e instanceof AuthError) {
                    await logout();
                    onClose();
                    return;
                  }
                  Alert.alert(
                    "Kasse",
                    e instanceof Error ? e.message : "Löschen fehlgeschlagen"
                  );
                } finally {
                  setDeletingEntryId(null);
                }
              } else {
                setEntries((prev) => prev.filter((e) => e.id !== localId));
              }
            })();
          },
        },
      ]);
    },
    [entries, token, logout, onClose, bookingNumericId]
  );

  if (!booking) return null;

  const payHint =
    depositData != null
      ? depositData.bookingIsPayed
        ? "Buchung laut API bezahlt"
        : "Buchung laut API nicht bezahlt"
      : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]}>
        <View style={[s.header, { borderBottomColor: C.border }]}>
          <View style={s.headerTextWrap}>
            <Text style={[s.title, { color: C.text }]} numberOfLines={1}>
              Kasse für Buchung #{headerRef}
            </Text>
            <Text style={[s.subtitle, { color: C.text2 }]} numberOfLines={2}>
              {headerName}
            </Text>
            {payHint ? (
              <Text style={[s.payHint, { color: C.text3 }]} numberOfLines={1}>
                {payHint}
              </Text>
            ) : null}
            <Text style={[s.total, { color: C.green }]}>Gesamt {formatEuro(totalEuros)}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Schließen"
            style={[s.closeBtn, { backgroundColor: C.surface2 }]}
          >
            <Text style={[s.closeBtnText, { color: C.text }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.loaderStrip}>
            <ActivityIndicator color={C.blue} />
            <Text style={[s.loaderText, { color: C.text2 }]}>Kasse wird geladen …</Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {idError ? (
            <View style={[s.banner, { borderColor: C.red, backgroundColor: "rgba(255,69,58,0.12)" }]}>
              <Text style={[s.bannerText, { color: C.red }]}>{idError}</Text>
            </View>
          ) : null}

          {loadError ? (
            <View style={[s.banner, { borderColor: C.yellow, backgroundColor: "rgba(255,214,10,0.12)" }]}>
              <Text style={[s.bannerText, { color: C.yellow }]}>{loadError}</Text>
            </View>
          ) : null}

          <Text style={[s.sectionLabel, { color: C.text2 }]}>Schnellauswahl (Zweck)</Text>
          {!idError && !loadError && !loading && purposes.length === 0 ? (
            <Text style={[s.emptyList, { color: C.text3 }]}>
              Keine Zwecke mit „displayOnBookingsPage“ für diese Buchung.
            </Text>
          ) : null}
          <View style={s.chipGrid}>
            {purposes.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => pickQuickPurpose(p)}
                style={({ pressed }) => [
                  s.quickChip,
                  { backgroundColor: C.surface2, borderColor: C.border },
                  pressed && { opacity: 0.85 },
                  selectedPurposeId === p.id && {
                    borderColor: C.blue,
                    backgroundColor: "rgba(10,132,255,0.2)",
                  },
                ]}
              >
                <Text style={[s.quickChipText, { color: C.text }]} numberOfLines={3}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View
            onLayout={onNewEntrySectionLayout}
            collapsable={false}
            style={s.newEntrySection}
          >
          <Text style={[s.sectionLabel, { color: C.text2, marginTop: 8 }]}>Neuer Eintrag</Text>

          <Text style={[s.fieldLabel, { color: C.text3 }]}>Art</Text>
          <View style={s.segmentRow}>
            {ENTRY_KINDS.map((k) => (
              <TouchableOpacity
                key={k.id}
                onPress={() => setKindId(k.id)}
                style={[
                  s.segment,
                  { borderColor: C.border, backgroundColor: C.surface },
                  kindId === k.id && { backgroundColor: C.blue, borderColor: C.blue },
                ]}
              >
                <Text
                  style={[
                    s.segmentText,
                    { color: C.text2 },
                    kindId === k.id && { color: "#fff", fontWeight: "700" },
                  ]}
                >
                  {k.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.fieldLabel, { color: C.text3 }]}>Datum</Text>
          <TextInput
            value={entryDate}
            onChangeText={setEntryDate}
            placeholder="TT.MM.JJJJ"
            placeholderTextColor={C.text3}
            style={[s.input, { borderColor: C.border, backgroundColor: C.surface, color: C.text }]}
          />

          <Text style={[s.fieldLabel, { color: C.text3 }]}>Typ (Bezahlart)</Text>
          <View style={s.segmentRow}>
            {PAYMENT_TYPES.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setPaymentId(p.id)}
                style={[
                  s.segment,
                  { borderColor: C.border, backgroundColor: C.surface },
                  paymentId === p.id && { backgroundColor: C.teal, borderColor: C.teal },
                ]}
              >
                <Text
                  style={[
                    s.segmentText,
                    { color: C.text2 },
                    paymentId === p.id && { color: "#04120a", fontWeight: "700" },
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.fieldLabel, { color: C.text3 }]}>Zweck (Auswahl)</Text>
          <Text style={[s.purposeReadout, { color: C.text, backgroundColor: C.surface2 }]}>
            {purpose || "—"}
          </Text>

          <Text style={[s.fieldLabel, { color: C.text3 }]}>Beschreibung</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Beschreibung"
            placeholderTextColor={C.text3}
            multiline
            style={[
              s.textArea,
              { borderColor: C.border, backgroundColor: C.surface, color: C.text },
            ]}
          />

          <Text style={[s.fieldLabel, { color: C.text3 }]}>Summe</Text>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0,00"
            placeholderTextColor={C.text3}
            keyboardType="decimal-pad"
            style={[s.input, { borderColor: C.border, backgroundColor: C.surface, color: C.text }]}
          />

          <TouchableOpacity
            onPress={() => void handleAdd()}
            disabled={addingDeposit}
            style={[
              s.addBtn,
              { backgroundColor: C.green },
              addingDeposit && { opacity: 0.65 },
            ]}
            accessibilityRole="button"
          >
            {addingDeposit ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.addBtnText}>Hinzufügen</Text>
            )}
          </TouchableOpacity>
          </View>

          <Text style={[s.sectionLabel, { color: C.text2, marginTop: 20 }]}>Einträge</Text>
          {entries.length === 0 ? (
            <Text style={[s.emptyList, { color: C.text3 }]}>Noch keine Einträge.</Text>
          ) : (
            entries.map((e) => (
              <View
                key={e.id}
                style={[s.entryCard, { backgroundColor: C.surface, borderColor: C.border }]}
              >
                <View style={s.entryRow}>
                  <Text style={[s.entryMeta, { color: C.text2 }]}>{formatDeDateTime(e.at)}</Text>
                  <TouchableOpacity
                    onPress={() => confirmDelete(e.id)}
                    disabled={deletingEntryId === e.id}
                    accessibilityRole="button"
                    accessibilityLabel="Eintrag löschen"
                    style={s.entryTrash}
                  >
                    {deletingEntryId === e.id ? (
                      <ActivityIndicator color={C.red} size="small" />
                    ) : (
                      <Text style={{ color: C.red, fontSize: 18 }}>🗑</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={[s.entryDesc, { color: C.text }]}>{e.description}</Text>
                <View style={s.entryFooter}>
                  <Text style={[s.entryPay, { color: C.text2 }]}>{e.paymentLabel}</Text>
                  <Text
                    style={[
                      s.entryAmount,
                      { color: e.kind === "expense" ? C.red : C.green },
                    ]}
                  >
                    {e.kind === "expense" ? "− " : ""}
                    {formatEuro(e.amount)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 4 },
  payHint: { fontSize: 12, marginTop: 4 },
  total: { fontSize: 22, fontWeight: "800", marginTop: 10 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 18, fontWeight: "600" },
  loaderStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  loaderText: { fontSize: 13, fontWeight: "500" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  newEntrySection: { alignSelf: "stretch" },
  banner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  bannerText: { fontSize: 13, fontWeight: "600" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: "48%",
    flexGrow: 1,
    flexBasis: "47%",
  },
  quickChipText: { fontSize: 12, fontWeight: "500" },
  fieldLabel: { fontSize: 11, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  segmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  segmentText: { fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 15,
  },
  purposeReadout: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  addBtn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  emptyList: { fontSize: 14, marginTop: 8 },
  entryCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  entryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entryTrash: { minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center" },
  entryMeta: { fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  entryDesc: { fontSize: 15, fontWeight: "600", marginTop: 6 },
  entryFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  entryPay: { fontSize: 13 },
  entryAmount: { fontSize: 16, fontWeight: "700" },
});
