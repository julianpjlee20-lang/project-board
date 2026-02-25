import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { query } from "@/lib/db"

export const dynamic = 'force-dynamic'

async function getProjects() {
  try {
    return await query("SELECT * FROM projects ORDER BY created_at DESC")
  } catch (e) {
    console.error(e)
    return []
  }
}

export default async function Home() {
  const projects = await getProjects()

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Project Board
          </h1>
          <p className="text-lg text-slate-600 max-w-md mx-auto">
            團隊專案管理看板，追蹤任務進度、分配工作、掌握時程
          </p>
        </div>

        <div className="flex justify-center gap-4">
          <Link href="/projects">
            <Button size="lg">
              進入看板
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>看板管理</CardTitle>
              <CardDescription>建立專案與欄位</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                建立多個專案，自定義看板欄位（To Do / In Progress / Done）
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>任務追蹤</CardTitle>
              <CardDescription>卡片與指派</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                建立任務卡片，指派給團隊成員，設定截止日期與標籤
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>即時通知</CardTitle>
              <CardDescription>LINE 通知</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600">
                被指派、收到評論或接近截止日時，透過 LINE 收到通知
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
<!-- refreshed -->
<!-- debug -->
