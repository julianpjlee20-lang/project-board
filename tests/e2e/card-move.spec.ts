import { test, expect } from '@playwright/test'

test.describe('卡片移動', () => {
  let projectId: string

  test.beforeAll(async ({ request }) => {
    // 透過 API 建立共用測試專案
    const res = await request.post('/api/projects', {
      data: { name: `移動測試 ${Date.now()}` }
    })
    expect(res.ok()).toBeTruthy()
    const project = await res.json()
    projectId = project.id
  })

  test.afterAll(async ({ request }) => {
    if (projectId) {
      await request.delete(`/api/projects/${projectId}`)
    }
  })

  test('應能透過 API 移動卡片', async ({ request }) => {
    // 取得欄位
    const columnsRes = await request.get(`/api/projects/${projectId}/columns`)
    expect(columnsRes.ok()).toBeTruthy()
    const columns = await columnsRes.json()
    expect(columns.length).toBeGreaterThanOrEqual(3)

    const todoColumn = columns[0]
    const inProgressColumn = columns[1]

    // 建立卡片在 To Do 欄位
    const cardRes = await request.post('/api/cards', {
      data: {
        title: '要移動的卡片',
        column_id: todoColumn.id,
        position: 0
      }
    })
    expect(cardRes.ok()).toBeTruthy()
    const card = await cardRes.json()

    // 移動卡片到 In Progress
    const moveRes = await request.post('/api/cards/move', {
      data: {
        card_id: card.id,
        source_column_id: todoColumn.id,
        dest_column_id: inProgressColumn.id,
        source_index: 0,
        dest_index: 0
      }
    })
    expect(moveRes.ok()).toBeTruthy()

    // 驗證卡片已移動
    const updatedColumnsRes = await request.get(`/api/projects/${projectId}/columns`)
    const updatedColumns = await updatedColumnsRes.json()

    const updatedInProgress = updatedColumns.find((c: { name: string }) => c.name === 'In Progress')
    const movedCard = updatedInProgress?.cards?.find((c: { id: string }) => c.id === card.id)
    expect(movedCard).toBeTruthy()
  })
})
