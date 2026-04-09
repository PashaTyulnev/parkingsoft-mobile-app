import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
} from "react-native";
import {
  LAST_USER_FILTER_ALL,
  LAST_USER_FILTER_CHECKIN,
  LAST_USER_FILTER_CHECKOUT,
  LAST_USER_FILTER_PAUSE,
} from "../api/timetracker";

/**
 * @param {object} props
 * @param {object} props.C
 * @param {{ employee: string; checkIn: string; checkOut: string }} props.employeeTime
 * @param {string} [props.statusKind] Server `type` from timetracker status (checkin | checkout).
 * @param {() => void} props.onCheckIn
 * @param {() => void} props.onCheckOut
 * @param {boolean} [props.loading]
 * @param {string} props.overviewPeriodLabel e.g. "März 2026"
 * @param {() => void} props.onOverviewPrevMonth
 * @param {() => void} props.onOverviewNextMonth
 * @param {Array<object>} [props.overviewItems] Normalized overview rows from API
 * @param {boolean} [props.overviewLoading]
 * @param {string} [props.overviewError]
 * @param {() => void} [props.onOverviewRefresh]
 * @param {string} [props.overviewHint] Shown instead of list when profile not ready
 * @param {object | null} [props.userTotals] From `POST …/user_totals`
 * @param {string} [props.totalsError]
 * @param {readonly object[]} [props.teamStatusItems] Filtered rows for team list
 * @param {string} [props.teamStatusFilter]
 * @param {(key: string) => void} [props.onTeamStatusFilterChange]
 * @param {boolean} [props.teamStatusLoading]
 * @param {string} [props.teamStatusError]
 */
const TEAM_FILTER_CHIPS = [
  { key: LAST_USER_FILTER_ALL, label: "Alle" },
  { key: LAST_USER_FILTER_CHECKIN, label: "Eingecheckt" },
  { key: LAST_USER_FILTER_CHECKOUT, label: "Ausgecheckt" },
  { key: LAST_USER_FILTER_PAUSE, label: "Pause" },
];

function teamAccentColor(C, category) {
  if (category === LAST_USER_FILTER_CHECKIN) return C.green;
  if (category === LAST_USER_FILTER_CHECKOUT) return C.orange;
  if (category === LAST_USER_FILTER_PAUSE) return C.yellow;
  return C.text3;
}

/**
 * @param {object} p
 * @param {object} p.C
 * @param {object} p.item
 */
function TeamStatusRow({ C, item }) {
  const accent = teamAccentColor(C, item.filterCategory);
  return (
    <View style={[s.teamRow, { backgroundColor: C.surface2, borderColor: C.border }]}>
      <View style={[s.teamRowAccent, { backgroundColor: accent }]} />
      <View style={s.teamRowBody}>
        <Text style={[s.teamRowUser, { color: C.text }]} numberOfLines={1}>
          {item.username}
        </Text>
        <Text style={[s.teamRowMeta, { color: C.text2 }]}>
          {item.statusLabel} · {item.lastActionDisplay}
        </Text>
      </View>
    </View>
  );
}

function statusKindLabel(kind) {
  if (kind === "checkin") return "Status: eingecheckt";
  if (kind === "checkout") return "Status: ausgecheckt";
  return "";
}

/**
 * @param {object} p
 * @param {object} p.C
 * @param {object} p.item
 */
function OverviewRow({ C, item }) {
  const endLabel = item.isOpenShift
    ? "offen"
    : item.endTime
      ? item.endDateDE && item.endDateDE !== item.startDateDE
        ? `${item.endTime} (${item.endDateDE})`
        : item.endTime
      : "—";
  return (
    <View style={[s.rowCard, { backgroundColor: C.surface2, borderColor: C.border }]}>
      <Text style={[s.rowDate, { color: C.text }]}>{item.startDateDE || "—"}</Text>
      <Text style={[s.rowRange, { color: C.text2 }]}>
        {item.startTime} – {endLabel}
      </Text>
      <Text style={[s.rowMeta, { color: C.text3 }]}>
        Netto: {item.totalWorkingTime ?? "—"}
        {item.shiftDuration ? ` · Brutto: ${item.shiftDuration}` : ""}
        {item.pauseDuration && item.pauseDuration !== "00:00"
          ? ` · Pause: ${item.pauseDuration}`
          : ""}
      </Text>
    </View>
  );
}

/**
 * @param {object} p
 * @param {object} p.C
 * @param {object} p.totals
 */
