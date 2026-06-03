import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  Alert,
} from "react-native";
import SignaturePad, {
  cloneSignatureStrokes,
  signatureStrokesHasInk,
} from "./SignaturePad";

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {() => void} props.onClose
 * @param {(strokes: Array<Array<{ x: number; y: number }>>) => void} props.onConfirm
 * @param {Array<Array<{ x: number; y: number }>>} props.initialStrokes
 * @param {string} [props.title]
 * @param {object} props.C
 */
export default function SignatureCaptureModal({
  visible,
  onClose,
  onConfirm,
  initialStrokes,
  title = "Unterschrift Kunde",
  C,
}) {
  const [draftStrokes, setDraftStrokes] = useState(() => cloneSignatureStrokes(initialStrokes));

  useEffect(() => {
    if (!visible) return;
    setDraftStrokes(cloneSignatureStrokes(initialStrokes));
  }, [visible, initialStrokes]);

  const handleClear = useCallback(() => {
    Alert.alert("Unterschrift löschen?", "Die aktuelle Zeichnung wird entfernt.", [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: () => setDraftStrokes([]),
      },
    ]);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!signatureStrokesHasInk(draftStrokes)) {
      Alert.alert("Unterschrift", "Bitte zuerst unterschreiben.");
      return;
    }
    onConfirm(cloneSignatureStrokes(draftStrokes));
    onClose();
  }, [draftStrokes, onConfirm, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[s.safe, { backgroundColor: C.bg }]}>
        <View style={[s.header, { borderBottomColor: C.border }]}>
          <View style={s.headerTextWrap}>
            <Text style={[s.title, { color: C.text }]}>{title}</Text>
            <Text style={[s.subtitle, { color: C.text2 }]}>
              Bitte im weißen Feld unterschreiben
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Abbrechen"
            style={[s.closeBtn, { backgroundColor: C.surface2 }]}
          >
            <Text style={[s.closeBtnText, { color: C.text }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={s.padWrap}>
          <SignaturePad
            large
            strokes={draftStrokes}
            onChangeStrokes={setDraftStrokes}
            C={C}
          />
        </View>

        <View style={[s.footer, { borderTopColor: C.border, backgroundColor: C.bg }]}>
          <TouchableOpacity
            onPress={handleClear}
            accessibilityRole="button"
            style={[s.secondaryBtn, { borderColor: C.border, backgroundColor: C.surface2 }]}
          >
            <Text style={[s.secondaryBtnText, { color: C.text }]}>Löschen</Text>
          </TouchableOpacity>
          <View style={s.footerMain}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              style={[s.secondaryBtn, s.footerBtnFlex, { borderColor: C.border, backgroundColor: C.surface }]}
            >
              <Text style={[s.secondaryBtnText, { color: C.text2 }]}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              accessibilityRole="button"
              style={[s.okBtn, s.footerBtnFlex, { backgroundColor: C.blue }]}
            >
              <Text style={s.okBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 4 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 18, fontWeight: "600" },
  padWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    minHeight: 280,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 8 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  footerMain: { flexDirection: "row", gap: 10 },
  footerBtnFlex: { flex: 1 },
  secondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "600" },
  okBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  okBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
