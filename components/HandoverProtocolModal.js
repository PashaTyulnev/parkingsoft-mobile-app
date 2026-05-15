import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import HandoverProtocolSection from "./HandoverProtocolSection";
import {
  cloneHandoverProtocol,
  finalizeHandoverProtocolForSave,
  getHandoverProtocol,
  getOrCreateHandoverProtocol,
  handoverProtocolsEqual,
  saveHandoverProtocol,
} from "../lib/handoverProtocol";

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {{ id?: string | number; reference?: string; name?: string; plate?: string } | null} props.booking
 * @param {object} props.C
 * @param {() => void} [props.onSaved] notify parent to refresh open/create label
 */
export default function HandoverProtocolModal({
  visible,
  onClose,
  booking,
  C,
  onSaved,
}) {
  const [draft, setDraft] = useState(
    /** @type {import("../lib/handoverProtocol").HandoverProtocol | null} */ (null)
  );
  const [savedSnapshot, setSavedSnapshot] = useState(
    /** @type {import("../lib/handoverProtocol").HandoverProtocol | null} */ (null)
  );
  const [saving, setSaving] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const saveFlashTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  const bookingId = booking?.id != null ? String(booking.id) : null;

  useEffect(() => {
    if (!visible || !bookingId) {
      setDraft(null);
      setSavedSnapshot(null);
      return;
    }

    const stored = getHandoverProtocol(bookingId);
    const initial = stored ?? getOrCreateHandoverProtocol(bookingId);
    const clone = cloneHandoverProtocol(initial);
    setDraft(clone);
    setSavedSnapshot(cloneHandoverProtocol(stored ?? createSnapshotForEmpty(bookingId)));
    setSaveFlash(false);
  }, [visible, bookingId]);

  useEffect(() => {
    return () => {
      if (saveFlashTimerRef.current) clearTimeout(saveFlashTimerRef.current);
    };
  }, []);

  const isDirty = useMemo(() => {
    if (!draft || !savedSnapshot) return false;
    return !handoverProtocolsEqual(draft, savedSnapshot);
  }, [draft, savedSnapshot]);

  const updateSection = useCallback((/** @type {"handover" | "vehicleReturn"} */ key, patch) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [key]: { ...prev[key], ...patch },
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const previous = getHandoverProtocol(draft.bookingId);
      const finalized = finalizeHandoverProtocolForSave(draft, previous);
      saveHandoverProtocol(finalized);
      const snapshot = cloneHandoverProtocol(finalized);
      setDraft(snapshot);
      setSavedSnapshot(snapshot);
      setSaveFlash(true);
      if (saveFlashTimerRef.current) clearTimeout(saveFlashTimerRef.current);
      saveFlashTimerRef.current = setTimeout(() => setSaveFlash(false), 2500);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }, [draft, saving, onSaved]);

  const requestClose = useCallback(() => {
    if (!isDirty) {
      onClose();
      return;
    }
    Alert.alert(
      "Ungespeicherte Änderungen",
      "Möchten Sie schließen, ohne zu speichern?",
      [
        { text: "Weiter bearbeiten", style: "cancel" },
        { text: "Verwerfen", style: "destructive", onPress: onClose },
      ]
    );
  }, [isDirty, onClose]);

  if (!booking || !draft) return null;

  const refLabel = booking.reference ?? String(booking.id ?? "—");
  const vehicleLine = [booking.plate, booking.name].filter(Boolean).join(" · ") || booking.name || "—";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={requestClose}
    >
      <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]}>
        <View style={[s.header, { borderBottomColor: C.border }]}>
          <View style={s.headerTextWrap}>
            <Text style={[s.title, { color: C.text }]} numberOfLines={1}>
              Übergabeprotokoll #{refLabel}
            </Text>
            <Text style={[s.subtitle, { color: C.text2 }]} numberOfLines={2}>
              {vehicleLine}
            </Text>
          </View>
          <TouchableOpacity
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel="Schließen"
            style={[s.closeBtn, { backgroundColor: C.surface2 }]}
          >
            <Text style={[s.closeBtnText, { color: C.text }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {isDirty ? (
          <View style={[s.dirtyBanner, { backgroundColor: "rgba(255,159,10,0.15)", borderColor: C.orange }]}>
            <Text style={[s.dirtyBannerText, { color: C.orange }]}>
              Ungespeicherte Änderungen — bitte speichern
            </Text>
          </View>
        ) : null}

        {saveFlash && !isDirty ? (
          <View style={[s.dirtyBanner, { backgroundColor: "rgba(48,209,88,0.12)", borderColor: C.green }]}>
            <Text style={[s.dirtyBannerText, { color: C.green }]}>Protokoll gespeichert</Text>
          </View>
        ) : null}

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[s.intro, { color: C.text2 }]}>
            Dokumentieren Sie Fahrzeugannahme und -rückgabe mit Notizen und Fotos.
          </Text>

          <HandoverProtocolSection
            title="Fahrzeugannahme"
            section={draft.handover}
            onChangeSection={(patch) => updateSection("handover", patch)}
            C={C}
            accentColor={C.teal}
          />

          <HandoverProtocolSection
            title="Fahrzeugrückgabe"
            section={draft.vehicleReturn}
            onChangeSection={(patch) => updateSection("vehicleReturn", patch)}
            C={C}
            accentColor={C.blue}
          />
        </ScrollView>

        <View style={[s.footer, { borderTopColor: C.border, backgroundColor: C.bg }]}>
          <TouchableOpacity
            onPress={() => void handleSave()}
            disabled={saving || !isDirty}
            accessibilityRole="button"
            accessibilityLabel="Protokoll speichern"
            style={[
              s.saveBtn,
              { backgroundColor: C.blue },
              (!isDirty || saving) && { opacity: 0.5 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.saveBtnText}>
                {isDirty ? "Speichern" : "Gespeichert"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/**
 * @param {string} bookingId
 * @returns {import("../lib/handoverProtocol").HandoverProtocol}
 */
function createSnapshotForEmpty(bookingId) {
  const p = getOrCreateHandoverProtocol(bookingId);
  return cloneHandoverProtocol(p);
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
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 18, fontWeight: "600" },
  dirtyBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dirtyBannerText: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 8 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
