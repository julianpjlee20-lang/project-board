import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Discord from "next-auth/providers/discord"
import type { NextAuthConfig } from "next-auth"
import { query } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function ensureProfilesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      avatar_url TEXT,
      line_user_id TEXT,
      discord_user_id TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT`)
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT`)
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discord_user_id TEXT`)
  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key'
      ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
      END IF;
    END $$
  `)

  // 角色與審核欄位
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`)
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE`)
  await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`)

  // 遷移：讓現有帳號不受影響（已存在的帳號自動啟用）
  await query(`UPDATE profiles SET is_active = true WHERE is_active IS NULL`)

  // ADMIN_EMAIL 機制：自動設定管理員
  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail) {
    await query(
      `UPDATE profiles SET role = 'admin', is_active = true WHERE email = $1`,
      [adminEmail]
    )
  }
}

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined
        if (!email || !password) return null

        await ensureProfilesTable()

        const rows = await query(
          "SELECT id, name, email, password_hash, avatar_url, role, is_active FROM profiles WHERE email = $1",
          [email]
        )
        if (rows.length === 0) return null

        const user = rows[0]
        if (!user.password_hash) return null

        const valid = await bcrypt.compare(password, user.password_hash)
        if (!valid) return null

        // 帳號未啟用（待審核）
        if (user.is_active === false) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar_url,
          role: user.role || 'user',
        }
      },
    }),
    Discord({
      clientId: process.env.AUTH_DISCORD_ID,
      clientSecret: process.env.AUTH_DISCORD_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async signIn({ user, account }) {
      // Credentials：authorize 已驗證，直接放行
      if (account?.provider === "credentials") return true

      // Discord OAuth：upsert profile
      if (account?.provider === "discord") {
        try {
          await ensureProfilesTable()
          const providerAccountId = account.providerAccountId
          const existing = await query(
            "SELECT id FROM profiles WHERE discord_user_id = $1",
            [providerAccountId]
          )

          if (existing.length === 0) {
            await query(
              "INSERT INTO profiles (name, avatar_url, discord_user_id, role, is_active) VALUES ($1, $2, $3, 'user', false)",
              [user.name, user.image, providerAccountId]
            )
          } else {
            await query(
              "UPDATE profiles SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url) WHERE discord_user_id = $3",
              [user.name, user.image, providerAccountId]
            )
          }
          return true
        } catch (error) {
          console.error("[Auth] Discord signIn failed:", error)
          return false
        }
      }

      return true
    },

    async jwt({ token, user, account }) {
      if (account?.provider === "credentials" && user) {
        // Credentials：user.id 就是 profileId
        token.profileId = user.id
        token.provider = "credentials"
        token.role = (user as any).role || 'user'
      } else if (account?.provider === "discord") {
        // Discord：從 DB 查 profileId 和 role
        const rows = await query(
          "SELECT id, role FROM profiles WHERE discord_user_id = $1",
          [account.providerAccountId]
        )
        if (rows.length > 0) {
          token.profileId = rows[0].id
          token.provider = "discord"
          token.role = rows[0].role || 'user'
        }
      }
      return token
    },

    async session({ session, token }) {
      if (token.profileId) {
        session.user.profileId = token.profileId as string
        session.user.provider = token.provider as string
      }
      session.user.role = (token.role as string) || 'user'
      return session
    },
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
