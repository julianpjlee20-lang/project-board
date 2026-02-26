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
    <main className="min-h-screen" style={{ backgroundColor: '#F9F8F5' }}>
      {/* Hero Section */}
      <section 
        className="py-20"
        style={{ backgroundColor: '#0B1A14' }}
      >
        <div className="container mx-auto px-6 text-center">
          <h1 
            className="text-5xl font-bold mb-4"
            style={{ 
              color: '#F9F8F5',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '-0.04em'
            }}
          >
            Project Board
          </h1>
          <p 
            className="text-xl max-w-lg mx-auto"
            style={{ color: '#F9F8F5', opacity: 0.7 }}
          >
            團隊專案管理看板，追蹤任務進度、分配工作、掌握時程
          </p>
          
          <div className="mt-8">
            <Link href="/projects">
              <Button 
                size="lg"
                className="h-12 px-8 text-base font-medium transition-all hover:opacity-90"
                style={{ 
                  backgroundColor: '#F8B500',
                  color: '#0B1A14'
                }}
              >
                進入看板
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Feature 1 */}
            <Card 
              className="border-t-4"
              style={{ 
                borderTopColor: '#316745',
                backgroundColor: '#FFFFFF'
              }}
            >
              <CardHeader>
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: '#31674520' }}
                >
                  <svg 
                    className="w-6 h-6" 
                    fill="none" 
                    stroke="#316745" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <CardTitle style={{ color: '#0B1A14' }}>
                  看板管理
                </CardTitle>
                <CardDescription>
                  建立專案與欄位
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm" style={{ color: '#0B1A14', opacity: 0.7 }}>
                  建立多個專案，自定義看板欄位（To Do / In Progress / Done）
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card 
              className="border-t-4"
              style={{ 
                borderTopColor: '#F8B500',
                backgroundColor: '#FFFFFF'
              }}
            >
              <CardHeader>
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: '#F8B50020' }}
                >
                  <svg 
                    className="w-6 h-6" 
                    fill="none" 
                    stroke="#F8B500" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <CardTitle style={{ color: '#0B1A14' }}>
                  任務追蹤
                </CardTitle>
                <CardDescription>
                  卡片與指派
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm" style={{ color: '#0B1A14', opacity: 0.7 }}>
                  建立任務卡片，指派給團隊成員，設定截止日期與標籤
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card 
              className="border-t-4"
              style={{ 
                borderTopColor: '#316745',
                backgroundColor: '#FFFFFF'
              }}
            >
              <CardHeader>
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: '#31674520' }}
                >
                  <svg 
                    className="w-6 h-6" 
                    fill="none" 
                    stroke="#316745" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <CardTitle style={{ color: '#0B1A14' }}>
                  即時通知
                </CardTitle>
                <CardDescription>
                  LINE 通知
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm" style={{ color: '#0B1A14', opacity: 0.7 }}>
                  被指派、收到評論或接近截止日時，透過 LINE 收到通知
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  )
}
