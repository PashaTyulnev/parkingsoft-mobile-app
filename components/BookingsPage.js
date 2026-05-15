import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Keyboard,
  Platform,
  TextInput,
} from "react-native";
import BookingCard from "./BookingCard";
import BookingCashModal from "./BookingCashModal";
import HandoverProtocolModal from "./HandoverProtocolModal";
import {
  getHandoverProtocol,
  handoverProtocolHasContent,
} from "../lib/handoverProtocol";
import {
  isDetailLegFinishedSuccess,
  isDetailLegChanged,
  isDetailLegMissing,
  isBookingProductValet,
  BOOKING_FILTER_LABEL_EXPECTED,
  numericBookingIdFromListItem,
} from "../api/bookings";
import {
  bookingEditInternalIdFromItem,
  plainNoteToEditNoticeHtml,
  postBookingEdit,
} from "../api/bookingEdit";
import {
  filterDetailStatusesForDayMode,
  buildDetailStatusSetBody,
  postBookingDetailStatus,
} from "../api/bookingDetailStatus";
import { AuthError } from "../api/errors";
import { useAuth } from "../contexts/AuthContext";

const DAY_MODE = {
  ARRIVAL: "arrival",
  DEPARTURE: "departure",
};

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function todayLocal() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function tomorrowLocal() {
  const t = todayLocal();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
}

/** @param {Date} listDate */
function listDayLabel(listDate) {
  if (isSameLocalDay(listDate, new Date())) return "heute";
  if (isSameLocalDay(listDate, tomorrowLocal())) return "morgen";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(listDate);
}

/** Web often shows nothing for `Alert.alert`; use a blocking dialog as fallback. */
function showAppAlert(title, message) {
  const body = String(message ?? "").trim();
  if (Platform.OS === "web" && typeof globalThis.alert === "function") {
    globalThis.alert(body ? `${title}\n\n${body}` : title);
    return;
  }
  Alert.alert(title, body || undefined);
}

