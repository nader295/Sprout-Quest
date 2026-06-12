import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

/**
 * Firebase Admin SDK - Lazy initialization via ES module getter trick.
 * 
 * By using `get adminDb()` in an exported object and re-exporting,
 * we ensure Firebase Admin only initializes when an API route 
 * actually accesses `adminDb` or `adminAuth` at runtime.
 * 
 * This prevents crashes during build/import time when
 * FIREBASE_SERVICE_ACCOUNT_KEY is not available.
 */

function ensureApp() {
  if (getApps().length > 0) return getApps()[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. " +
      "Add it in the Vars section of project Settings > Vars."
    );
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON.");
  }

  return initializeApp({ credential: cert(sa) });
}

// Lazy singletons - only created on first use
const _lazy = {
  get adminDb() {
    const val = getFirestore(ensureApp());
    Object.defineProperty(this, "adminDb", { value: val });
    return val;
  },
  get adminAuth() {
    const val = getAuth(ensureApp());
    Object.defineProperty(this, "adminAuth", { value: val });
    return val;
  },
};

// Re-export so existing `import { adminDb } from "@/lib/firebase/admin"` keeps working
export const adminDb = new Proxy({} as ReturnType<typeof getFirestore>, {
  get(_, prop, receiver) {
    return Reflect.get(_lazy.adminDb, prop, receiver);
  },
});

export const adminAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get(_, prop, receiver) {
    return Reflect.get(_lazy.adminAuth, prop, receiver);
  },
});
