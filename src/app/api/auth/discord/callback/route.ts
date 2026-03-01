import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const CLIENT_ID = process.env.DISCORD_CLIENT_ID
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/discord/callback'

// GET /api/auth/discord/callback - Handle OAuth callback
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/projects?error=no_code', request.url))
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL('/projects?error=token_failed', request.url))
    }

    // Get user info
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    const discordUser = await userResponse.json()

    // Save or update user in database
    const existingUser = await query(
      'SELECT id FROM profiles WHERE discord_user_id = $1',
      [discordUser.id]
    )

    if (existingUser.length === 0) {
      await query(
        'INSERT INTO profiles (id, name, discord_user_id) VALUES (gen_random_uuid(), $1, $2)',
        [discordUser.username, discordUser.id]
      )
    } else {
      await query(
        'UPDATE profiles SET discord_user_id = $1, name = $2 WHERE discord_user_id = $1',
        [discordUser.id, discordUser.username]
      )
    }

    // Set cookie for session (simplified)
    const response = NextResponse.redirect(new URL('/projects', request.url))
    response.cookies.set('discord_id', discordUser.id, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 }) // 7 days

    return response
  } catch (error) {
    console.error('Discord OAuth error:', error)
    return NextResponse.redirect(new URL('/projects?error=oauth_failed', request.url))
  }
}
