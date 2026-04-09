import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as authApi from "../api/auth";
import {
  authenticateWithBiometric,
  deleteTokenFromAsync,
  deleteTokenFromSecure,
  getBiometricCapabilities,
  getBiometricLabelAsync,
  getBiometricLoginEnabledPref,
  isBiometricPlatformAvailable,
  readTokenFromAsync,
  readTokenFromSecure,
  setBiometricLoginEnabledPref,
  writeTokenToAsync,
  writeTokenToSecure,
} from "../lib/biometricStorage";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [awaitingBiometric, setAwaitingBiometric] = useState(false);
  const [biometricMeta, setBiometricMeta] = useState({
    supported: false,
    label: "Biometrie",
    loginEnabledPref: false,
  });

  const refreshBiometricMeta = useCallback(async () => {
    if (!isBiometricPlatformAvailable()) {
      setBiometricMeta({ supported: false, label: "Biometrie", loginEnabledPref: false });
      return;
    }
    const cap = await getBiometricCapabilities();
    const label = await getBiometricLabelAsync();
    const loginEnabledPref = await getBiometricLoginEnabledPref();
    setBiometricMeta({
      supported: cap.supported,
      label,
      loginEnabledPref,
    });
  }, []);

  useEffect(() => {
    refreshBiometricMeta();
  }, [refreshBiometricMeta]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!isBiometricPlatformAvailable()) {
          const stored = await readTokenFromAsync();
          if (!cancelled) setToken(stored);
          return;
        }
        const bioOn = await getBiometricLoginEnabledPref();
        if (!bioOn) {
          const stored = await readTokenFromAsync();
          if (!cancelled) setToken(stored);
          return;
        }
        const secureTok = await readTokenFromSecure();
        if (!secureTok) {
          await setBiometricLoginEnabledPref(false);
          const fallback = await readTokenFromAsync();
          if (!cancelled) setToken(fallback);
          return;
        }
        if (!cancelled) setAwaitingBiometric(true);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlockWithBiometric = useCallback(async () => {
    const ok = await authenticateWithBiometric("Anmeldung bestätigen");
    if (!ok) return;
    const t = await readTokenFromSecure();
    if (t) {
      setToken(t);
      setAwaitingBiometric(false);
    }
  }, []);

  const cancelBiometricUsePassword = useCallback(async () => {
    await setBiometricLoginEnabledPref(false);
    await deleteTokenFromSecure();
    await deleteTokenFromAsync();
    setAwaitingBiometric(false);
    setToken(null);
    await refreshBiometricMeta();
  }, [refreshBiometricMeta]);

  const login = useCallback(
    async (username, password) => {
      const next = await authApi.login(username, password);
      await writeTokenToAsync(next);
      await deleteTokenFromSecure();
      await setBiometricLoginEnabledPref(false);
      setAwaitingBiometric(false);
      setToken(next);
      await refreshBiometricMeta();
    },
    [refreshBiometricMeta]
  );

  const logout = useCallback(async () => {
    await deleteTokenFromAsync();
    await deleteTokenFromSecure();
    await setBiometricLoginEnabledPref(false);
    setAwaitingBiometric(false);
    setToken(null);
    await refreshBiometricMeta();
  }, [refreshBiometricMeta]);

  const enableBiometricLogin = useCallback(async () => {
    if (!token) throw new Error("Not logged in");
    if (!isBiometricPlatformAvailable()) {
      throw new Error("Biometrie ist auf dieser Plattform nicht verfügbar");
    }
    const cap = await getBiometricCapabilities();
    if (!cap.supported) {
      throw new Error("Keine Biometrie auf diesem Gerät eingerichtet");
    }
    const ok = await authenticateWithBiometric("Biometrie für Parkingsoft aktivieren");
    if (!ok) return;
    await writeTokenToSecure(token);
    await deleteTokenFromAsync();
    await setBiometricLoginEnabledPref(true);
    await refreshBiometricMeta();
  }, [token, refreshBiometricMeta]);

  const disableBiometricLogin = useCallback(async () => {
    const t = token ?? (await readTokenFromSecure());
    await setBiometricLoginEnabledPref(false);
    await deleteTokenFromSecure();
    if (t) await writeTokenToAsync(t);
    await refreshBiometricMeta();
  }, [token, refreshBiometricMeta]);

  const value = useMemo(
    () => ({
      token,
      hydrated,
      login,
      logout,
      isAuthenticated: Boolean(token),
      needsBiometricUnlock: awaitingBiometric,
      unlockWithBiometric,
      cancelBiometricUsePassword,
      enableBiometricLogin,
      disableBiometricLogin,
      biometricLabel: biometricMeta.label,
      biometricSupported: biometricMeta.supported,
      biometricLoginEnabled: biometricMeta.loginEnabledPref,
      refreshBiometricMeta,
    }),
    [
      token,
      hydrated,
      login,
      logout,
      awaitingBiometric,
      unlockWithBiometric,
      cancelBiometricUsePassword,
      enableBiometricLogin,
      disableBiometricLogin,
      biometricMeta.label,
      biometricMeta.supported,
      biometricMeta.loginEnabledPref,
      refreshBiometricMeta,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
