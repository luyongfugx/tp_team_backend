import { AUTH_STORAGE_KEY } from "@/lib/client-auth";
// Public browsing remains available when the optional admin session is absent/expired.
export function viewerToken(): string | null {
  try {
    const auth = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
    return typeof auth?.token === "string" ? auth.token : null;
  } catch {
    return null;
  }
}
