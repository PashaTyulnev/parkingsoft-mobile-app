import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";

/**
 * @param {object} p
 * @param {object} p.shift
 * @param {object} p.C
 */
function ShiftCard({ shift, C }) {
  return (
    <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      <View style={[s.cardAccent, { backgroundColor: shift.color }]} />
      <View style={s.cardBody}>
        <View style={s.cardMain}>
          <Text style={[s.title, { color: C.text }]} numberOfLines={2}>
            {shift.name}
          </Text>
          <Text style={[s.statusLine, { color: C.text2 }]}>
            {shift.statusLabel}
            {shift.note ? ` · ${shift.note}` : ""}
          </Text>
          {shift.stampedLabel ? (
            <Text style={[s.stamped, { color: C.teal }]}>{shift.stampedLabel}</Text>
          ) : null}
        </View>
        <View style={s.right}>
          <Text style={[s.date, { color: C.text }]}>{shift.dateLabel}</Text>
          <Text style={[s.time, { color: C.teal }]}>{shift.timeRange}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * @param {object} props
 * @param {object} props.C
 * @param {readonly object[]} props.shifts
 * @param {boolean} [props.loading]
 * @param {string} [props.error]
 * @param {() => void} [props.onRefresh]
 */
export default function ShiftsPage({ C, shifts, loading = false, error = "", onRefresh }) {
  const busy = Boolean(loading);
  return (
    <FlatList
      style={s.flex}
      data={shifts}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={s.list}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={busy} onRefresh={onRefresh} tintColor={C.blue} />
        ) : undefined
      }
      ListHeaderComponent={(
        <View style={s.header}>
          <Text style={[s.headerTitle, { color: C.text }]}>Meine Schichten</Text>
          <Text style={[s.count, { color: C.blue }]}>{shifts.length} Einträge</Text>
        </View>
      )}
      ListEmptyComponent={
        busy ? null : error ? (
          <Text style={[s.errorText, { color: C.red }]}>{error}</Text>
        ) : (
          <Text style={[s.empty, { color: C.text3 }]}>Keine Schichten geladen.</Text>
        )
      }
      ListFooterComponent={
        busy ? (
          <View style={s.footerLoad}>
            <ActivityIndicator color={C.blue} size="small" />
            <Text style={[s.footerLoadText, { color: C.text2 }]}>Laden …</Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => <ShiftCard shift={item} C={C} />}
    />
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  count: { fontSize: 14, fontWeight: "500" },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
  },
  cardAccent: { width: 3 },
  cardBody: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardMain: { flex: 1, marginRight: 10, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "600" },
  statusLine: { fontSize: 12, marginTop: 4 },
  stamped: { fontSize: 11, marginTop: 4, fontWeight: "500" },
  right: { alignItems: "flex-end" },
  date: { fontSize: 12, fontWeight: "500" },
  time: { fontSize: 12, marginTop: 2, fontFamily: "monospace" },
  errorText: { fontSize: 13, marginTop: 8 },
  empty: { fontSize: 13, marginTop: 8, textAlign: "center" },
  footerLoad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
  footerLoadText: { fontSize: 12 },
});
