import { initializeApp, getApps } from "firebase/app";
import {
  type Auth,
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  fetchSignInMethodsForEmail,
  getAdditionalUserInfo,
  getAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";
import { normalizeUsername, validateUsername } from "./auth-profile";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const googleProvider = new GoogleAuthProvider();

const hasFirebaseConfig =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.authDomain) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.appId);

let authClient: Auth | null = null;
let firestoreClient: Firestore | null = null;

export type UserProfile = {
  uid: string;
  name: string;
  username: string;
  email: string;
};

function getAuthClient() {
  if (!hasFirebaseConfig) {
    return null;
  }

  if (!authClient) {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    authClient = getAuth(app);
  }

  return authClient;
}

function assertAuthClient() {
  const client = getAuthClient();
  if (!client) {
    throw new Error("Firebase client configuration is missing in apps/web/.env.");
  }

  return client;
}

function getFirestoreClient() {
  if (!hasFirebaseConfig) {
    return null;
  }

  if (!firestoreClient) {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    firestoreClient = getFirestore(app);
  }

  return firestoreClient;
}

function assertFirestoreClient() {
  const client = getFirestoreClient();
  if (!client) {
    throw new Error("Firebase client configuration is missing in apps/web/.env.");
  }

  return client;
}

export function observeAuthState(callback: (user: User | null) => void) {
  const client = getAuthClient();
  if (!client) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(client, callback);
}

export async function signInWithGoogle() {
  const client = assertAuthClient();
  await signInWithPopup(client, googleProvider);
}

export async function signInWithEmail(email: string, password: string) {
  const client = assertAuthClient();
  await signInWithEmailAndPassword(client, email, password);
}

export async function signUpWithEmail(email: string, password: string) {
  const client = assertAuthClient();
  await createUserWithEmailAndPassword(client, email, password);
}

export async function signUpWithEmailProfile(params: {
  name: string;
  username: string;
  email: string;
  password: string;
}) {
  const normalizedUsername = normalizeUsername(params.username);
  const validation = validateUsername(normalizedUsername);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const auth = assertAuthClient();
  const db = assertFirestoreClient();
  const existingMethods = await fetchSignInMethodsForEmail(auth, params.email.trim());
  if (existingMethods.length > 0) {
    throw new Error("auth/email-already-in-use");
  }

  const credentials = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
  const trimmedName = params.name.trim();
  const usernameDocRef = doc(db, "usernames", normalizedUsername);
  const profileDocRef = doc(db, "profiles", credentials.user.uid);
  let usernameCreated = false;

  try {
    if (trimmedName) {
      await updateProfile(credentials.user, { displayName: trimmedName });
    }

    await runTransaction(db, async (transaction) => {
      const usernameSnapshot = await transaction.get(usernameDocRef);
      if (usernameSnapshot.exists()) {
        throw new Error("auth/username-reserved");
      }

      transaction.set(profileDocRef, {
        uid: credentials.user.uid,
        name: trimmedName,
        username: normalizedUsername,
        email: params.email.trim(),
        createdAt: serverTimestamp(),
      });

      transaction.set(usernameDocRef, {
        uid: credentials.user.uid,
        username: normalizedUsername,
        createdAt: serverTimestamp(),
      });
    });
    usernameCreated = true;
  } catch (error) {
    if (usernameCreated) {
      await deleteDoc(usernameDocRef).catch(() => {
        // Best effort username reservation cleanup.
      });
    }
    await deleteDoc(profileDocRef).catch(() => {
      // Best effort profile cleanup.
    });
    try {
      await deleteUser(credentials.user);
    } catch {
      // Best effort rollback for partially created auth users.
    }
    throw error;
  }
}

