"use client";

import { detectCountryFromTimezone } from "@/lib/timezone-country";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile as fbUpdateProfile, type User, type AuthError, type AuthProvider as FirebaseAuthProvider } from "firebase/auth";
import { auth, googleProvider, githubProvider, twitterProvider } from "@/lib/firebase/client";
import { apiEnsureUser, apiGetUser } from "@/lib/api/client";
import { ADMIN_EMAIL, roleLevel } from "@/lib/constants";
import type { UserDoc } from "@/lib/types";
import { logger } from "@/lib/logger";
import { debugLog } from "@/lib/debug-log";

interface AuthState {
  user: User | null;
  userDoc: UserDoc | null;
  loading: boolean;
  userDocLoading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signInWithTwitter: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserDoc: () => Promise<void>;
  updateFirebaseProfile: (name?: string, photoURL?: string) => Promise<void>;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  canUpload: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  userDoc: null,
  loading: true,
  userDocLoading: false,
  error: null,
  signInWithGoogle: async () => {},
  signInWithGithub: async () => {},
  signInWithTwitter: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  logout: async () => {},
  refreshUserDoc: async () => {},
  updateFirebaseProfile: async () => {},
  isLoggedIn: false,
  isAdmin: false,
  isOwner: false,
  canUpload: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [userDocLoading, setUserDocLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureUserDoc = useCallback(async (firebaseUser: User): Promise<UserDoc | null> => {
    if (!firebaseUser?.uid) return null;
    try {
      // ✅ جرب اقرأ الـ doc الأول — لو موجود مش محتاج write
      // apiEnsureUser بيعمل write في كل مرة حتى لو الـ doc موجود
      const existing = await apiGetUser(firebaseUser.uid);
      if (existing) return existing;

      // مستخدم جديد — detect country silently from timezone
      const detectedCountry = detectCountryFromTimezone();
      return await apiEnsureUser({
        uid:   firebaseUser.uid,
        name:  firebaseUser.displayName || firebaseUser.email || "User",
        email: firebaseUser.email || "",
        photo: firebaseUser.photoURL || "",
        country:     detectedCountry?.code || "",
        countryName: detectedCountry?.name || "",
        showOnMap:   !!detectedCountry, // auto opt-in if detected
      });
    } catch {
      return null;
    }
  }, []);

  const refreshUserDoc = useCallback(async () => {
    if (!user) return;
    try {
      const doc = await apiGetUser(user.uid, true); // true = bypass cache
      if (doc) {
        // Auto-unsuspend if suspension expired
        if (doc.suspended && doc.suspendedUntil) {
          const until = doc.suspendedUntil instanceof Date
            ? doc.suspendedUntil
            : new Date((doc.suspendedUntil as { seconds: number })?.seconds * 1000 || doc.suspendedUntil as unknown as number);
          if (until < new Date()) {
            // Suspension expired — clear it silently via direct fetch.
            // ✅ FIX: include auth token — the API rejects unauthenticated PUTs
            user.getIdToken().then((token: string) => {
              fetch("/api/users", {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ action: "unsuspend_expired", uid: user.uid }),
              }).catch((err) => logger.error("auth.unsuspendExpired", err, { uid: user.uid }));
            }).catch((err: unknown) => logger.error("auth.unsuspendExpired.token", err, { uid: user.uid }));
            setUserDoc({ ...doc, suspended: false, suspendedUntil: null });
            return;
          }
        }
        setUserDoc(doc);
      }
    } catch {}
  }, [user]);

  /** Sync display name / photo to Firebase Auth (fixes name/photo not reflecting after edit) */
  const updateFirebaseProfile = useCallback(async (name?: string, photoURL?: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const updates: { displayName?: string; photoURL?: string } = {};
    if (name !== undefined) updates.displayName = name;
    if (photoURL !== undefined) updates.photoURL = photoURL;
    if (Object.keys(updates).length > 0) {
      await fbUpdateProfile(currentUser, updates);
      // Force token refresh so subsequent reads pick up new values
      setUser({ ...currentUser } as User);
    }
  }, []);

  // Presence tracking is handled centrally by StatsBar component
  // which tracks both anonymous and authenticated visitors via session IDs

  useEffect(() => {
    // Firebase Auth لا يعمل في SSR — نتجاهل في build/prerender
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    let unsubDoc: (() => void) | null = null;
    let authResolved = false;

    // ── Safety timeout: if Firebase Auth doesn't respond in 5s, ──────
    // show the UI anyway (treats user as unauthenticated).
    // This prevents infinite loading spinners when Firebase is
    // unreachable (e.g., proxy, tunnel, or network issues).
    debugLog.info("init", "Auth listener attached, waiting for Firebase…");

    // Handle the result of a full-page redirect sign-in (the fallback path
    // used when the popup is blocked). Runs exactly once on mount.
    // If a pending redirect flag exists but Firebase returns no result, we
    // clear the flag so the login page doesn't stay stuck on the
    // "Completing sign-in…" screen.
    const pendingRedirect = sessionStorage.getItem("rx_pending_redirect");
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          debugLog.success("redirect", "Redirect sign-in completed", {
            uid: result.user.uid,
            provider: result.providerId,
          });
          sessionStorage.removeItem("rx_pending_redirect");
        } else if (pendingRedirect) {
          // Redirect flow returned with no credentials — likely cancelled
          // by the user on Google's consent screen, or third-party cookies
          // blocked the handshake. Either way, clear the flag so the UI
          // returns to normal.
          debugLog.warn(
            "redirect",
            `Returned from ${pendingRedirect} redirect with no user — cancelled or cookies blocked`,
          );
          sessionStorage.removeItem("rx_pending_redirect");
        }
      })
      .catch((err: AuthError) => {
        sessionStorage.removeItem("rx_pending_redirect");
        if (err?.code && err.code !== "auth/no-auth-event") {
          debugLog.error("redirect", `Redirect sign-in error (${err.code})`, err.message);
        }
      });

    const safetyTimeout = setTimeout(() => {
      if (!authResolved) {
        console.warn("[Auth] Firebase auth timeout — showing UI as unauthenticated");
        debugLog.warn("init", "Firebase auth timeout (6s) — treating as signed out");
        authResolved = true;
        setLoading(false);
      }
    }, 6000); // زودناها من 2s → 6s عشان Firebase على بعض الـ connections بتاخد وقت

    const unsub = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        authResolved = true;
        clearTimeout(safetyTimeout);
        setError(null);
        setUser(firebaseUser);

        // إلغاء الـ listener القديم لو موجود
        if (unsubDoc) { unsubDoc(); unsubDoc = null; }

        if (firebaseUser) {
          debugLog.success("firebase", "Firebase user detected", {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            provider: firebaseUser.providerData?.[0]?.providerId,
          });
          // ✅ FIX: unblock the UI as soon as we know there's a logged-in user.
          // Previously `setLoading(false)` was called AFTER ensureUserDoc + the
          // patchLocation fetch finished, which meant any slow/hung API call
          // would leave the login page stuck on the spinner and force the user
          // to refresh manually. Flipping `loading` to false here lets the
          // login page's redirect effect fire as soon as userDoc resolves.
          setLoading(false);

          // أول مرة: ensure user doc موجود
          debugLog.info("userDoc", "Loading user document…");
          setUserDocLoading(true);
          // ✅ FIX: hard timeout around ensureUserDoc so a hung API call
          // never keeps `userDocLoading` true forever.
          let uDoc = await Promise.race<UserDoc | null>([
            ensureUserDoc(firebaseUser),
            new Promise<UserDoc | null>((resolve) => setTimeout(() => resolve(null), 12_000)),
          ]);

          // ✅ FIX: retry once if first attempt failed (e.g. cold-start API latency)
          if (!uDoc) {
            debugLog.warn("userDoc", "First attempt timed out, retrying in 2s…");
            await new Promise((r) => setTimeout(r, 2_000));
            uDoc = await Promise.race<UserDoc | null>([
              ensureUserDoc(firebaseUser),
              new Promise<UserDoc | null>((resolve) => setTimeout(() => resolve(null), 8_000)),
            ]);
          }

          if (uDoc) {
            debugLog.success("userDoc", "User document ready", {
              username: uDoc.username || "(none)",
              role: uDoc.role || "user",
            });
          } else {
            debugLog.error("userDoc", "User document failed to load after retries — continuing anyway");
          }
          setUserDoc(uDoc);
          setUserDocLoading(false);

          // ── Silent location patch for existing users ──────────────────
          // Runs once per browser session (sessionStorage guard)
          // ✅ FIX: fire-and-forget — previously this was awaited, which meant
          // a slow/hung network request kept the whole app in loading state
          // and blocked the login redirect.
          const patchKey = `rx_loc_patched_${firebaseUser.uid}`;
          if (!sessionStorage.getItem(patchKey) && uDoc && !uDoc.country) {
            (async () => {
              try {
                const detected = detectCountryFromTimezone();
                const countryCode = detected?.code || "";
                const controller = new AbortController();
                const tId = setTimeout(() => controller.abort(), 10_000);
                const resp = await fetch("/api/users", {
                  method: "POST",
                  signal: controller.signal,
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${await firebaseUser.getIdToken()}`,
                  },
                  body: JSON.stringify({
                    action: "patchLocation",
                    country: countryCode,
                    countryName: detected?.name || "",
                    showOnMap: true,
                  }),
                });
                clearTimeout(tId);
                if (resp.ok) {
                  const json = await resp.json().catch(() => ({}));
                  if (!json?.skipped) sessionStorage.setItem(patchKey, "1");
                }
              } catch { /* silent — will retry next session */ }
            })();
          }


          // ✅ Poll Supabase for unread notifications count (every 30s)
          // Replaces the old Firestore onSnapshot listener which read stale data
          const pollNotifications = async () => {
            try {
              const token = await firebaseUser.getIdToken();
              const res = await fetch("/api/notifications?countOnly=true", {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                const data = await res.json();
                const unread = typeof data.unreadCount === "number" ? data.unreadCount : (data.items?.filter((n: { read: boolean }) => !n.read).length ?? 0);
                setUserDoc((prev) =>
                  prev ? { ...prev, unreadNotifications: unread } : prev
                );
              }
            } catch { /* silent — will retry next interval */ }
          };
          // Initial poll + interval
          pollNotifications();
          const notifInterval = setInterval(pollNotifications, 60_000); // تحسين: من 30s إلى 60s (توفير 50%)
          unsubDoc = () => clearInterval(notifInterval);
        } else {
          debugLog.info("firebase", "No Firebase user (signed out)");
          setUserDoc(null);
          setLoading(false);
        }
      },
      (err: Error) => {
        authResolved = true;
        clearTimeout(safetyTimeout);
        // Handle auth errors gracefully (e.g., CORS issues, network errors)
        const code = (err as AuthError).code || "";
        console.error("[Auth] Firebase auth error:", code, err.message);
        debugLog.error("firebase", `Auth listener error (${code || "unknown"})`, err.message);
        if (code === "auth/network-request-failed") {
          setError("Network error - please check your connection");
        } else if (err.message?.includes("CORS")) {
          setError("Domain not authorized - contact admin");
        } else {
          setError(err.message || "Authentication error");
        }
        setLoading(false);
      }
    );
    return () => { unsub(); clearTimeout(safetyTimeout); if (unsubDoc) unsubDoc(); };
  }, [ensureUserDoc]);

  const handleAuthError = useCallback((e: unknown) => {
    const authError = e as AuthError;
    console.error("[Auth] Sign in error:", authError.code, authError.message);
    if (authError.code === "auth/popup-closed-by-user") {
      debugLog.warn("popup", "Popup closed by user");
      return;
    }
    // ✅ FIX: handle popup-blocked (common on mobile browsers)
    if (authError.code === "auth/popup-blocked") {
      debugLog.error("popup", "Popup was blocked by browser");
      setError("Popup was blocked by your browser. Please allow popups for this site and try again.");
      return;
    }
    if (authError.code === "auth/unauthorized-domain") {
      debugLog.error("popup", "Domain not authorized in Firebase");
      setError("This domain is not authorized. Please contact admin to add it to Firebase.");
    } else if (authError.code === "auth/account-exists-with-different-credential") {
      debugLog.error("popup", "Account exists with different provider");
      setError("An account already exists with the same email. Try signing in with a different provider.");
    } else {
      debugLog.error("popup", `Sign in failed (${authError.code || "unknown"})`, authError.message);
      setError(authError.message || "Sign in failed");
    }
    // ✅ FIX: removed `throw e` — re-throwing caused double error display
    // (setError above + catch in login page both showed the error)
  }, []);

  // After a confirmed sign-in, Firebase's onAuthStateChanged listener can be
  // delayed on some browsers (Brave, Safari, Firefox with strict privacy, or
  // any browser where COOP blocks the popup bridge). To avoid leaving the user
  // stuck on /login waiting for the listener, we proactively:
  //   1. Push the credential into React state so `isLoggedIn` flips immediately.
  //   2. Kick off ensureUserDoc so the login page can decide between
  //      "redirect home" and "show username step".
  //   3. If 600ms pass and the listener still hasn't fired, do a hard reload
  //      as a last-resort fallback — identical to the user manually refreshing.
  const hydrateAfterSignIn = useCallback(
    async (firebaseUser: User, reason: string) => {
      debugLog.info("hydrate", `Manually hydrating state after ${reason}`);
      setUser(firebaseUser);
      setLoading(false);
      setUserDocLoading(true);
      try {
        const uDoc = await ensureUserDoc(firebaseUser);
        if (uDoc) {
          debugLog.success("hydrate", "User doc loaded via manual hydrate", {
            username: uDoc.username || "(none)",
          });
        } else {
          debugLog.warn("hydrate", "ensureUserDoc returned null — continuing anyway");
        }
        setUserDoc(uDoc);
      } catch (err) {
        debugLog.error("hydrate", "ensureUserDoc threw", (err as Error).message);
      } finally {
        setUserDocLoading(false);
      }

      // Safety net: if React state somehow didn't update (e.g. HMR or a
      // stale listener unmounted us), hard-reload after a short grace period.
      if (typeof window !== "undefined") {
        setTimeout(() => {
          const stillOnLogin = window.location.pathname === "/login";
          if (stillOnLogin && auth.currentUser) {
            debugLog.warn(
              "hydrate",
              "Still on /login 2s after sign-in — forcing hard reload",
            );
            const params = new URLSearchParams(window.location.search);
            const dest = params.get("from") || "/";
            window.location.assign(dest);
          }
        }, 2000);
      }
    },
    [ensureUserDoc],
  );

  // Try popup first, fall back to full-page redirect flow if the browser
  // blocks the popup or the environment can't open new windows.
  const popupOrRedirect = useCallback(
    async (provider: FirebaseAuthProvider, label: string) => {
      setError(null);
      debugLog.info("popup", `Opening ${label} sign-in popup…`);
      try {
        const result = await signInWithPopup(auth, provider);
        if (result?.user) {
          debugLog.success("popup", `${label} popup returned`, { uid: result.user.uid });
          logger.info?.(`auth.${label.toLowerCase()}Popup`, { uid: result.user.uid });
          // Don't rely on onAuthStateChanged — push the credential into
          // React state manually so the login page can redirect immediately.
          await hydrateAfterSignIn(result.user, `${label} popup`);
        } else {
          debugLog.warn("popup", `${label} popup returned with no user`);
        }
      } catch (e) {
        const err = e as AuthError;
        if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
          debugLog.warn("popup", `${label} popup cancelled (${err.code})`);
          return;
        }
        // Browser reported the popup as blocked. This happens on many
        // mainstream browsers (Chrome, Edge, Brave) when Firebase's popup
        // bridge takes >500ms to open the window and loses the user-gesture
        // token, even when popups are actually allowed for the site.
        // Instead of showing an error, silently fall back to the full-page
        // redirect flow — this is exactly what Reddit, Medium, Dev.to and
        // most modern sites do. `browserLocalPersistence` (set in
        // lib/firebase/client.ts) ensures the pending auth state survives
        // the round-trip to Google, and `getRedirectResult` on next mount
        // finishes the sign-in and runs `hydrateAfterSignIn`.
        if (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment") {
          debugLog.info(
            "popup",
            `${label} popup unavailable — using full-page redirect flow instead`,
          );
          try {
            // Remember we're expecting a redirect return so the login page
            // can show "Completing sign-in…" instead of the normal form.
            sessionStorage.setItem("rx_pending_redirect", label);
            await signInWithRedirect(auth, provider);
            // Page unloads here; nothing more to do synchronously.
            return;
          } catch (redirErr) {
            sessionStorage.removeItem("rx_pending_redirect");
            const rErr = redirErr as AuthError;
            debugLog.error(
              "popup",
              `${label} redirect flow failed (${rErr.code || "unknown"})`,
              rErr.message,
            );
            // Only now surface a real error — both strategies failed.
            handleAuthError(redirErr);
            return;
          }
        }
        handleAuthError(e);
      }
    },
    [hydrateAfterSignIn, handleAuthError],
  );

  const signInWithGoogle = useCallback(
    () => popupOrRedirect(googleProvider, "Google"),
    [popupOrRedirect],
  );

  const signInWithGithub = useCallback(
    () => popupOrRedirect(githubProvider, "GitHub"),
    [popupOrRedirect],
  );

  const signInWithTwitter = useCallback(
    () => popupOrRedirect(twitterProvider, "X/Twitter"),
    [popupOrRedirect],
  );

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    try {
      setError(null);
      debugLog.info("email", "Signing in with email/password…");
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      debugLog.success("email", "Email sign-in accepted by Firebase", { uid: cred.user.uid });
      // Don't wait for onAuthStateChanged — hydrate state immediately.
      // Fixes "stuck on login page until manual refresh" on browsers where
      // COOP delays the auth state listener.
      await hydrateAfterSignIn(cred.user, "email sign-in");
    } catch (e) {
      handleAuthError(e);
    }
  }, [hydrateAfterSignIn, handleAuthError]);

  const signUpWithEmail = useCallback(async (email: string, pass: string, displayName: string) => {
    try {
      setError(null);
      debugLog.info("email", "Creating new email/password account…");
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      // Set the display name on the Firebase Auth profile
      await fbUpdateProfile(cred.user, { displayName });
      debugLog.success("email", "Account created", { uid: cred.user.uid });
      await hydrateAfterSignIn(cred.user, "email sign-up");
    } catch (e) {
      handleAuthError(e);
    }
  }, [hydrateAfterSignIn, handleAuthError]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUserDoc(null);
    // ✅ FIX: clear stale state to prevent stuck UI after re-login
    setUserDocLoading(false);
    setError(null);
    // ✅ FIX: hard navigate to login page to wipe all stale data from memory
    window.location.href = "/login";
  }, []);

  const role = userDoc?.role || "user";
  // isOwner: email match is always reliable (does not depend on userDoc loading)
  const isOwnerEmail = !!user?.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isOwner = isOwnerEmail || role === "owner";
  const value: AuthState = {
    user,
    userDoc,
    loading,
    userDocLoading,
    error,
    signInWithGoogle,
    signInWithGithub,
    signInWithTwitter,
    signInWithEmail,
    signUpWithEmail,
    logout,
    refreshUserDoc,
    updateFirebaseProfile,
    isLoggedIn: !!user,
    isAdmin: isOwner || roleLevel(role) >= 4,
    isOwner,
    canUpload: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
