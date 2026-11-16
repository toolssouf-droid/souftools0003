export interface ServerSessionUser {
  id: string;
  email: string;
  role: string;
}

export interface ServerSessionSnapshot {
  authenticated: boolean;
  user: ServerSessionUser | null;
}

const unauthenticatedSession: ServerSessionSnapshot = {
  authenticated: false,
  user: null,
};

function parseServerSession(value: unknown): ServerSessionSnapshot {
  if (!value || typeof value !== "object") return unauthenticatedSession;

  const session = value as {
    authenticated?: unknown;
    user?: { id?: unknown; email?: unknown; role?: unknown } | null;
  };
  const user = session.user;
  if (
    session.authenticated !== true ||
    !user ||
    typeof user.id !== "string" ||
    typeof user.email !== "string" ||
    typeof user.role !== "string"
  ) {
    return unauthenticatedSession;
  }

  return {
    authenticated: true,
    user: { id: user.id, email: user.email, role: user.role },
  };
}

export function isServerAdminSession(
  session: ServerSessionSnapshot
): session is ServerSessionSnapshot & { authenticated: true; user: ServerSessionUser } {
  return (
    session.authenticated &&
    session.user !== null &&
    (session.user.role === "admin" || session.user.role === "super_admin")
  );
}

async function readServerSession(): Promise<ServerSessionSnapshot> {
  const response = await fetch("/api/v1/auth/session", {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Session verification failed (${response.status})`);
  }
  return parseServerSession(await response.json());
}

export async function ensureServerSession(): Promise<ServerSessionSnapshot> {
  const currentSession = await readServerSession();
  if (currentSession.authenticated) return currentSession;

  const syncResponse = await fetch("/api/v1/auth/session", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  if (syncResponse.status === 401 || syncResponse.status === 403) {
    return currentSession;
  }
  if (!syncResponse.ok) {
    throw new Error(`Session synchronization failed (${syncResponse.status})`);
  }

  return readServerSession();
}
