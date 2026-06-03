import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Image,
} from "react-native";
import SignaturePad from "./SignaturePad";
import SignatureCaptureModal from "./SignatureCaptureModal";
import {
  createEmptyHandoverProtocolSignature,
  formatHandoverProtocolTimestamp,
  handoverProtocolSignatureHasContent,
} from "../lib/handoverProtocol";
import { pickHandoverProtocolPhotoInteractive } from "../lib/handoverProtocolPhoto";

/**
 * @param {object} props
 * @param {string} props.title
 * @param {import("../lib/handoverProtocol").HandoverProtocolSection} props.section
 * @param {(patch: Partial<import("../lib/handoverProtocol").HandoverProtocolSection>) => void} props.onChangeSection
 * @param {object} props.C
 * @param {string} [props.accentColor]
 */
export default function HandoverProtocolSection({
  title,
  section,
  onChangeSection,
  C,
  accentColor,
}) {
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const statusLabel = formatHandoverProtocolTimestamp(section.updatedAt);
  const signature = section.customerSignature ?? createEmptyHandoverProtocolSignature();
  const signatureSignedLabel = formatHandoverProtocolTimestamp(signature.signedAt);
  const hasSignature = handoverProtocolSignatureHasContent(signature);
  const strokePreview =
    Array.isArray(signature.strokes) &&
    signature.strokes.some((stroke) => Array.isArray(stroke) && stroke.length > 0);
  const readOnly = section.finalized === true;

  const handleAddPhoto = useCallback(() => {
    if (readOnly) return;
    void (async () => {
      const photo = await pickHandoverProtocolPhotoInteractive();
      if (!photo) return;
      onChangeSection({
        photos: [...section.photos, photo],
      });
    })();
  }, [onChangeSection, section.photos, readOnly]);

  const handleRemovePhoto = useCallback(
    (photoId) => {
      if (readOnly) return;
      Alert.alert("Foto entfernen?", "Das Foto wird aus dem Protokoll entfernt.", [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Entfernen",
          style: "destructive",
          onPress: () => {
            onChangeSection({
              photos: section.photos.filter((p) => p.id !== photoId),
            });
          },
        },
      ]);
    },
    [onChangeSection, section.photos, readOnly]
  );

  return (
    <View
      style={[
        s.card,
        { backgroundColor: C.surface, borderColor: C.border },
        accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : null,
      ]}
    >
      <View style={s.cardHeader}>
        <Text style={[s.cardTitle, { color: C.text }]}>{title}</Text>
        {section.finalized ? (
          <Text style={[s.statusText, { color: C.green }]}>Finalisiert</Text>
        ) : statusLabel ? (
          <Text style={[s.statusText, { color: C.text3 }]}>Zuletzt: {statusLabel}</Text>
        ) : (
          <Text style={[s.statusText, { color: C.text3 }]}>Noch nicht gespeichert</Text>
        )}
      </View>

      <Text style={[s.fieldLabel, { color: C.text3 }]}>Notizen</Text>
      <TextInput
        value={section.notes}
        editable={!readOnly}
        onChangeText={(notes) => onChangeSection({ notes })}
        placeholder="Schäden, Kilometerstand, Zubehör …"
        placeholderTextColor={C.text3}
        multiline
        style={[
          s.textArea,
          { borderColor: C.border, backgroundColor: C.surface2, color: C.text },
        ]}
      />

      <Text style={[s.fieldLabel, { color: C.text3, marginTop: 14 }]}>Fotos</Text>
      {section.photos.length === 0 ? (
        <Text style={[s.emptyPhotos, { color: C.text3 }]}>Noch keine Fotos hinzugefügt</Text>
      ) : (
        <View style={s.photoGrid}>
          {section.photos.map((photo, index) => (
            <View
              key={photo.id}
              style={[s.photoTile, { backgroundColor: C.surface2, borderColor: C.border }]}
            >
              {photo.uri && !photo.uri.startsWith("mock://") ? (
                <Image source={{ uri: photo.uri }} style={s.photoImage} resizeMode="cover" />
              ) : (
                <>
                  <Text style={s.photoPlaceholderIcon} allowFontScaling={false}>
                    📷
                  </Text>
                  <Text style={[s.photoPlaceholderLabel, { color: C.text2 }]} numberOfLines={1}>
                    Foto {index + 1}
                  </Text>
                </>
              )}
              {!readOnly ? (
              <Pressable
                onPress={() => handleRemovePhoto(photo.id)}
                accessibilityRole="button"
                accessibilityLabel={`Foto ${index + 1} entfernen`}
                style={({ pressed }) => [
                  s.photoRemove,
                  { backgroundColor: C.red },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={s.photoRemoveText}>✕</Text>
              </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {!readOnly ? (
      <TouchableOpacity
        onPress={handleAddPhoto}
        accessibilityRole="button"
        accessibilityLabel="Foto hinzufügen"
        style={[s.addPhotoBtn, { borderColor: C.border, backgroundColor: C.surface2 }]}
      >
        <Text style={[s.addPhotoBtnText, { color: C.blue }]}>Foto hinzufügen</Text>
      </TouchableOpacity>
      ) : null}

      <Text style={[s.fieldLabel, { color: C.text3, marginTop: 16 }]}>Unterschrift Kunde</Text>
      {signatureSignedLabel && hasSignature ? (
        <Text style={[s.signatureMeta, { color: C.text3 }]}>
          Unterschrieben: {signatureSignedLabel}
        </Text>
      ) : null}

      <Pressable
        onPress={() => !readOnly && setSignatureModalVisible(true)}
        disabled={readOnly}
        accessibilityRole="button"
        accessibilityLabel={hasSignature ? "Unterschrift anzeigen" : "Unterschrift erfassen"}
        style={({ pressed }) => [
          s.signatureField,
          { borderColor: C.border, backgroundColor: "#fff" },
          !readOnly && pressed && { opacity: 0.92 },
        ]}
      >
        {strokePreview ? (
          <SignaturePad
            strokes={signature.strokes}
            readOnly
            compact
            C={C}
            showClear={false}
            onChangeStrokes={() => {}}
          />
        ) : signature.signatureData ? (
          <Image
            source={{ uri: signature.signatureData }}
            style={s.signatureImage}
            resizeMode="contain"
          />
        ) : (
          <Text style={[s.signatureFieldPlaceholder, { color: C.text3 }]}>
            Tippen zum Unterschreiben
          </Text>
        )}
      </Pressable>

      {!readOnly ? (
      <TouchableOpacity
        onPress={() => setSignatureModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={hasSignature ? "Unterschrift ändern" : "Unterschrift erfassen"}
        style={[s.signatureOpenBtn, { borderColor: C.border, backgroundColor: C.surface }]}
      >
        <Text style={[s.signatureOpenBtnText, { color: C.blue }]}>
          {hasSignature ? "Unterschrift ändern" : "Unterschrift erfassen"}
        </Text>
      </TouchableOpacity>
      ) : null}

      <SignatureCaptureModal
        visible={signatureModalVisible}
        onClose={() => setSignatureModalVisible(false)}
        initialStrokes={signature.strokes}
        title={`Unterschrift — ${title}`}
        C={C}
        onConfirm={(strokes) =>
          onChangeSection({
            customerSignature: {
              strokes,
              signedAt: null,
              signatureData: null,
            },
          })
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  cardHeader: { marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  statusText: { fontSize: 12, marginTop: 4, fontWeight: "500" },
  fieldLabel: { fontSize: 11, fontWeight: "600", marginBottom: 6 },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 96,
    textAlignVertical: "top",
  },
  emptyPhotos: { fontSize: 13, marginBottom: 10, fontStyle: "italic" },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },
  photoTile: {
    width: "30%",
    minWidth: 96,
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    position: "relative",
  },
  photoPlaceholderIcon: { fontSize: 28, marginBottom: 4 },
  photoPlaceholderLabel: { fontSize: 11, fontWeight: "600" },
  photoImage: { width: "100%", height: "100%", borderRadius: 8 },
  photoRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: Platform.OS === "ios" ? -1 : 0,
  },
  addPhotoBtn: {
    borderWidth: 1,
    borderRadius: 10,
    borderStyle: "dashed",
    paddingVertical: 12,
    alignItems: "center",
  },
  addPhotoBtnText: { fontSize: 14, fontWeight: "600" },
  signatureMeta: { fontSize: 12, marginBottom: 8, fontWeight: "500" },
  signatureField: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
    height: 100,
    justifyContent: "center",
  },
  signatureFieldPlaceholder: {
    fontSize: 13,
    fontWeight: "500",
    fontStyle: "italic",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  signatureImage: { width: "100%", height: "100%" },
  signatureOpenBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  signatureOpenBtnText: { fontSize: 14, fontWeight: "600" },
});
