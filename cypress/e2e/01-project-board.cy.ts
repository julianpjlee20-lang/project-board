/**
 * 測試：專案和看板基礎功能
 */
describe('專案和看板管理', () => {
  let testProjectId: string

  afterEach(() => {
    // 清理測試資料
    if (testProjectId) {
      cy.cleanupTestData(testProjectId)
    }
  })

  it('應該能夠建立新專案', () => {
    // 前往專案頁面
    cy.visit('/projects')

    // 使用 API 建立專案
    cy.createTestProject('測試專案_' + Date.now()).then((project) => {
      testProjectId = project.id

      expect(project.name).to.include('測試專案')
      expect(project.id).to.exist
    })
  })

  it('應該能夠顯示專案看板', () => {
    // 建立測試專案
    cy.createTestProject('測試看板').then((project) => {
      testProjectId = project.id

      // 建立測試欄位
      cy.createTestColumn(testProjectId, '待辦', 0).then(() => {
        // 訪問專案頁面
        cy.visit(`/projects/${testProjectId}`)

        // 驗證欄位顯示
        cy.contains('待辦').should('be.visible')
      })
    })
  })

  it('應該能夠建立新欄位', () => {
    // 建立測試專案
    cy.createTestProject('測試欄位').then((project) => {
      testProjectId = project.id

      // 訪問專案頁面
      cy.visit(`/projects/${testProjectId}`)

      // 點擊新增欄位按鈕
      cy.contains('+ 新增欄位').click()

      // 輸入欄位名稱
      cy.get('input[placeholder*="欄位名稱"]').type('進行中')

      // 提交
      cy.get('button[type="submit"]').first().click()

      // 等待 API 回應
      cy.intercept('POST', '/api/projects/**').as('createColumn')
      cy.wait('@createColumn')

      // 驗證新欄位顯示
      cy.contains('進行中').should('be.visible')
    })
  })

  it('應該能夠顯示多個欄位', () => {
    // 建立測試專案
    cy.createTestProject('多欄位測試').then((project) => {
      testProjectId = project.id

      // 建立多個欄位
      cy.createTestColumn(testProjectId, '待辦', 0)
      cy.createTestColumn(testProjectId, '進行中', 1)
      cy.createTestColumn(testProjectId, '完成', 2).then(() => {
        // 訪問專案頁面
        cy.visit(`/projects/${testProjectId}`)

        // 驗證所有欄位都顯示
        cy.contains('待辦').should('be.visible')
        cy.contains('進行中').should('be.visible')
        cy.contains('完成').should('be.visible')
      })
    })
  })
})
