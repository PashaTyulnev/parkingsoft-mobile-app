import { Alert } from "react-native";
import {
  handoverProtocolPhotoFromAsset,
  pickHandoverProtocolPhotoFromCamera,
  pickHandoverProtocolPhotoFromLibrary,
} from "../handoverProtocolPhoto";

jest.mock("expo-image-picker", () => ({
  getCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({
    canceled: false,
    assets: [
      {
        uri: "file:///camera.jpg",
        fileName: "camera.jpg",
      },
    ],
  })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [
      {
        uri: "file:///library.jpg",
        fileName: "library.jpg",
      },
    ],
  })),
}));

describe("handoverProtocolPhoto", () => {
  it("maps picker asset to local photo", () => {
    const photo = handoverProtocolPhotoFromAsset({
      uri: "file:///x.jpg",
      fileName: "x.jpg",
    });
    expect(photo.uri).toBe("file:///x.jpg");
    expect(photo.isLocal).toBe(true);
    expect(photo.originalName).toBe("x.jpg");
  });

  it("picks from camera when permitted", async () => {
    const photo = await pickHandoverProtocolPhotoFromCamera();
    expect(photo?.uri).toBe("file:///camera.jpg");
  });

  it("picks from library when permitted", async () => {
    const photo = await pickHandoverProtocolPhotoFromLibrary();
    expect(photo?.uri).toBe("file:///library.jpg");
  });

  it("returns null when camera denied", async () => {
    const ImagePicker = require("expo-image-picker");
    ImagePicker.getCameraPermissionsAsync.mockResolvedValueOnce({ granted: false });
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValueOnce({ granted: false });
    jest.spyOn(Alert, "alert").mockImplementation(() => {});

    const photo = await pickHandoverProtocolPhotoFromCamera();
    expect(photo).toBeNull();
    expect(Alert.alert).toHaveBeenCalled();
  });
});
