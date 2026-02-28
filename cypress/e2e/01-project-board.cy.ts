/**
 * 測試：專案和看板基礎功能
 */
describe('專案和看板管理', () => {
  let testProjectId: string

  afterEach(() => {
    if (testProjectId) {
      cy.cleanupTestData(testProjectId)
    }
  })

  it('應該能夠建立新專案', () => {
    cy.createTestProject('測試專案_' + Date.now()).then((project) => {
      testProjectId = project.id

      expect(project.name).to.include('測試專案')
      expect(project.id).to.exist
    })
  })

  it('應該能夠顯示專案看板', () => {
    cy.createTestProject('測試看板').then((project) => {
      testProjectId = project.id

      cy.createTestColumn(testProjectId, '待辦', 0).then(() => {
        cy.visit(`/projects/${testProjectId}`)
        cy.contains('待辦').should('be.visible')
      })
    })
  })

  it('應該能夠建立新欄位', () => {
    cy.createTestProject('測試欄位').then((project) => {
      testProjectId = project.id

      cy.visit(`/projects/${testProjectId}`)

      // 先設定攔截，再執行操作
      cy.intercept('POST', '/api/columns').as('createColumn')

      cy.get('input[placeholder*="新欄位名稱"]').type('進行中')
      cy.get('button[type="submit"]').first().click()

      cy.wait('@createColumn')

      cy.contains('進行中').should('be.visible')
    })
  })

  it('應該能夠顯示多個欄位', () => {
    cy.createTestProject('多欄位測試').then((project) => {
      testProjectId = project.id

      cy.createTestColumn(testProjectId, '待辦', 0)
      cy.createTestColumn(testProjectId, '進行中', 1)
      cy.createTestColumn(testProjectId, '完成', 2).then(() => {
        cy.visit(`/projects/${testProjectId}`)

        cy.contains('待辦').should('be.visible')
        cy.contains('進行中').should('be.visible')
        cy.contains('完成').should('be.visible')
      })
    })
  })

  it('應該能夠顯示正確的專案頁面標題資訊', () => {
    cy.createTestProject('標題測試專案').then((project) => {
      testProjectId = project.id

      cy.visit(`/projects/${testProjectId}`)

      // 驗證頁面標題區域顯示
      cy.contains('標題測試專案').should('be.visible')
    })
  })
})
