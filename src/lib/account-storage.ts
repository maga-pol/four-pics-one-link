const SIGNED_OUT_PROFILE_ID = "signed-out";

export function getAccountStorageKey(baseKey: string) {
  if (typeof window === "undefined") return `${baseKey}:${SIGNED_OUT_PROFILE_ID}`;
  return `${baseKey}:${getCurrentAccountId() ?? SIGNED_OUT_PROFILE_ID}`;
}

export function getCurrentAccountId() {
  if (typeof window === "undefined") return null;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const value = localStorage.getItem(key);
      if (!value) continue;
      const parsed = JSON.parse(value);
      const userId = findUserId(parsed);
      if (userId) return userId;
    }
  } catch {}
  return null;
}

function findUserId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const directUser = record.user as Record<string, unknown> | undefined;
  if (typeof directUser?.id === "string") return directUser.id;
  const currentSession = record.currentSession as Record<string, unknown> | undefined;
  const sessionUser = currentSession?.user as Record<string, unknown> | undefined;
  if (typeof sessionUser?.id === "string") return sessionUser.id;
  for (const child of Object.values(record)) {
    const nested = findUserId(child);
    if (nested) return nested;
  }
  return null;
}
