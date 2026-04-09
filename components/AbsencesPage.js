import React, { useState } from "react";
import { View, Text, TouchableOpacity, TextInput, FlatList, StyleSheet } from "react-native";

function AbsenceCard({ entry, C }) {
  return (
    <View style={[s.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      <View>
        <Text style={[s.type, { color: C.text }]}>{entry.type}</Text>
        <Text style={[s.date, { color: C.text2 }]}>{entry.date}</Text>
      </View>
      <Text style={[s.note, { color: C.teal }]}>{entry.note || "Keine Notiz"}</Text>
    </View>
  );
}

export default function AbsencesPage({ C, absences, absenceTypes, onAddAbsence }) {
  const [type, setType] = useState(absenceTypes[0]);
  const [date, setDate] = useState("22.03.2026");
  const [note, setNote] = useState("");

  const handleAdd = () => {
    if (!date.trim()) return;
    onAddAbsence({ type, date: date.trim(), note: note.trim() });
    setNote("");
  };

  return (
    <FlatList
      style={s.flex}
      data={absences}
      keyExtractor={(item) => item.id}
      contentContainerStyle={s.list}
      ListHeaderComponent={(
        <View style={s.section}>
          <View style={s.header}>
            <Text style={[s.title, { color: C.text }]}>Abwesenheiten</Text>
            <Text style={[s.count, { color: C.blue }]}>{absences.length} Einträge</Text>
          </View>
          <View style={[s.form, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[s.label, { color: C.text2 }]}>Typ</Text>
            <View style={s.typeRow}>
              {absenceTypes.map((entryType) => (
                <TouchableOpacity
                  key={entryType}
                  onPress={() => setType(entryType)}
                  style={[
                    s.typeChip,
                    { borderColor: C.border, backgroundColor: C.surface2 },
                    type === entryType && { backgroundColor: C.blue, borderColor: C.blue },
                  ]}
                >
                  <Text style={[s.typeText, { color: C.text2 }, type === entryType && s.typeTextActive]}>{entryType}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[s.input, { borderColor: C.border, backgroundColor: C.surface2, color: C.text }]}
              placeholder="Datum (z. B. 24.03.2026)"
              placeholderTextColor={C.text3}
              value={date}
              onChangeText={setDate}
            />
            <TextInput
              style={[s.input, { borderColor: C.border, backgroundColor: C.surface2, color: C.text }]}
              placeholder="Notiz (optional)"
              placeholderTextColor={C.text3}
              value={note}
              onChangeText={setNote}
            />
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: C.green }]} onPress={handleAdd}>
              <Text style={s.saveText}>Abwesenheit eintragen</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      renderItem={({ item }) => <AbsenceCard entry={item} C={C} />}
    />
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  section: { marginBottom: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "600" },
  count: { fontSize: 14, fontWeight: "500" },
  form: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  label: { fontSize: 12, marginBottom: 6, fontWeight: "600" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 10 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  typeText: { fontSize: 12, fontWeight: "500" },
  typeTextActive: { color: "#fff" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, marginBottom: 8 },
  saveBtn: { borderRadius: 10, alignItems: "center", paddingVertical: 10 },
  saveText: { color: "#04120a", fontSize: 13, fontWeight: "700" },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  type: { fontSize: 14, fontWeight: "600" },
  date: { fontSize: 12, marginTop: 2 },
  note: { fontSize: 12, maxWidth: "50%", textAlign: "right" },
});
