import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      profileId: string
      provider: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    profileId?: string
    provider?: string
    providerAccountId?: string
  }
}
