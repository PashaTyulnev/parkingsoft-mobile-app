import React, { useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import SignaturePad, { signatureStrokesHasInk } from "./SignaturePad";
import {
  createEmptyHandoverProtocolSignature,
  formatHandoverProtocolTimestamp,
  handoverProtocolSignatureHasContent,
  pickMockHandoverProtocolPhoto,
} from "../lib/handoverProtocol";

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
  const statusLabel = formatHandoverProtocolTimestamp(section.updatedAt);
  const signature = section.customerSignature ?? createEmptyHandoverProtocolSignature();
  const signatureSignedLabel = formatHandoverProtocolTimestamp(signature.signedAt);

  const handleAddPhoto = useCallback(() => {
    Alert.alert(
      "Foto hinzufügen",
      "Die Kamera-Integration folgt. Für jetzt wird ein Platzhalter-Foto angelegt.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Platzhalter-Foto",
          onPress: () => {
            void (async () => {
              const photo = await pickMockHandoverProtocolPhoto();
              if (!photo) return;
              onChangeSection({
                photos: [...section.photos, photo],
              });
            })();
          },
        },
      ]
    );
  }, [onChangeSection, section.photos]);

  const handleRemovePhoto = useCallback(
    (photoId) => {
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
    [onChangeSection, section.photos]
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
        {statusLabel ? (
          <Text style={[s.statusText, { color: C.text3 }]}>Zuletzt: {statusLabel}</Text>
        ) : (
          <Text style={[s.statusText, { color: C.text3 }]}>Noch nicht gespeichert</Text>
        )}
      </View>

      <Text style={[s.fieldLabel, { color: C.text3 }]}>Notizen</Text>
      <TextInput
        value={section.notes}
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
              <Text style={s.photoPlaceholderIcon} allowFontScaling={false}>
                📷
              </Text>
              <Text style={[s.photoPlaceholderLabel, { color: C.text2 }]} numberOfLines={1}>
                Foto {index + 1}
              </Text>
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
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        onPress={handleAddPhoto}
        accessibilityRole="button"
        accessibilityLabel="Foto hinzufügen"
        style={[s.addPhotoBtn, { borderColor: C.border, backgroundColor: C.surface2 }]}
      >
        <Text style={[s.addPhotoBtnText, { color: C.blue }]}>Foto hinzufügen</Text>
      </TouchableOpacity>

      <Text style={[s.fieldLabel, { color: C.text3, marginTop: 16 }]}>Unterschrift Kunde</Text>
      {signatureSignedLabel && handoverProtocolSignatureHasContent(signature) ? (
        <Text style={[s.signatureMeta, { color: C.text3 }]}>
          Unterschrieben: {signatureSignedLabel}
        </Text>
      ) : (
        <Text style={[s.signatureMeta, { color: C.text3 }]}>
          Bestätigung durch Unterschrift auf dem Display
        </Text>
      )}
      <SignaturePad
        strokes={signature.strokes}
        onChangeStrokes={(strokes) =>
          onChangeSection({
            customerSignature: {
              strokes,
              signedAt: signatureStrokesHasInk(strokes) ? signature.signedAt : null,
            },
          })
        }
        C={C}
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
});
