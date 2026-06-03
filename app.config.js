const path = require("path");
const appJson = require("./app.json");

// .env wins over stale Windows/macOS user env vars (common cause of stuck 127.0.0.1)
require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: true,
});

const apiBaseUrl = String(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://parkingsoft.de"
).replace(/\/$/, "");

module.exports = {
  expo: {
    ...appJson.expo,
    plugins: [
      ...(appJson.expo?.plugins ?? []),
      "expo-secure-store",
      [
        "expo-local-authentication",
        {
          faceIDPermission:
            "Parkingsoft nutzt Face ID, um dich schneller anzumelden.",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Parkingsoft benötigt Zugriff auf Ihre Fotos für das Übergabeprotokoll.",
          cameraPermission:
            "Parkingsoft benötigt die Kamera für Fotos im Übergabeprotokoll.",
        },
      ],
    ],
    extra: {
      ...(appJson.expo?.extra ?? {}),
      eas: {
        projectId: "e5e82dcc-9f17-4cf4-ace6-ac5e88fdb704"
      },
      apiBaseUrl,
    },
  },
};
