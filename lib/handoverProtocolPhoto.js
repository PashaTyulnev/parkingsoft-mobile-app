import { Alert, Linking, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";

/** @typedef {import("./handoverProtocol").HandoverProtocolPhoto} HandoverProtocolPhoto */

const PICKER_QUALITY = 0.85;

/**
 * @param {import("expo-image-picker").ImagePickerAsset} asset
 * @returns {HandoverProtocolPhoto}
 */
export function handoverProtocolPhotoFromAsset(asset) {
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const name = asset.fileName ?? `photo-${id}.jpg`;
  return {
    id,
    uri: asset.uri,
    originalName: name,
    addedAt: Date.now(),
    isLocal: true,
  };
}

/**
 * @param {boolean} granted
 * @param {string} kind
 */
function alertPermissionDenied(granted, kind) {
  if (granted) return;
  const label = kind === "camera" ? "Kamera" : "Fotos";
  Alert.alert(
    `${label} nicht verfügbar`,
    `Bitte erlauben Sie den Zugriff auf die ${label} in den Geräteeinstellungen.`,
    [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Einstellungen",
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ]
  );
}

/**
 * @returns {Promise<boolean>}
 */
export async function ensureCameraPermissionForProtocol() {
  const existing = await ImagePicker.getCameraPermissionsAsync();
  if (existing.granted) return true;
  const requested = await ImagePicker.requestCameraPermissionsAsync();
  if (!requested.granted) {
    alertPermissionDenied(false, "camera");
  }
  return requested.granted;
}

/**
 * @returns {Promise<boolean>}
 */
export async function ensureMediaLibraryPermissionForProtocol() {
  const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (existing.granted) return true;
  const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!requested.granted) {
    alertPermissionDenied(false, "library");
  }
  return requested.granted;
}

/**
 * @returns {Promise<HandoverProtocolPhoto | null>}
 */
export async function pickHandoverProtocolPhotoFromCamera() {
  if (Platform.OS === "web") {
    Alert.alert("Kamera", "Die Kamera ist in der Web-Version nicht verfügbar. Bitte Galerie wählen.");
    return null;
  }
  const allowed = await ensureCameraPermissionForProtocol();
  if (!allowed) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: PICKER_QUALITY,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return handoverProtocolPhotoFromAsset(result.assets[0]);
}

/**
 * @returns {Promise<HandoverProtocolPhoto | null>}
 */
export async function pickHandoverProtocolPhotoFromLibrary() {
  const allowed = await ensureMediaLibraryPermissionForProtocol();
  if (!allowed) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: PICKER_QUALITY,
    allowsEditing: false,
    allowsMultipleSelection: false,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return handoverProtocolPhotoFromAsset(result.assets[0]);
}

/**
 * @returns {Promise<HandoverProtocolPhoto | null>}
 */
export function pickHandoverProtocolPhotoInteractive() {
  if (Platform.OS === "web") {
    return pickHandoverProtocolPhotoFromLibrary();
  }

  return new Promise((resolve) => {
    Alert.alert("Foto hinzufügen", "Kamera oder Galerie wählen", [
      { text: "Abbrechen", style: "cancel", onPress: () => resolve(null) },
      {
        text: "Kamera",
        onPress: () => {
          void pickHandoverProtocolPhotoFromCamera().then(resolve);
        },
      },
      {
        text: "Galerie",
        onPress: () => {
          void pickHandoverProtocolPhotoFromLibrary().then(resolve);
        },
      },
    ]);
  });
}
