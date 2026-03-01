import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"
import type { NextAuthConfig } from "next-auth"
import { query } from "@/lib/db"

async function ensureProfilesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT,
      avatar_url TEXT,
      line_user_id TEXT,
      discord_user_id TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `)
  // 補上既有表可能缺少的欄位
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discord_user_id TEXT`)
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS line_user_id TEXT`)
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT`)
}

const LineProvider = {
  id: "line",
  name: "LINE",
  type: "oidc" as const,
  issuer: "https://access.line.me",
  authorization: {
    url: "https://access.line.me/oauth2/v2.1/authorize",
    params: { scope: "profile openid", bot_prompt: "normal" },
  },
  token: "https://api.line.me/oauth2/v2.1/token",
  userinfo: "https://api.line.me/v2/profile",
  clientId: process.env.AUTH_LINE_ID,
  clientSecret: process.env.AUTH_LINE_SECRET,
  profile(profile: Record<string, string>) {
    return {
      id: profile.userId || profile.sub,
      name: profile.displayName || profile.name,
      image: profile.pictureUrl || profile.picture,
    }
  },
}

export const authConfig: NextAuthConfig = {
  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
    }),
    LineProvider,
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      if (!account) return false
      const provider = account.provider
      const providerAccountId = account.providerAccountId

      try {
        await ensureProfilesTable()
        const column =
          provider === "line" ? "line_user_id" : "discord_user_id"
        const existing = await query(
          `SELECT id FROM profiles WHERE ${column} = $1`,
          [providerAccountId]
        )

        if (existing.length === 0) {
          await query(
            `INSERT INTO profiles (name, avatar_url, ${column}) VALUES ($1, $2, $3)`,
            [user.name, user.image, providerAccountId]
          )
        } else {
          await query(
            `UPDATE profiles SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url) WHERE ${column} = $3`,
            [user.name, user.image, providerAccountId]
          )
        }
        return true
      } catch (error) {
        console.error("[Auth] signIn callback failed:", error)
        return false
      }
    },

    async jwt({ token, account }) {
      if (account) {
        const provider = account.provider
        const providerAccountId = account.providerAccountId
        const column =
          provider === "line" ? "line_user_id" : "discord_user_id"
        const rows = await query(
          `SELECT id FROM profiles WHERE ${column} = $1`,
          [providerAccountId]
        )
        if (rows.length > 0) {
          token.profileId = rows[0].id
          token.provider = provider
          token.providerAccountId = providerAccountId
        }
      }
      return token
    },

    async session({ session, token }) {
      if (token.profileId) {
        session.user.profileId = token.profileId as string
        session.user.provider = token.provider as string
      }
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
