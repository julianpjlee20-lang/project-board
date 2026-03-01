import { test, expect } from '@playwright/test'

test.describe('子任務 API', () => {
  test('應能建立、更新、刪除子任務', async ({ request }) => {
    // 建立測試專案
    const projectRes = await request.post('/api/projects', {
      data: { name: `子任務測試 ${Date.now()}` }
    })
    const project = await projectRes.json()

    // 取得欄位
    const columnsRes = await request.get(`/api/projects/${project.id}/columns`)
    const columns = await columnsRes.json()

    // 建立卡片
    const cardRes = await request.post('/api/cards', {
      data: {
        title: '子任務測試卡片',
        column_id: columns[0].id,
        position: 0
      }
    })
    const card = await cardRes.json()

    // 建立子任務
    const subtaskRes = await request.post(`/api/cards/${card.id}/subtasks`, {
      data: { title: '子任務 1' }
    })
    expect(subtaskRes.ok()).toBeTruthy()
    const subtask = await subtaskRes.json()
    expect(subtask.title).toBe('子任務 1')
    expect(subtask.is_completed).toBe(false)

    // 更新子任務（toggle 完成狀態）— 使用 subtask_id 參數名
    const updateRes = await request.put(`/api/cards/${card.id}/subtasks`, {
      data: {
        subtask_id: subtask.id,
        is_completed: true
      }
    })
    expect(updateRes.ok()).toBeTruthy()
    const updatedSubtask = await updateRes.json()
    expect(updatedSubtask.is_completed).toBe(true)

    // 刪除子任務
    const deleteRes = await request.delete(`/api/cards/${card.id}/subtasks?subtask_id=${subtask.id}`)
    expect(deleteRes.ok()).toBeTruthy()

    // 確認已刪除
    const listRes = await request.get(`/api/cards/${card.id}/subtasks`)
    const subtasks = await listRes.json()
    expect(subtasks.length).toBe(0)
  })
})
