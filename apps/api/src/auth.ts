import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type AuthUser = {
  uid: string;
  email?: string;
};

export function extractBearerToken(headerValue?: string) {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

export function resolveServiceAccountPath(
  serviceAccountPath: string,
  cwd = process.cwd(),
  fileExists: (candidate: string) => boolean = existsSync,
) {
  if (path.isAbsolute(serviceAccountPath)) {
    return serviceAccountPath;
  }

  const candidates = [
    path.resolve(cwd, serviceAccountPath),
    path.resolve(cwd, "apps", "api", serviceAccountPath),
    path.resolve(cwd, path.basename(serviceAccountPath)),
  ];

  for (const candidate of candidates) {
    if (fileExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

function getFirebaseAuthClient() {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (serviceAccountPath) {
    const resolvedPath = resolveServiceAccountPath(serviceAccountPath);

    if (!existsSync(resolvedPath)) {
      throw new Error(`Firebase service account file not found: ${resolvedPath}`);
    }

    const raw = readFileSync(resolvedPath, "utf8");
    const serviceAccount = JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };

    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("Service account JSON is missing required fields.");
    }

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
        }),
      });
    }

    return getAuth();
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are missing. Use FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
    );
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return getAuth();
}

export async function verifyRequestAuth(headerValue?: string) {
  const token = extractBearerToken(headerValue);
  if (!token) {
    return { ok: false as const, error: "Missing bearer token." };
  }

  const bypassToken = process.env.AUTH_TEST_BYPASS_TOKEN;
  if (bypassToken && token === bypassToken) {
    return {
      ok: true as const,
      user: {
        uid: "test-user",
        email: "test-user@local",
      },
    };
  }

  try {
    const auth = getFirebaseAuthClient();
    const decoded = await auth.verifyIdToken(token);
    return {
      ok: true as const,
      user: {
        uid: decoded.uid,
        email: decoded.email,
      } as AuthUser,
    };
  } catch {
    return { ok: false as const, error: "Invalid auth token." };
  }
}