export async function signUpWithGoogleProfile(params: {
  name: string;
  username: string;
  expectedEmail?: string;
}) {
  const normalizedUsername = normalizeUsername(params.username);
  const validation = validateUsername(normalizedUsername);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const auth = assertAuthClient();
  const db = assertFirestoreClient();
  const credentials = await signInWithPopup(auth, googleProvider);
  const additionalInfo = getAdditionalUserInfo(credentials);

  if (!additionalInfo?.isNewUser) {
    await signOut(auth).catch(() => {
      // Best effort to avoid leaving a signed-in session.
    });
    throw new Error("auth/account-already-exists");
  }

  const email = credentials.user.email?.trim();
  if (!email) {
    try {
      await deleteUser(credentials.user);
    } catch {
      // Best effort cleanup.
    }
    throw new Error("auth/google-email-missing");
  }

  if (params.expectedEmail?.trim()) {
    const expected = params.expectedEmail.trim().toLowerCase();
    if (email.toLowerCase() !== expected) {
      try {
        await deleteUser(credentials.user);
      } catch {
        // Best effort cleanup.
      }
      throw new Error("auth/google-email-mismatch");
    }
  }

  const trimmedName = params.name.trim() || credentials.user.displayName?.trim() || "";
  const usernameDocRef = doc(db, "usernames", normalizedUsername);
  const profileDocRef = doc(db, "profiles", credentials.user.uid);
  let usernameCreated = false;

  try {
    if (trimmedName) {
      await updateProfile(credentials.user, { displayName: trimmedName });
    }

    await runTransaction(db, async (transaction) => {
      const usernameSnapshot = await transaction.get(usernameDocRef);
      if (usernameSnapshot.exists()) {
        throw new Error("auth/username-reserved");
      }

      transaction.set(profileDocRef, {
        uid: credentials.user.uid,
        name: trimmedName,
        username: normalizedUsername,
        email,
        createdAt: serverTimestamp(),
      });

      transaction.set(usernameDocRef, {
        uid: credentials.user.uid,
        username: normalizedUsername,
        createdAt: serverTimestamp(),
      });
    });
    usernameCreated = true;
  } catch (error) {
    if (usernameCreated) {
      await deleteDoc(usernameDocRef).catch(() => {
        // Best effort username cleanup.
      });
    }
    await deleteDoc(profileDocRef).catch(() => {
      // Best effort profile cleanup.
    });
    try {
      await deleteUser(credentials.user);
    } catch {
      // Best effort auth cleanup.
    }
    throw error;
  }
}

export async function isUsernameAvailable(username: string) {
  const db = assertFirestoreClient();
  const normalized = normalizeUsername(username);
  const usernameRef = doc(db, "usernames", normalized);

  try {
    const snapshot = await getDoc(usernameRef);
    return !snapshot.exists();
  } catch (error) {
    if (error instanceof Error && /insufficient permissions/i.test(error.message)) {
      throw new Error("Username check requires Firestore username rules. Allow get on usernames/{username}.");
    }
    throw error;
  }
}

export async function syncUsernameIndexForUser(params: {
  uid: string;
  username: string;
}) {
  const db = assertFirestoreClient();
  const normalizedUsername = normalizeUsername(params.username);
  if (!normalizedUsername) return;

  await setDoc(
    doc(db, "usernames", normalizedUsername),
    {
      uid: params.uid,
      username: normalizedUsername,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getSignInMethodsForEmailAddress(email: string) {
  const auth = assertAuthClient();
  return fetchSignInMethodsForEmail(auth, email.trim());
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = assertFirestoreClient();
  const snapshot = await getDoc(doc(db, "profiles", uid));
  if (!snapshot.exists()) {
    return null;
  }

  const value = snapshot.data() as Partial<UserProfile>;
  return {
    uid,
    name: value.name?.trim() ?? "",
    username: value.username?.trim() ?? "",
    email: value.email?.trim() ?? "",
  };
}

export async function signOutCurrentUser() {
  const client = assertAuthClient();
  await signOut(client);
}

export async function deleteCurrentUserAccount(password?: string) {
  const client = assertAuthClient();
  const db = assertFirestoreClient();
  const user = client.currentUser;

  if (!user) {
    throw new Error("No authenticated user session found.");
  }

  const hasPasswordProvider = user.providerData.some((provider) => provider.providerId === "password");
  if (hasPasswordProvider) {
    if (!user.email) {
      throw new Error("Current account is missing an email address for reauthentication.");
    }
    if (!password) {
      throw new Error("Password is required to delete this account.");
    }

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  } else {
    await reauthenticateWithPopup(user, googleProvider);
  }

  let username = "";
  const profileSnapshot = await getDoc(doc(db, "profiles", user.uid)).catch(() => null);
  if (profileSnapshot?.exists()) {
    const profileData = profileSnapshot.data() as { username?: string };
    username = normalizeUsername(profileData.username ?? "");
  }

  if (username) {
    await deleteDoc(doc(db, "usernames", username)).catch(() => {
      // Best effort username reservation cleanup.
    });
  }

  await deleteDoc(doc(db, "profiles", user.uid)).catch(() => {
    // Best effort profile cleanup.
  });
  await deleteUser(user);
}

export async function getCurrentUserIdToken(forceRefresh = false) {
  const client = getAuthClient();
  if (!client?.currentUser) {
    return null;
  }

  return client.currentUser.getIdToken(forceRefresh);
}
