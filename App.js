import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import BookingsPage, { DAY_MODE } from "./components/BookingsPage";
import EmployeeTimePage from "./components/EmployeeTimePage";
import ShiftsPage from "./components/ShiftsPage";
import LoginScreen from "./components/LoginScreen";
import BiometricUnlockScreen from "./components/BiometricUnlockScreen";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { fetchBookingsFiltered } from "./api/bookings";
import {
  fetchBookingDetailStatusesAll,
  parseDetailStatusPostResponse,
  patchBookingDetailStatusFromPostResponse,
} from "./api/bookingDetailStatus";
import { AuthError } from "./api/errors";
import { fetchCurrentUser } from "./api/currentUser";
import { fetchMyShifts, parseMyShiftsResponse } from "./api/myShifts";
import {
  fetchTimeTrackerCheckIn,
  fetchTimeTrackerCheckout,
  fetchTimeTrackerStatus,
  fetchTimeTrackerOverviewAll,
  postTimeTrackerUserTotals,
  filterRawOverviewForCurrentUser,
  pickClockTimeFromTimetrackerJson,
  normalizeTimeTrackerStatusPayload,
  parseTimeTrackerOverviewResponse,
  normalizeUserTotalsResponse,
  fetchTimetrackerLastUserInformation,
  parseLastUserInformationResponse,
  LAST_USER_FILTER_ALL,
  LAST_USER_FILTER_CHECKIN,
} from "./api/timetracker";

const C = {
  bg: "#000",
  surface: "#1C1C1E",
  surface2: "#2C2C2E",
  border: "rgba(255,255,255,0.1)",
  text: "#fff",
  text2: "rgba(255,255,255,0.55)",
  text3: "rgba(255,255,255,0.3)",
  blue: "#0A84FF",
  green: "#30D158",
  yellow: "#FFD60A",
  teal: "#40CBE0",
  orange: "#FF9F0A",
  red: "#FF453A",
};

const TAB_ITEMS = [
  { icon: "📋", label: "Buchungen" },
  { icon: "⏱️", label: "Meine Zeiten" },
  { icon: "🗓️", label: "Schichten" },
  /** Re-enable with `AbsencesPage` when the feature is ready. */
  { icon: "🏖️", label: "Abwesenheiten", disabled: true },
];

