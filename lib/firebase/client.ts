// ── Firebase Client ──────────────────────────────────────────────────────
// NEXT_PUBLIC_FIREBASE_* values are embedded at build time and shipped to the
// browser. Security is enforced by Firestore Rules, NOT by hiding the apiKey.
//
// However, shipping hardcoded fallbacks to another project's Firebase instance
// is a liability:
//   1) Silent mis-deploys (missing env on Vercel) write to the wrong project.
//   2) Forks inherit the original project's config and pollute its auth state.
//   3) Abuse costs (Auth, Firestore reads) bill the hardcoded project.
//
// Fail loud at init time when env vars are missing.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  GithubAuthProvider,
  TwitterAuthProvider,
  type Auth,
} from "firebase/auth";

// IMPORTANT: Next.js statically replaces `process.env.NEXT_PUBLIC_*` at build
// time ONLY when accessed via a direct MemberExpression literal. Aliasing
// `process.env` to a variable or using dynamic keys (`env[k]`) defeats the
// replacement and leaves a `process` reference in the client bundle, which
// crashes the browser with "process is not defined".
//
// Every read below MUST use the literal form `process.env.NEXT_PUBLIC_FOO`.

function readConfig() {
  const apiKey              = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain          = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId           = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket       = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId   = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId               = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const measurementId       = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;

  const missing: string[] = [];
  if (!apiKey)            missing.push("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!authDomain)        missing.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
  if (!projectId)         missing.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  if (!storageBucket)     missing.push("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
  if (!messagingSenderId) missing.push("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
  if (!appId)             missing.push("NEXT_PUBLIC_FIREBASE_APP_ID");

  if (missing.length > 0) {
    const msg = `[Firebase] Missing required env vars: ${missing.join(", ")}. Add them in Vercel Project Settings > Environment Variables.`;
    // Client bundle: surface a clear console error and throw so we don't
    // silently write to some default project.
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error(msg);
    }
    throw new Error(msg);
  }

  return {
    apiKey: apiKey!,
    authDomain: authDomain!,
    projectId: projectId!,
    storageBucket: storageBucket!,
    messagingSenderId: messagingSenderId!,
    appId: appId!,
    // measurementId is optional — only used for GA4
    measurementId,
  };
}

// Lazy init — defer until first access so build-time imports don't crash.
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function getApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length === 0 ? initializeApp(readConfig()) : getApps()[0];
  return _app;
}

export const app = new Proxy({} as FirebaseApp, {
  get: (_t, prop) => Reflect.get(getApp(), prop),
});

export const auth = new Proxy({} as Auth, {
  get: (_t, prop) => {
    if (!_auth) {
      _auth = getAuth(getApp());
      // Explicitly persist sessions in localStorage so that:
      //   • `signInWithRedirect` survives the full-page round-trip to Google
      //     (without this, the pending-auth state can be lost on some browsers
      //     and the user ends up back on /login with no session).
      //   • Returning users stay signed in across tabs and reloads.
      // We fire-and-forget — failures fall back to the default in-memory
      // persistence which is still valid, just not cross-tab.
      if (typeof window !== "undefined") {
        setPersistence(_auth, browserLocalPersistence).catch(() => {
          /* non-fatal */
        });
      }
    }
    return Reflect.get(_auth, prop);
  },
});

export const googleProvider = new GoogleAuthProvider();
// `prompt: select_account` matches the UX of other major sites — users can
// pick which Google account to use instead of being silently signed in to
// the last one they used. It also avoids an infinite loop if the previously
// selected account becomes invalid.
googleProvider.setCustomParameters({ prompt: "select_account" });

export const githubProvider = new GithubAuthProvider();
export const twitterProvider = new TwitterAuthProvider();
