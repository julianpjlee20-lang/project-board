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
          "SELECT id, name, email, password_hash, avatar_url FROM profiles WHERE email = $1",
          [email]
        )
        if (rows.length === 0) return null

        const user = rows[0]
        if (!user.password_hash) return null

        const valid = await bcrypt.compare(password, user.password_hash)
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatar_url,
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
              "INSERT INTO profiles (name, avatar_url, discord_user_id) VALUES ($1, $2, $3)",
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
      } else if (account?.provider === "discord") {
        // Discord：從 DB 查 profileId
        const rows = await query(
          "SELECT id FROM profiles WHERE discord_user_id = $1",
          [account.providerAccountId]
        )
        if (rows.length > 0) {
          token.profileId = rows[0].id
          token.provider = "discord"
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
