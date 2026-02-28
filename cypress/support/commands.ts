/// <reference types="cypress" />

/**
 * Cypress 自訂命令
 */

// 清理測試資料
Cypress.Commands.add('cleanupTestData', (projectId?: string) => {
  if (projectId) {
    cy.request({
      method: 'DELETE',
      url: `/api/projects/${projectId}`,
      failOnStatusCode: false,
    })
  }
})

// 建立測試專案
Cypress.Commands.add('createTestProject', (name: string = '測試專案') => {
  return cy.request({
    method: 'POST',
    url: '/api/projects',
    body: { name, description: '自動化測試專案' },
  }).then((response) => {
    expect(response.status).to.eq(200)
    return response.body
  })
})

// 建立測試欄位
Cypress.Commands.add('createTestColumn', (projectId: string, name: string = '待辦', position: number = 0) => {
  return cy.request({
    method: 'POST',
    url: `/api/projects/${projectId}/columns`,
    body: { name, position },
  }).then((response) => {
    expect(response.status).to.eq(200)
    return response.body
  })
})

// 建立測試卡片
Cypress.Commands.add('createTestCard', (columnId: string, title: string = '測試卡片') => {
  return cy.request({
    method: 'POST',
    url: '/api/cards',
    body: {
      column_id: columnId,
      title,
      description: '測試描述',
      position: 0,
    },
  }).then((response) => {
    expect(response.status).to.eq(200)
    return response.body
  })
})


// TypeScript 類型聲明
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      cleanupTestData(projectId?: string): Chainable<void>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createTestProject(name?: string): Chainable<any>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createTestColumn(projectId: string, name?: string, position?: number): Chainable<any>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createTestCard(columnId: string, title?: string): Chainable<any>
    }
  }
}

export {}
