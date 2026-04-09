import React, { useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * @param {object} props
 * @param {string} props.biometricLabel e.g. Face ID
 * @param {() => Promise<void>} props.onUnlock
 * @param {() => Promise<void>} props.onUsePassword
 */
export default function BiometricUnlockScreen({
  biometricLabel,
  onUnlock,
  onUsePassword,
}) {
  const [busy, setBusy] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const handleBio = async () => {
    setBusy(true);
    try {
      await onUnlock();
    } finally {
      setBusy(false);
    }
  };

  const handlePw = async () => {
    setPwBusy(true);
    try {
      await onUsePassword();
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.inner}>
        <View style={s.hero}>
          <View style={s.logoRing}>
            <Text style={s.logoGlyph}>P</Text>
          </View>
          <Text style={s.title}>Parkingsoft</Text>
          <Text style={s.subtitle}>Gespeicherte Anmeldung gesperrt</Text>
        </View>

        <TouchableOpacity
          style={[s.primaryBtn, busy && s.btnDisabled]}
          onPress={handleBio}
          disabled={busy || pwBusy}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Mit ${biometricLabel} anmelden`}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.primaryBtnText}>Mit {biometricLabel} anmelden</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.secondaryBtn, pwBusy && s.btnDisabled]}
          onPress={handlePw}
          disabled={busy || pwBusy}
          accessibilityRole="button"
          accessibilityLabel="Mit Passwort anmelden"
        >
          {pwBusy ? (
            <ActivityIndicator color="#0A84FF" />
          ) : (
            <Text style={s.secondaryBtnText}>Mit Passwort anmelden</Text>
          )}
        </TouchableOpacity>

        <Text style={s.hint}>
          Mit Passwort anmelden deaktiviert die biometrische Anmeldung auf diesem Gerät.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    justifyContent: "center",
  },
  hero: { alignItems: "center", marginBottom: 40 },
  logoRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoGlyph: { fontSize: 36, fontWeight: "600", color: "#fff", letterSpacing: -1 },
  title: { fontSize: 28, fontWeight: "700", color: "#fff", letterSpacing: -0.5 },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#0A84FF",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.65 },
  primaryBtnText: { fontSize: 17, fontWeight: "600", color: "#fff" },
  secondaryBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(10,132,255,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { fontSize: 16, fontWeight: "600", color: "#0A84FF" },
  hint: {
    marginTop: 28,
    textAlign: "center",
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    lineHeight: 18,
  },
});
