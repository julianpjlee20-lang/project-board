import { NextResponse } from 'next/server'

const CLIENT_ID = process.env.DISCORD_CLIENT_ID
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
const REDIRECT_URI = 'https://project-board.zeabur.app/api/auth/discord/callback'

// GET /api/auth/discord - Start OAuth flow
export async function GET() {
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify`
  
  return NextResponse.redirect(discordAuthUrl)
}
