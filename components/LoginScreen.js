import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_BASE_URL } from "../api/config";

/**
 * Apple-style dark login (minimal, high contrast).
 * @param {{ onLogin: (username: string, password: string) => Promise<void> }} props
 */
export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    const u = username.trim();
    if (!u || !password) {
      setError("Bitte Benutzername und Passwort eingeben.");
      return;
    }
    setLoading(true);
    try {
      await onLogin(u, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anmeldung fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.hero}>
            <View style={s.logoRing}>
              <Text style={s.logoGlyph}>P</Text>
            </View>
            <Text style={s.title}>Parkingsoft</Text>
            <Text style={s.subtitle}>Melde dich an, um fortzufahren</Text>
          </View>

          <View style={s.form}>
            <Text style={s.label}>Benutzername</Text>
            <TextInput
              style={s.input}
              placeholder="Benutzername"
              placeholderTextColor="#636366"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              value={username}
              onChangeText={setUsername}
              returnKeyType="next"
            />

            <Text style={[s.label, s.labelSpaced]}>Passwort</Text>
            <TextInput
              style={s.input}
              placeholder="Passwort"
              placeholderTextColor="#636366"
              secureTextEntry
              editable={!loading}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryBtnText}>Anmelden</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={s.hint} numberOfLines={2}>
            API: {API_BASE_URL}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 24,
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
  logoGlyph: {
    fontSize: 36,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: -1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "400",
  },
  form: { width: "100%" },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
    marginBottom: 8,
    marginLeft: 4,
  },
  labelSpaced: { marginTop: 4 },
  input: {
    height: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 17,
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)",
  },
  error: {
    marginTop: 14,
    marginHorizontal: 4,
    fontSize: 14,
    color: "#FF453A",
    fontWeight: "500",
  },
  primaryBtn: {
    marginTop: 28,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#0A84FF",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDisabled: { opacity: 0.65 },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  hint: {
    marginTop: 28,
    textAlign: "center",
    fontSize: 11,
    color: "rgba(255,255,255,0.28)",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