function UserTotalsCard({ C, totals }) {
  return (
    <View style={[s.totalsCard, { backgroundColor: C.surface, borderColor: C.border }]}>
      <Text style={[s.totalsTitle, { color: C.text }]}>Monatssumme</Text>
      {totals.username ? (
        <Text style={[s.totalsUser, { color: C.text2 }]}>{totals.username}</Text>
      ) : null}
      <Text style={[s.totalsLine, { color: C.text2 }]}>
        Zeitraum: {totals.dateFromLabel} – {totals.dateToLabel}
      </Text>
      <Text style={[s.totalsHighlight, { color: C.green }]}>
        Netto: {totals.totalWorkingTime} · Brutto: {totals.totalShiftDuration}
      </Text>
      <Text style={[s.totalsLine, { color: C.text2 }]}>Pause gesamt: {totals.totalPause}</Text>
      <Text style={[s.totalsSub, { color: C.text3 }]}>
        Nacht (Netto): {totals.totalNightShiftWorkingTime} · Nacht Pause:{" "}
        {totals.totalNightShiftPause} · Nacht o. Pause: {totals.totalNightShiftWithoutPause}
      </Text>
    </View>
  );
}

export default function EmployeeTimePage({
  C,
  employeeTime,
  statusKind = "",
  onCheckIn,
  onCheckOut,
  loading,
  overviewPeriodLabel,
  onOverviewPrevMonth,
  onOverviewNextMonth,
  overviewItems = [],
  overviewLoading = false,
  overviewError = "",
  onOverviewRefresh,
  overviewHint = "",
  userTotals = null,
  totalsError = "",
  teamStatusItems = [],
  teamStatusFilter = LAST_USER_FILTER_ALL,
  onTeamStatusFilterChange,
  teamStatusLoading = false,
  teamStatusError = "",
}) {
  const busy = Boolean(loading);
  const statusLine = statusKindLabel(String(statusKind).toLowerCase());
  const listBusy = Boolean(overviewLoading);
  const teamBusy = Boolean(teamStatusLoading);
  const refreshBusy = listBusy || teamBusy;
  const onTeamFilter = onTeamStatusFilterChange ?? (() => {});

  const header = (
    <View>
      <View style={s.headerRow}>
        <Text style={[s.title, { color: C.text }]}>Meine Zeiterfassung</Text>
        <Text style={[s.employee, { color: C.blue }]}>{employeeTime.employee}</Text>
      </View>
      <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
        <View style={s.actions}>
          <TouchableOpacity
            style={[
              s.btn,
              { backgroundColor: "rgba(48,209,88,0.2)", borderColor: C.green },
              busy && s.btnDisabled,
            ]}
            onPress={onCheckIn}
            disabled={busy}
            accessibilityState={{ disabled: busy }}
          >
            <Text style={[s.btnText, { color: C.text }]}>Check-in</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.btn,
              { backgroundColor: "rgba(255,159,10,0.2)", borderColor: C.orange },
              busy && s.btnDisabled,
            ]}
            onPress={onCheckOut}
            disabled={busy}
            accessibilityState={{ disabled: busy }}
          >
            <Text style={[s.btnText, { color: C.text }]}>Check-out</Text>
          </TouchableOpacity>
        </View>
        {busy ? (
          <View style={s.loadingRow}>
            <ActivityIndicator color={C.blue} size="small" />
            <Text style={[s.loadingText, { color: C.text2 }]}>Server …</Text>
          </View>
        ) : null}
        {statusLine ? (
          <Text style={[s.statusLine, { color: C.teal }]}>{statusLine}</Text>
        ) : null}
        <Text style={[s.value, { color: C.text2 }]}>
          In: {employeeTime.checkIn || "--:--"} | Out: {employeeTime.checkOut || "--:--"}
        </Text>
      </View>

      <View style={s.teamSection}>
        <View style={s.teamTitleRow}>
          <Text style={[s.sectionTitle, { color: C.text, marginTop: 0, marginBottom: 0 }]}>
            Team-Status
          </Text>
          {teamBusy ? <ActivityIndicator color={C.blue} size="small" /> : null}
        </View>
        <Text style={[s.teamHint, { color: C.text3 }]}>
          Letzte Aktion pro Mitarbeiter (Check-in, Check-out, Pause).
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.teamChipScroll}
        >
          {TEAM_FILTER_CHIPS.map(({ key, label }) => {
            const active = teamStatusFilter === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => onTeamFilter(key)}
                style={[
                  s.teamChip,
                  { borderColor: active ? C.blue : C.border },
                  active && { backgroundColor: "rgba(10,132,255,0.15)" },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[s.teamChipText, { color: active ? C.blue : C.text2 }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {teamStatusError ? (
          <Text style={[s.errorText, { color: C.red, marginTop: 8 }]}>{teamStatusError}</Text>
        ) : null}
        {!teamBusy && !teamStatusError && teamStatusItems.length === 0 ? (
          <Text style={[s.teamEmpty, { color: C.text3 }]}>Keine Einträge für diesen Filter.</Text>
        ) : (
          teamStatusItems.map((item) => (
            <TeamStatusRow key={String(item.timeTrackerId)} C={C} item={item} />
          ))
        )}
      </View>

      <Text style={[s.sectionTitle, { color: C.text }]}>Meine Einträge</Text>
      <View style={[s.periodRow, { borderColor: C.border }]}>
        <TouchableOpacity
          onPress={onOverviewPrevMonth}
          style={[s.periodBtn, { borderColor: C.border }]}
          accessibilityRole="button"
          accessibilityLabel="Vorheriger Monat"
        >
          <Text style={[s.periodBtnText, { color: C.blue }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[s.periodLabel, { color: C.text }]}>{overviewPeriodLabel}</Text>
        <TouchableOpacity
          onPress={onOverviewNextMonth}
          style={[s.periodBtn, { borderColor: C.border }]}
          accessibilityRole="button"
          accessibilityLabel="Nächster Monat"
        >
          <Text style={[s.periodBtnText, { color: C.blue }]}>›</Text>
        </TouchableOpacity>
      </View>
      {!overviewHint && userTotals ? <UserTotalsCard C={C} totals={userTotals} /> : null}
      {totalsError ? (
        <Text style={[s.totalsErrorText, { color: C.orange }]}>{totalsError}</Text>
      ) : null}
      {overviewHint ? (
        <Text style={[s.hint, { color: C.text2 }]}>{overviewHint}</Text>
      ) : null}
      {overviewError ? (
        <Text style={[s.errorText, { color: C.red }]}>{overviewError}</Text>
      ) : null}
      {listBusy && !overviewHint ? (
        <View style={s.listLoading}>
          <ActivityIndicator color={C.blue} size="small" />
          <Text style={[s.loadingText, { color: C.text2 }]}>Einträge …</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={overviewHint ? [] : overviewItems}
      keyExtractor={(item) => String(item.timeTrackerId)}
      ListHeaderComponent={header}
      renderItem={({ item }) => <OverviewRow C={C} item={item} />}
      contentContainerStyle={s.listContent}
      refreshControl={
        onOverviewRefresh ? (
          <RefreshControl
            refreshing={refreshBusy}
            onRefresh={onOverviewRefresh}
            tintColor={C.blue}
          />
        ) : undefined
      }
      ListEmptyComponent={
        overviewHint || listBusy || overviewError ? null : (
          <Text style={[s.empty, { color: C.text3 }]}>Keine Einträge in diesem Monat.</Text>
        )
      }
    />
  );
}

const s = StyleSheet.create({
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 4,
  },
  title: { fontSize: 18, fontWeight: "600" },
  employee: { fontSize: 14, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 12, padding: 12 },
  actions: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center", borderWidth: 1 },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 12, fontWeight: "600" },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  loadingText: { fontSize: 12 },
  statusLine: { marginTop: 8, fontSize: 12, fontWeight: "600" },
  value: { marginTop: 8, fontSize: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginTop: 20, marginBottom: 8 },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
  },
  periodBtn: {
    width: 40,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  periodBtnText: { fontSize: 22, fontWeight: "600", lineHeight: 26 },
  periodLabel: { fontSize: 15, fontWeight: "600" },
  totalsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  totalsTitle: { fontSize: 14, fontWeight: "700" },
  totalsUser: { fontSize: 12, marginTop: 4, fontWeight: "600" },
  totalsLine: { fontSize: 12, marginTop: 6 },
  totalsHighlight: { fontSize: 13, fontWeight: "600", marginTop: 8 },
  totalsSub: { fontSize: 11, marginTop: 6, lineHeight: 15 },
  totalsErrorText: { fontSize: 12, marginBottom: 8 },
  hint: { fontSize: 13, marginBottom: 8 },
  errorText: { fontSize: 13, marginBottom: 8 },
  listLoading: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  rowCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  rowDate: { fontSize: 14, fontWeight: "600" },
  rowRange: { fontSize: 13, marginTop: 4 },
  rowMeta: { fontSize: 11, marginTop: 6 },
  empty: { fontSize: 13, textAlign: "center", marginTop: 8, marginBottom: 16 },
  teamSection: { marginTop: 20, marginBottom: 4 },
  teamTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  teamHint: { fontSize: 11, marginBottom: 10, lineHeight: 15 },
  teamChipScroll: { flexDirection: "row", gap: 8, paddingBottom: 10 },
  teamChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  teamChipText: { fontSize: 12, fontWeight: "600" },
  teamRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 6,
    overflow: "hidden",
  },
  teamRowAccent: { width: 3 },
  teamRowBody: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, minWidth: 0 },
  teamRowUser: { fontSize: 14, fontWeight: "600" },
  teamRowMeta: { fontSize: 12, marginTop: 3 },
  teamEmpty: { fontSize: 12, marginTop: 4, marginBottom: 8 },
});
