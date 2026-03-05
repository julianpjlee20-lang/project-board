import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET() {
  try {
    const filePath = join(process.cwd(), "docs", "API.md")
    const content = await readFile(filePath, "utf-8")

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=600",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to read API documentation", detail: String(error) },
      { status: 500 }
    )
  }
}
