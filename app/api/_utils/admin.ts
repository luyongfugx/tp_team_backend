import type { User } from "@prisma/client"

export const SUPER_ADMIN_EMAILS = ["luyongfugx@gmail.com", "agan10086@gmail.com"]

export function isSuperAdmin(user: Pick<User, "email"> | null | undefined) {
  return SUPER_ADMIN_EMAILS.includes(user?.email?.toLowerCase() || "")
}