function formatTime(value) {
  const h = String(value.getHours()).padStart(2, "0");
  const m = String(value.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function getHeaderTitle(index) {
  if (index === 1) return "Meine Zeiten";
  if (index === 2) return "Schichten";
  return "Buchungen";
}

function formatHeaderDate() {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    const d = new Date();
    return d.toLocaleDateString("de-DE");
  }
}

/**
 * @param {number} year
 * @param {number} month 1–12
 */
function formatOverviewPeriodLabel(year, month) {
  try {
    return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(
      new Date(year, month - 1, 1)
    );
  } catch {
    return `${month}/${year}`;
  }
}

function AppShell() {
  const insets = useSafeAreaInsets();
  const {
    token,
    hydrated,
    login,
    logout,
    isAuthenticated,
    needsBiometricUnlock,
    unlockWithBiometric,
    cancelBiometricUsePassword,
    biometricLabel,
    biometricSupported,
    biometricLoginEnabled,
    enableBiometricLogin,
    disableBiometricLogin,
  } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [activeFilter, setActiveFilter] = useState("Alle");
  const [dayMode, setDayMode] = useState(DAY_MODE.ARRIVAL);
  /** Calendar day for `bookings/filter` dateFrom/dateTo (local). */
  const [bookingsListDate, setBookingsListDate] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  });
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [detailStatusCatalog, setDetailStatusCatalog] = useState([]);
  const [notesByBooking, setNotesByBooking] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [employeeTime, setEmployeeTime] = useState({
    employee: "—",
    checkIn: "",
    checkOut: "",
  });
  const [timeActionLoading, setTimeActionLoading] = useState(false);
  /** Server timetracker `type` from `GET …/timetracker/status` (e.g. checkin | checkout). */
  const [timeTrackerKind, setTimeTrackerKind] = useState("");
  const [overviewYear, setOverviewYear] = useState(() => new Date().getFullYear());
  const [overviewMonth, setOverviewMonth] = useState(() => new Date().getMonth() + 1);
  const [timeOverviewRows, setTimeOverviewRows] = useState([]);
  const [timeOverviewLoading, setTimeOverviewLoading] = useState(false);
  const [timeOverviewError, setTimeOverviewError] = useState("");
  const [timeUserTotals, setTimeUserTotals] = useState(null);
  const [timeTotalsError, setTimeTotalsError] = useState("");
  const [myShifts, setMyShifts] = useState([]);
  const [myShiftsLoading, setMyShiftsLoading] = useState(false);
  const [myShiftsError, setMyShiftsError] = useState("");
  const [teamStatusRows, setTeamStatusRows] = useState([]);
  const [teamStatusLoading, setTeamStatusLoading] = useState(false);
  const [teamStatusError, setTeamStatusError] = useState("");
  const [teamStatusFilter, setTeamStatusFilter] = useState(LAST_USER_FILTER_CHECKIN);

  const filteredTeamStatusItems = useMemo(() => {
    if (teamStatusFilter === LAST_USER_FILTER_ALL) return teamStatusRows;
    return teamStatusRows.filter((r) => r.filterCategory === teamStatusFilter);
  }, [teamStatusRows, teamStatusFilter]);

  const loadBookings = useCallback(async () => {
    if (!token) return;
    setBookingsLoading(true);
    setBookingsError("");
    try {
      const list = await fetchBookingsFiltered(token, C, dayMode, bookingsListDate);
      setBookings(list);
    } catch (e) {
      if (e instanceof AuthError) {
        await logout();
        setBookingsError("");
        return;
      }
      setBookingsError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBookingsLoading(false);
    }
  }, [token, logout, dayMode, bookingsListDate]);

  const selectArrivalsToday = useCallback(() => {
    const n = new Date();
    setBookingsListDate(new Date(n.getFullYear(), n.getMonth(), n.getDate()));
    setDayMode(DAY_MODE.ARRIVAL);
  }, []);

  const selectDeparturesToday = useCallback(() => {
    const n = new Date();
    setBookingsListDate(new Date(n.getFullYear(), n.getMonth(), n.getDate()));
    setDayMode(DAY_MODE.DEPARTURE);
  }, []);

  const selectArrivalsTomorrow = useCallback(() => {
    const n = new Date();
    setBookingsListDate(new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1));
    setDayMode(DAY_MODE.ARRIVAL);
  }, []);

  const selectDeparturesTomorrow = useCallback(() => {
    const n = new Date();
    setBookingsListDate(new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1));
    setDayMode(DAY_MODE.DEPARTURE);
  }, []);

  const loadDetailStatuses = useCallback(async () => {
    if (!token) return;
    try {
      const list = await fetchBookingDetailStatusesAll(token);
      setDetailStatusCatalog(list);
    } catch (e) {
      if (e instanceof AuthError) {
        await logout();
        setDetailStatusCatalog([]);
        return;
      }
      setDetailStatusCatalog([]);
    }
  }, [token, logout]);

  const loadCurrentUser = useCallback(async () => {
    if (!token) return;
    try {
      const u = await fetchCurrentUser(token);
      setCurrentUser(u);
    } catch (e) {
      if (e instanceof AuthError) {
        await logout();
        setCurrentUser(null);
        return;
      }
      setCurrentUser(null);
    }
  }, [token, logout]);

  useEffect(() => {
    if (isAuthenticated) {
      loadBookings();
    } else {
      setBookings([]);
      setNotesByBooking({});
      setCurrentUser(null);
      setEmployeeTime({ employee: "—", checkIn: "", checkOut: "" });
      setTimeTrackerKind("");
      setTimeActionLoading(false);
      const d = new Date();
      setOverviewYear(d.getFullYear());
      setOverviewMonth(d.getMonth() + 1);
      setTimeOverviewRows([]);
      setTimeOverviewError("");
      setTimeUserTotals(null);
      setTimeTotalsError("");
      setMyShifts([]);
      setMyShiftsError("");
      setTeamStatusRows([]);
      setTeamStatusError("");
      setTeamStatusFilter(LAST_USER_FILTER_CHECKIN);
      setBookingsListDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      setDayMode(DAY_MODE.ARRIVAL);
    }
  }, [isAuthenticated, loadBookings]);

  useEffect(() => {
    if (isAuthenticated) {
      loadCurrentUser();
    }
  }, [isAuthenticated, loadCurrentUser]);

  useEffect(() => {
    if (isAuthenticated) {
      loadDetailStatuses();
    } else {
      setDetailStatusCatalog([]);
    }
  }, [isAuthenticated, loadDetailStatuses]);

  useEffect(() => {
    if (currentUser?.displayName) {
      setEmployeeTime((prev) => ({ ...prev, employee: currentUser.displayName }));
    }
  }, [currentUser]);

  const loadMyShifts = useCallback(async () => {
    if (!token) return;
    setMyShiftsLoading(true);
    setMyShiftsError("");
    try {
      const raw = await fetchMyShifts(token);
      setMyShifts(parseMyShiftsResponse(raw));
    } catch (e) {
      if (e instanceof AuthError) {
        await logout();
        setMyShifts([]);
        return;
      }
      setMyShiftsError(e instanceof Error ? e.message : "Schichten konnten nicht geladen werden");
      setMyShifts([]);
    } finally {
      setMyShiftsLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    if (!isAuthenticated || !token || activeTab !== 2) return;
    loadMyShifts();
  }, [activeTab, isAuthenticated, token, loadMyShifts]);

  /** Disabled tab must not stay selected (e.g. after hot reload). */
  useEffect(() => {
    const disabledIdx = TAB_ITEMS.findIndex((t) => Boolean(t.disabled));
    if (disabledIdx >= 0 && activeTab === disabledIdx) setActiveTab(0);
  }, [activeTab]);

  /**
   * Syncs check-in/out display from `GET …/timetracker/status`.
   * @returns {Promise<"ok" | "fail" | "auth">}
   */
  const loadTimeTrackerStatus = useCallback(async () => {
    if (!token) return "fail";
    try {
      const data = await fetchTimeTrackerStatus(token);
      const n = normalizeTimeTrackerStatusPayload(data);
      setTimeTrackerKind(n.kind);
      setEmployeeTime((prev) => ({
        ...prev,
        checkIn: n.checkIn || prev.checkIn,
        checkOut: n.kind === "checkin" ? "" : n.checkOut || prev.checkOut,
      }));
      return "ok";
    } catch (e) {
      if (e instanceof AuthError) {
        await logout();
        return "auth";
      }
      return "fail";
    }
  }, [token, logout]);

  useEffect(() => {
    if (!isAuthenticated || !token || activeTab !== 1) return;
    loadTimeTrackerStatus();
  }, [activeTab, isAuthenticated, token, loadTimeTrackerStatus]);

  const loadTimeOverview = useCallback(async () => {
    if (!token || !currentUser?.username) return;
    setTimeOverviewLoading(true);
    setTimeOverviewError("");
    setTimeTotalsError("");
    try {
      const raw = await fetchTimeTrackerOverviewAll(token, {
        year: overviewYear,
        month: overviewMonth,
        userId: currentUser.id,
      });
      setTimeOverviewRows(parseTimeTrackerOverviewResponse(raw, currentUser));
      const payloadForTotals = filterRawOverviewForCurrentUser(raw, currentUser);
      try {
        const totalsRaw = await postTimeTrackerUserTotals(token, payloadForTotals);
        setTimeUserTotals(normalizeUserTotalsResponse(totalsRaw));
      } catch (te) {
        if (te instanceof AuthError) {
          await logout();
          setTimeUserTotals(null);
          setTimeOverviewRows([]);
          return;
        }
        setTimeUserTotals(null);
        setTimeTotalsError(te instanceof Error ? te.message : "Summen fehlgeschlagen");
      }
    } catch (e) {
      if (e instanceof AuthError) {
        await logout();
        setTimeOverviewRows([]);
        setTimeUserTotals(null);
        return;
      }
      setTimeOverviewError(e instanceof Error ? e.message : "Übersicht fehlgeschlagen");
      setTimeOverviewRows([]);
      setTimeUserTotals(null);
    } finally {
      setTimeOverviewLoading(false);
    }
  }, [token, logout, currentUser, overviewYear, overviewMonth]);

  useEffect(() => {
    if (!isAuthenticated || !token || activeTab !== 1) return;
    if (!currentUser?.username) return;
    loadTimeOverview();
  }, [
    activeTab,
    isAuthenticated,
    token,
    currentUser?.username,
    currentUser?.id,
    overviewYear,
    overviewMonth,
    loadTimeOverview,
  ]);

  const loadTeamStatus = useCallback(async () => {
    if (!token) return;
    setTeamStatusLoading(true);
    setTeamStatusError("");
    try {
      const raw = await fetchTimetrackerLastUserInformation(token);
      setTeamStatusRows(parseLastUserInformationResponse(raw));
    } catch (e) {
      if (e instanceof AuthError) {
        await logout();
        setTeamStatusRows([]);
        return;
      }
      setTeamStatusError(e instanceof Error ? e.message : "Team-Status fehlgeschlagen");
      setTeamStatusRows([]);
    } finally {
      setTeamStatusLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    if (!isAuthenticated || !token || activeTab !== 1) return;
    loadTeamStatus();
  }, [activeTab, isAuthenticated, token, loadTeamStatus]);

  const refreshEmployeeTimeTab = useCallback(async () => {
    await Promise.all([loadTimeTrackerStatus(), loadTimeOverview(), loadTeamStatus()]);
  }, [loadTimeTrackerStatus, loadTimeOverview, loadTeamStatus]);

  const onOverviewPrevMonth = useCallback(() => {
    setOverviewMonth((m) => {
      if (m <= 1) {
        setOverviewYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }, []);

  const onOverviewNextMonth = useCallback(() => {
    setOverviewMonth((m) => {
      if (m >= 12) {
        setOverviewYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }, []);

  const updateNote = (id, note) => {
    setNotesByBooking((prev) => ({ ...prev, [id]: note }));
  };

  const clearNoteDraft = useCallback((bookingKey) => {
    setNotesByBooking((prev) => {
      const next = { ...prev };
      delete next[bookingKey];
      return next;
    });
  }, []);

  const applyDetailStatusPostToBookings = useCallback(
    (bookingId, responseBody) => {
      const parsed = parseDetailStatusPostResponse(responseBody);
      if (!parsed) return;
      setBookings((prev) =>
        prev.map((b) =>
          String(b.id) === String(bookingId)
            ? patchBookingDetailStatusFromPostResponse(b, parsed, detailStatusCatalog, C)
            : b
        )
      );
    },
    [detailStatusCatalog, C]
  );

  const handleTimeCheckIn = useCallback(async () => {
    if (!token) return;
    setTimeActionLoading(true);
    try {
      const data = await fetchTimeTrackerCheckIn(token);
      const st = await loadTimeTrackerStatus();
      if (st === "auth") return;
      if (st !== "ok") {
        const fromApi = pickClockTimeFromTimetrackerJson(data, "checkin");
        const clock = fromApi ?? formatTime(new Date());
        setEmployeeTime((prev) => ({ ...prev, checkIn: clock, checkOut: "" }));
        setTimeTrackerKind("checkin");
      }
      void loadTimeOverview();
      void loadTeamStatus();
    } catch (e) {
      if (e instanceof AuthError) {
        await logout();
        return;
      }
      Alert.alert("Check-in", e instanceof Error ? e.message : "Fehlgeschlagen");
    } finally {
      setTimeActionLoading(false);
    }
  }, [token, logout, loadTimeTrackerStatus, loadTimeOverview, loadTeamStatus]);

  const handleTimeCheckOut = useCallback(async () => {
    if (!token) return;
    setTimeActionLoading(true);
    try {
      const data = await fetchTimeTrackerCheckout(token);
      const st = await loadTimeTrackerStatus();
      if (st === "auth") return;
      if (st !== "ok") {
        const fromApi = pickClockTimeFromTimetrackerJson(data, "checkout");
        const clock = fromApi ?? formatTime(new Date());
        setEmployeeTime((prev) => ({ ...prev, checkOut: clock }));
        setTimeTrackerKind("checkout");
      }
      void loadTimeOverview();
      void loadTeamStatus();
    } catch (e) {
      if (e instanceof AuthError) {
        await logout();
        return;
      }
      Alert.alert("Check-out", e instanceof Error ? e.message : "Fehlgeschlagen");
    } finally {
      setTimeActionLoading(false);
    }
  }, [token, logout, loadTimeTrackerStatus, loadTimeOverview, loadTeamStatus]);

  const onAvatarPress = () => {
    /** @type {{ text: string; style?: string; onPress?: () => void }[]} */
    const buttons = [];
    if (biometricSupported) {
      if (biometricLoginEnabled) {
        buttons.push({
          text: `${biometricLabel} für schnellen Login aus`,
          onPress: () => {
            void disableBiometricLogin().catch((e) =>
              Alert.alert("Biometrie", e instanceof Error ? e.message : "Nicht möglich")
            );
          },
        });
      } else {
        buttons.push({
          text: `${biometricLabel} für schnellen Login`,
          onPress: () => {
            void enableBiometricLogin().catch((e) =>
              Alert.alert("Biometrie", e instanceof Error ? e.message : "Nicht möglich")
            );
          },
        });
      }
    }
    buttons.push(
      {
        text: "Abmelden",
        style: "destructive",
        onPress: () => logout(),
      },
      { text: "Abbrechen", style: "cancel" }
    );
    Alert.alert("Konto", undefined, buttons);
  };

  if (!hydrated) {
    return (
      <View style={[s.boot, { backgroundColor: C.bg }]}>
        <ActivityIndicator size="large" color={C.blue} />
      </View>
    );
  }

  if (needsBiometricUnlock) {
    return (
      <BiometricUnlockScreen
        biometricLabel={biometricLabel}
        onUnlock={unlockWithBiometric}
        onUsePassword={cancelBiometricUsePassword}
      />
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={[s.headerTitle, { color: C.text }]}>{getHeaderTitle(activeTab)}</Text>
          <Text style={[s.headerSub, { color: C.text2 }]}>{formatHeaderDate()}</Text>
          {currentUser ? (
            <Text style={[s.headerUser, { color: C.text2 }]} numberOfLines={1}>
              {currentUser.displayName}
              {currentUser.username ? ` · ${currentUser.username}` : ""}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={onAvatarPress}
          style={[s.avatar, { backgroundColor: C.blue }]}
          accessibilityRole="button"
          accessibilityLabel={
            currentUser
              ? `Angemeldet als ${currentUser.displayName}. Tippen für Konto und Abmelden`
              : "Konto"
          }
        >
          <Text style={s.avatarText}>{currentUser?.initials ?? "?"}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.content}>
        {activeTab === 0 && (
          <BookingsPage
            C={C}
            bookings={bookings}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            dayMode={dayMode}
            bookingsListDate={bookingsListDate}
            onSelectArrivalsToday={selectArrivalsToday}
            onSelectDeparturesToday={selectDeparturesToday}
            onSelectArrivalsTomorrow={selectArrivalsTomorrow}
            onSelectDeparturesTomorrow={selectDeparturesTomorrow}
            notesByBooking={notesByBooking}
            onChangeNote={updateNote}
            onNoteDraftClear={clearNoteDraft}
            detailStatusCatalog={detailStatusCatalog}
            loading={bookingsLoading}
            error={bookingsError}
            onRefresh={loadBookings}
            onDetailStatusPostResult={applyDetailStatusPostToBookings}
          />
        )}
        {activeTab === 1 && (
          <EmployeeTimePage
            C={C}
            employeeTime={employeeTime}
            statusKind={timeTrackerKind}
            onCheckIn={handleTimeCheckIn}
            onCheckOut={handleTimeCheckOut}
            loading={timeActionLoading}
            overviewPeriodLabel={formatOverviewPeriodLabel(overviewYear, overviewMonth)}
            onOverviewPrevMonth={onOverviewPrevMonth}
            onOverviewNextMonth={onOverviewNextMonth}
            overviewItems={timeOverviewRows}
            overviewLoading={timeOverviewLoading}
            overviewError={timeOverviewError}
            onOverviewRefresh={refreshEmployeeTimeTab}
            overviewHint={!currentUser?.username ? "Profil wird geladen …" : ""}
            userTotals={timeUserTotals}
            totalsError={timeTotalsError}
            teamStatusItems={filteredTeamStatusItems}
            teamStatusFilter={teamStatusFilter}
            onTeamStatusFilterChange={setTeamStatusFilter}
            teamStatusLoading={teamStatusLoading}
            teamStatusError={teamStatusError}
          />
        )}
        {activeTab === 2 && (
          <ShiftsPage
            C={C}
            shifts={myShifts}
            loading={myShiftsLoading}
            error={myShiftsError}
            onRefresh={loadMyShifts}
          />
        )}
      </View>

      <View
        style={[
          s.tabBar,
          { borderTopColor: C.border, paddingBottom: 16 + insets.bottom },
        ]}
      >
        {TAB_ITEMS.map((item, i) => {
          const { icon, label, disabled } = item;
          const isDisabled = Boolean(disabled);
          return (
            <TouchableOpacity
              key={label}
              onPress={() => {
                if (!isDisabled) setActiveTab(i);
              }}
              disabled={isDisabled}
              style={[s.tabItem, isDisabled && s.tabItemDisabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: isDisabled }}
              accessibilityLabel={isDisabled ? `${label} (inaktiv)` : label}
            >
              <Text style={s.tabIcon}>{icon}</Text>
              <Text
                style={[
                  s.tabLabel,
                  { color: C.text3 },
                  activeTab === i && !isDisabled && { color: C.blue },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center" },
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerLeft: { flex: 1, marginRight: 12, minWidth: 0 },
  headerTitle: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, marginTop: 2 },
  headerUser: { fontSize: 12, marginTop: 4, fontWeight: "500" },
  content: { flex: 1 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  avatarText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  tabBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(18,18,18,0.97)",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  tabItem: { alignItems: "center", gap: 4 },
  tabItemDisabled: { opacity: 0.38 },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 10, fontWeight: "500" },
});
