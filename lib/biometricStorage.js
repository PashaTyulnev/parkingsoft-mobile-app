import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/** Same key as legacy `AuthContext` AsyncStorage token. */
export const AUTH_TOKEN_ASYNC_KEY = "parkingsoft_auth_token";

export const AUTH_TOKEN_SECURE_KEY = "parkingsoft_auth_token_secure";

export const BIOMETRIC_PREF_KEY = "parkingsoft_biometric_login_enabled";

const BIOMETRIC_PREF_ON = "1";

/**
 * @returns {boolean}
 */
export function isBiometricPlatformAvailable() {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/**
 * @returns {Promise<{ supported: boolean; enrolled: boolean }>}
 */
export async function getBiometricCapabilities() {
  if (!isBiometricPlatformAvailable()) {
    return { supported: false, enrolled: false };
  }
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  const enrolled = Boolean(isEnrolled);
  return { supported: Boolean(hasHardware) && enrolled, enrolled };
}

/**
 * @returns {Promise<boolean>}
 */
export async function getBiometricLoginEnabledPref() {
  const v = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY);
  return v === BIOMETRIC_PREF_ON;
}

/**
 * @param {boolean} enabled
 */
export async function setBiometricLoginEnabledPref(enabled) {
  if (enabled) await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, BIOMETRIC_PREF_ON);
  else await AsyncStorage.removeItem(BIOMETRIC_PREF_KEY);
}

/**
 * @returns {Promise<string | null>}
 */
export async function readTokenFromAsync() {
  return AsyncStorage.getItem(AUTH_TOKEN_ASYNC_KEY);
}

/**
 * @param {string} token
 */
export async function writeTokenToAsync(token) {
  await AsyncStorage.setItem(AUTH_TOKEN_ASYNC_KEY, token);
}

/**
 * @returns {Promise<string | null>}
 */
export async function readTokenFromSecure() {
  try {
    return await SecureStore.getItemAsync(AUTH_TOKEN_SECURE_KEY);
  } catch {
    return null;
  }
}

/**
 * @param {string} token
 */
export async function writeTokenToSecure(token) {
  await SecureStore.setItemAsync(AUTH_TOKEN_SECURE_KEY, token);
}

export async function deleteTokenFromSecure() {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_SECURE_KEY);
  } catch {
    // Key may be missing
  }
}

export async function deleteTokenFromAsync() {
  await AsyncStorage.removeItem(AUTH_TOKEN_ASYNC_KEY);
}

/**
 * @param {string} promptMessage
 * @returns {Promise<boolean>}
 */
export async function authenticateWithBiometric(promptMessage) {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "Abbrechen",
    disableDeviceFallback: false,
  });
  return Boolean(result.success);
}

/**
 * @returns {Promise<string>}
 */
export async function getBiometricLabelAsync() {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return "Face ID";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return "Fingerabdruck";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "Iris";
  }
  return "Biometrie";
}