export default function BookingsPage({
  C,
  bookings,
  activeFilter,
  setActiveFilter,
  dayMode,
  bookingsListDate,
  onSelectArrivalsToday,
  onSelectDeparturesToday,
  onSelectArrivalsTomorrow,
  onSelectDeparturesTomorrow,
  searchString,
  onSearchStringChange,
  searchMeta,
  allActive,
  onAllActiveChange,
  allMeta,
  onLoadMore,
  loadingMore,
  notesByBooking,
  onChangeNote,
  onNoteDraftClear,
  detailStatusCatalog,
  loading,
  error,
  onRefresh,
  onDetailStatusPostResult,
}) {
  const { token, logout } = useAuth();
  const [detailStatusSavingId, setDetailStatusSavingId] = useState(/** @type {string | null} */ (null));
  const [cashBooking, setCashBooking] = useState(/** @type {object | null} */ (null));
  const [protocolBooking, setProtocolBooking] = useState(/** @type {object | null} */ (null));
  const [protocolStoreRevision, setProtocolStoreRevision] = useState(0);
  const [noteSavingId, setNoteSavingId] = useState(/** @type {string | null} */ (null));
  const [searchDraft, setSearchDraft] = useState(String(searchString ?? ""));
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  useEffect(() => {
    setSearchDraft(String(searchString ?? ""));
  }, [searchString]);

  useEffect(() => {
    const next = String(searchDraft ?? "");
    const current = String(searchString ?? "");
    if (next === current) return;
    const t = setTimeout(() => {
      onSearchStringChange?.(next);
      onRefresh?.(next);
    }, 500);
    return () => clearTimeout(t);
  }, [searchDraft, searchString, onSearchStringChange, onRefresh]);

  const detailStatusOptionsForMode = useMemo(
    () => filterDetailStatusesForDayMode(detailStatusCatalog ?? [], dayMode),
    [detailStatusCatalog, dayMode]
  );

  const handleSaveNote = useCallback(
    async (item) => {
      Keyboard.dismiss();
      if (!token) {
        showAppAlert("Notiz", "Nicht angemeldet — bitte neu anmelden.");
        return;
      }
      const bid = numericBookingIdFromListItem(item);
      if (bid == null) {
        showAppAlert("Notiz", "Keine numerische Buchungs-ID für diese Zeile.");
        return;
      }
      const plain =
        notesByBooking[item.id] !== undefined ? notesByBooking[item.id] : item.remark;
      const html = plainNoteToEditNoticeHtml(plain ?? "");
      const payload = {
        note: html,
        bookingId: bid,
        reference: String(item.reference ?? "").trim(),
        internalId: bookingEditInternalIdFromItem(item),
      };
      setNoteSavingId(String(item.id));
      try {
        await postBookingEdit(token, payload);
        onNoteDraftClear?.(item.id);
        await onRefresh();
        showAppAlert("Notiz", "Die Notiz wurde gespeichert.");
      } catch (e) {
        if (e instanceof AuthError) {
          await logout();
          return;
        }
        showAppAlert("Notiz", e instanceof Error ? e.message : "Speichern fehlgeschlagen");
      } finally {
        setNoteSavingId(null);
      }
    },
    [token, logout, notesByBooking, onRefresh, onNoteDraftClear]
  );

  const handleSetDetailStatus = useCallback(
    async (item, statusId) => {
      if (!token) return;
      setDetailStatusSavingId(String(item.id));
      try {
        const noteForPost =
          notesByBooking[item.id] !== undefined ? notesByBooking[item.id] : item.remark;
        const body = buildDetailStatusSetBody(
          item.reference,
          item.detailStatus?.rowId,
          statusId,
          noteForPost ?? "",
          item.isNative
        );
        const data = await postBookingDetailStatus(token, body);
        onDetailStatusPostResult?.(item.id, data);
        await onRefresh();
      } catch (e) {
        if (e instanceof AuthError) {
          await logout();
          return;
        }
        Alert.alert("Status", e instanceof Error ? e.message : "Speichern fehlgeschlagen");
      } finally {
        setDetailStatusSavingId(null);
      }
    },
    [token, logout, notesByBooking, onRefresh, onDetailStatusPostResult]
  );

  const filters = ["Alle", BOOKING_FILTER_LABEL_EXPECTED, "Reingefahren", "Änderung", "Valet"];

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (activeFilter === "Alle") return true;
      if (activeFilter === BOOKING_FILTER_LABEL_EXPECTED) {
        const leg =
          dayMode === DAY_MODE.ARRIVAL
            ? b.detailStatus?.arrival
            : b.detailStatus?.departure;
        return isDetailLegMissing(leg);
      }
      if (activeFilter === "Reingefahren") {
        const leg =
          dayMode === DAY_MODE.ARRIVAL
            ? b.detailStatus?.arrival
            : b.detailStatus?.departure;
        return isDetailLegFinishedSuccess(leg);
      }
      if (activeFilter === "Änderung") {
        return isDetailLegChanged(b.detailStatus?.arrival);
      }
      if (activeFilter === "Valet") {
        return isBookingProductValet(b);
      }
      return true;
    });
  }, [bookings, activeFilter, dayMode]);

  const listHeader = useMemo(
    () => (
      <View style={s.listHeader}>
        <Text style={[s.sectionTitle, { color: C.text }]}>
          {allActive
            ? "Alle Buchungen"
            : `${dayMode === DAY_MODE.ARRIVAL ? "Ankünfte" : "Rückreisen"} ${listDayLabel(
                bookingsListDate
              )}`}
        </Text>
        <Text style={[s.sectionCount, { color: C.blue }]}>
          {searchString?.trim()
            ? `${filtered.length} / ${searchMeta?.amount ?? filtered.length} Treffer`
            : allActive
              ? `${filtered.length} / ${allMeta?.amount ?? filtered.length}`
              : `${filtered.length} Buchungen`}
        </Text>
      </View>
    ),
    [
      allActive,
      allMeta?.amount,
      dayMode,
      bookingsListDate,
      filtered.length,
      C.text,
      C.blue,
      searchString,
      searchMeta?.amount,
    ]
  );

  const t0 = todayLocal();
  const t1 = tomorrowLocal();
  const arrivalsTodayActive =
    dayMode === DAY_MODE.ARRIVAL && isSameLocalDay(bookingsListDate, t0);
  const departuresTodayActive =
    dayMode === DAY_MODE.DEPARTURE && isSameLocalDay(bookingsListDate, t0);
  const arrivalsTomorrowActive =
    dayMode === DAY_MODE.ARRIVAL && isSameLocalDay(bookingsListDate, t1);
  const departuresTomorrowActive =
    dayMode === DAY_MODE.DEPARTURE && isSameLocalDay(bookingsListDate, t1);

  const renderItem = useCallback(
    ({ item }) => (
      <BookingCard
        item={item}
        dayMode={dayMode}
        note={notesByBooking[item.id] ?? item.remark}
        onChangeNote={onChangeNote}
        onPressSaveNote={() => void handleSaveNote(item)}
        noteSaving={noteSavingId === String(item.id)}
        detailStatusOptions={detailStatusOptionsForMode}
        onSetDetailStatus={handleSetDetailStatus}
        detailStatusSaving={detailStatusSavingId === String(item.id)}
        onPressCashRegister={() => setCashBooking(item)}
        hasHandoverProtocol={handoverProtocolHasContent(getHandoverProtocol(item.id))}
        onPressHandoverProtocol={() => setProtocolBooking(item)}
        C={C}
      />
    ),
    [
      dayMode,
      notesByBooking,
      onChangeNote,
      handleSaveNote,
      noteSavingId,
      detailStatusOptionsForMode,
      handleSetDetailStatus,
      detailStatusSavingId,
      protocolStoreRevision,
      C,
    ]
  );

  const keyExtractor = useCallback((item, index) => `${String(item.id)}-${index}`, []);

  const stats = useMemo(() => {
    const total = bookings.length;
    const cExpected = bookings.filter((b) =>
      dayMode === DAY_MODE.ARRIVAL
        ? isDetailLegMissing(b.detailStatus?.arrival)
        : isDetailLegMissing(b.detailStatus?.departure)
    ).length;
    const cRein = bookings.filter((b) =>
      dayMode === DAY_MODE.ARRIVAL
        ? isDetailLegFinishedSuccess(b.detailStatus?.arrival)
        : isDetailLegFinishedSuccess(b.detailStatus?.departure)
    ).length;
    const cAend = bookings.filter((b) =>
      isDetailLegChanged(b.detailStatus?.arrival)
    ).length;
    return [
      {
        num: String(total),
        label: dayMode === DAY_MODE.ARRIVAL ? "Ankünfte" : "Rückreisen",
        color: C.blue,
      },
      { num: String(cExpected), label: BOOKING_FILTER_LABEL_EXPECTED, color: C.text2 },
      { num: String(cRein), label: "Reingefahren", color: C.green },
      { num: String(cAend), label: "Änderung", color: C.yellow },
    ];
  }, [bookings, dayMode, C]);

  return (
    <View style={s.root}>
      <View style={s.headerToolsRow}>
        <TouchableOpacity
          onPress={() => setHeaderCollapsed((v) => !v)}
          style={[
            s.headerToolBtn,
            { borderColor: C.border, backgroundColor: C.surface },
            headerCollapsed && { backgroundColor: C.blue, borderColor: C.blue },
          ]}
          accessibilityRole="button"
          accessibilityLabel={headerCollapsed ? "Header einblenden" : "Header minimieren"}
        >
          <Text
            style={[
              s.headerToolText,
              { color: C.text2 },
              headerCollapsed && s.headerToolTextActive,
            ]}
          >
            {headerCollapsed ? "Header anzeigen" : "Vollbild"}
          </Text>
        </TouchableOpacity>
      </View>

      {!headerCollapsed ? (
        <View style={s.statsRow}>
          {stats.map(({ num, label, color }) => (
            <View
              key={label}
              style={[
                s.statCard,
                { backgroundColor: C.surface, borderColor: C.border },
              ]}
            >
              <Text style={[s.statNum, { color }]}>{num}</Text>
              <Text style={[s.statLabel, { color: C.text2 }]}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!headerCollapsed ? (
        <View style={s.modeSwitchWrap}>
        <TouchableOpacity
          style={[
            s.modeSwitch,
            { borderColor: C.border, backgroundColor: C.surface },
            arrivalsTodayActive && {
              backgroundColor: C.blue,
              borderColor: C.blue,
            },
          ]}
          onPress={() => {
            if (allActive) onAllActiveChange?.(false);
            onSelectArrivalsToday?.();
            onRefresh?.(String(searchDraft ?? ""));
          }}
        >
          <Text
            style={[
              s.modeSwitchText,
              { color: C.text2 },
              arrivalsTodayActive && s.modeSwitchTextActive,
            ]}
          >
            Ankünfte heute
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.modeSwitch,
            { borderColor: C.border, backgroundColor: C.surface },
            departuresTodayActive && {
              backgroundColor: C.blue,
              borderColor: C.blue,
            },
          ]}
          onPress={() => {
            if (allActive) onAllActiveChange?.(false);
            onSelectDeparturesToday?.();
            onRefresh?.(String(searchDraft ?? ""));
          }}
        >
          <Text
            style={[
              s.modeSwitchText,
              { color: C.text2 },
              departuresTodayActive && s.modeSwitchTextActive,
            ]}
          >
            Rückreisen heute
          </Text>
        </TouchableOpacity>
        </View>
      ) : null}

      {!headerCollapsed ? (
        <View style={s.modeSwitchWrap}>
        <TouchableOpacity
          style={[
            s.modeSwitch,
            { borderColor: C.border, backgroundColor: C.surface },
            arrivalsTomorrowActive && {
              backgroundColor: C.blue,
              borderColor: C.blue,
            },
          ]}
          onPress={() => {
            if (allActive) onAllActiveChange?.(false);
            onSelectArrivalsTomorrow?.();
            onRefresh?.(String(searchDraft ?? ""));
          }}
        >
          <Text
            style={[
              s.modeSwitchText,
              { color: C.text2 },
              arrivalsTomorrowActive && s.modeSwitchTextActive,
            ]}
          >
            Ankünfte morgen
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.modeSwitch,
            { borderColor: C.border, backgroundColor: C.surface },
            departuresTomorrowActive && {
              backgroundColor: C.blue,
              borderColor: C.blue,
            },
          ]}
          onPress={() => {
            if (allActive) onAllActiveChange?.(false);
            onSelectDeparturesTomorrow?.();
            onRefresh?.(String(searchDraft ?? ""));
          }}
        >
          <Text
            style={[
              s.modeSwitchText,
              { color: C.text2 },
              departuresTomorrowActive && s.modeSwitchTextActive,
            ]}
          >
            Rückreisen morgen
          </Text>
        </TouchableOpacity>
        </View>
      ) : null}

      {!headerCollapsed ? (
        <View style={s.modeSwitchWrap}>
        <TouchableOpacity
          style={[
            s.modeSwitch,
            { borderColor: C.border, backgroundColor: C.surface },
            allActive && { backgroundColor: C.blue, borderColor: C.blue },
          ]}
          onPress={() => {
            onAllActiveChange?.(!allActive);
            onRefresh?.();
          }}
        >
          <Text
            style={[
              s.modeSwitchText,
              { color: C.text2 },
              allActive && s.modeSwitchTextActive,
            ]}
          >
            Alle Buchungen
          </Text>
        </TouchableOpacity>
        </View>
      ) : null}

      {!headerCollapsed ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.strip}
          contentContainerStyle={s.stripContent}
        >
          {filters.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              style={[
                s.chip,
                { borderColor: C.border },
                activeFilter === f
                  ? { backgroundColor: C.blue, borderColor: C.blue }
                  : { backgroundColor: "rgba(255,255,255,0.07)" },
              ]}
            >
              <Text
                style={[
                  s.chipText,
                  { color: C.text2 },
                  activeFilter === f && s.chipTextActive,
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      <View style={[s.searchWrap, { borderColor: C.border, backgroundColor: C.surface }]}>
        <TextInput
          value={searchDraft}
          onChangeText={setSearchDraft}
          placeholder="Buchungen suchen (Name, Referenz …)"
          placeholderTextColor="#6B7280"
          autoCapitalize="none"
          autoCorrect={false}
          style={[s.searchInput, { color: C.text }]}
          returnKeyType="search"
          onSubmitEditing={() => {
            Keyboard.dismiss();
            onSearchStringChange?.(String(searchDraft ?? ""));
            onRefresh?.(String(searchDraft ?? ""));
          }}
        />
        {searchDraft?.trim() ? (
          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              setSearchDraft("");
              onSearchStringChange?.("");
              onRefresh?.("");
            }}
            style={s.searchClear}
            accessibilityRole="button"
            accessibilityLabel="Suche löschen"
          >
            <Text style={[s.searchClearText, { color: C.text2 }]}>×</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={s.errorBanner}>
          <Text style={[s.errorText, { color: C.red }]}>{error}</Text>
        </View>
      ) : null}

      {loading && bookings.length === 0 ? (
        <View style={s.loaderWrap}>
          <ActivityIndicator size="large" color={C.blue} />
        </View>
      ) : null}

      <FlatList
        style={s.listFlex}
        data={filtered}
        keyExtractor={keyExtractor}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (allActive && !loading && !loadingMore) onLoadMore?.();
        }}
        refreshControl={
          <RefreshControl
            refreshing={loading && bookings.length > 0}
            onRefresh={onRefresh}
            tintColor={C.blue}
            colors={[C.blue]}
          />
        }
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          allActive &&
          (() => {
            const q = String(searchString ?? "").trim();
            const meta = q ? searchMeta : allMeta;
            return loadingMore || (meta && meta.currentPage < meta.pagesAmount);
          })() ? (
            <View style={s.footer}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={C.blue} />
              ) : (
                <Text style={[s.footerText, { color: C.text2 }]}>
                  Mehr laden: Seite{" "}
                  {(String(searchString ?? "").trim() ? searchMeta?.currentPage : allMeta?.currentPage) ?? 1} /{" "}
                  {(String(searchString ?? "").trim() ? searchMeta?.pagesAmount : allMeta?.pagesAmount) ?? 1}
                </Text>
              )}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={[s.empty, { color: C.text2 }]}>
              Keine Buchungen für diesen Filter.
            </Text>
          ) : null
        }
        renderItem={renderItem}
      />

      <BookingCashModal
        visible={cashBooking != null}
        onClose={() => setCashBooking(null)}
        booking={cashBooking}
        C={C}
      />

      <HandoverProtocolModal
        visible={protocolBooking != null}
        onClose={() => setProtocolBooking(null)}
        booking={protocolBooking}
        C={C}
        onSaved={() => setProtocolStoreRevision((v) => v + 1)}
      />
    </View>
  );
}

