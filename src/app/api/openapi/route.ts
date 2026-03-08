import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET() {
  try {
    const filePath = join(process.cwd(), "docs", "openapi.json")
    const content = await readFile(filePath, "utf-8")
    const spec = JSON.parse(content)

    return NextResponse.json(spec, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to read OpenAPI spec", detail: String(error) },
      { status: 500 }
    )
  }
}
