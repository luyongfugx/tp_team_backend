import type { User } from "@prisma/client"

export const SUPER_ADMIN_EMAIL = "luyongfugx@gmail.com"

export function isSuperAdmin(user: Pick<User, "email"> | null | undefined) {
  return user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL
}