export { DAY_MODE };

const s = StyleSheet.create({
  root: { flex: 1 },
  listFlex: { flex: 1 },
  strip: { flexGrow: 0 },
  stripContent: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  headerToolsRow: { paddingHorizontal: 20, marginBottom: 10, flexDirection: "row", justifyContent: "flex-end" },
  headerToolBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  headerToolText: { fontSize: 12, fontWeight: "700" },
  headerToolTextActive: { color: "#fff" },
  searchWrap: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 10 },
  searchClear: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  searchClearText: { fontSize: 22, lineHeight: 22, marginTop: -2 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  statNum: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 10, marginTop: 1 },
  modeSwitchWrap: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  modeSwitch: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  modeSwitchText: { fontSize: 13, fontWeight: "600" },
  modeSwitchTextActive: { color: "#fff" },
  errorBanner: { paddingHorizontal: 20, marginBottom: 8 },
  errorText: { fontSize: 13, fontWeight: "500" },
  loaderWrap: { paddingVertical: 48, alignItems: "center" },
  footer: { paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  footerText: { fontSize: 12, fontWeight: "500" },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  listHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "600" },
  sectionCount: { fontSize: 14, fontWeight: "500" },
  empty: { textAlign: "center", marginTop: 24, fontSize: 15 },
});
