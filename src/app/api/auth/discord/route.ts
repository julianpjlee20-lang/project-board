import { NextResponse } from 'next/server'

const CLIENT_ID = process.env.DISCORD_CLIENT_ID
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/api/auth/discord/callback'

// GET /api/auth/discord - Start OAuth flow
export async function GET() {
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`
  
  return NextResponse.redirect(discordAuthUrl)
}
