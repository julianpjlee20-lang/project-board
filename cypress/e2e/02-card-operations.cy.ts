/**
 * 測試：卡片 CRUD 操作
 */
describe('卡片基礎操作', () => {
  let testProjectId: string
  let testColumnId: string

  beforeEach(() => {
    // 建立測試環境
    cy.createTestProject('卡片測試專案').then((project) => {
      testProjectId = project.id

      cy.createTestColumn(testProjectId, '待辦', 0).then((column) => {
        testColumnId = column.id
      })
    })
  })

  afterEach(() => {
    if (testProjectId) {
      cy.cleanupTestData(testProjectId)
    }
  })

  it('應該能夠建立新卡片', () => {
    // 訪問專案頁面
    cy.visit(`/projects/${testProjectId}`)

    // 點擊新增卡片按鈕
    cy.contains('+ 新增卡片').first().click()

    // 輸入卡片標題
    const cardTitle = '卡片_' + Date.now()
    cy.get('input[placeholder*="卡片標題"]').type(cardTitle)

    // 提交
    cy.intercept('POST', '/api/cards').as('createCard')
    cy.get('button[type="submit"]').first().click()
    cy.wait('@createCard')

    // 驗證卡片顯示
    cy.contains(cardTitle).should('be.visible')
  })

  it('應該能夠點擊卡片開啟詳細資訊', () => {
    // 建立測試卡片
    cy.createTestCard(testColumnId, '測試卡片詳情').then(() => {
      // 訪問專案頁面
      cy.visit(`/projects/${testProjectId}`)

      // 點擊卡片
      cy.contains('測試卡片詳情').click()

      // 等待模態框出現
      cy.get('.fixed.inset-0').should('be.visible')

      // 驗證模態框顯示
      cy.contains('卡片詳情').should('be.visible')
      cy.contains('測試卡片詳情').should('be.visible')
    })
  })

  it('應該能夠編輯卡片標題', () => {
    // 建立測試卡片
    cy.createTestCard(testColumnId, '原始標題').then((card) => {
      // 訪問專案頁面
      cy.visit(`/projects/${testProjectId}`)

      // 點擊卡片開啟模態框
      cy.contains('原始標題').click()
      cy.get('.fixed.inset-0').should('be.visible')

      // 編輯標題
      cy.contains('label', '標題').parent().find('input').clear().type('新標題')

      // 儲存
      cy.intercept('PUT', `/api/cards/${card.id}`).as('updateCard')
      cy.contains('button', '儲存').click()
      cy.wait('@updateCard')

      // 等待模態框關閉
      cy.get('.fixed.inset-0').should('not.exist')

      // 驗證標題已更新
      cy.contains('新標題').should('be.visible')
    })
  })

  it('應該能夠編輯卡片描述', () => {
    // 建立測試卡片
    cy.createTestCard(testColumnId, '測試描述編輯').then((card) => {
      // 訪問專案頁面
      cy.visit(`/projects/${testProjectId}`)

      // 開啟卡片
      cy.contains('測試描述編輯').click()
      cy.get('.fixed.inset-0').should('be.visible')

      // 編輯描述
      cy.contains('label', '描述').parent().find('textarea').type('這是新的描述內容')

      // 儲存
      cy.intercept('PUT', `/api/cards/${card.id}`).as('updateCard')
      cy.contains('button', '儲存').click()
      cy.wait('@updateCard')

      // 重新開啟卡片驗證
      cy.contains('測試描述編輯').click()
      cy.get('.fixed.inset-0').should('be.visible')

      cy.contains('label', '描述').parent().find('textarea')
        .should('contain.value', '這是新的描述內容')
    })
  })

  it('應該能夠設定截止日期', () => {
    // 建立測試卡片
    cy.createTestCard(testColumnId, '測試截止日').then((card) => {
      // 訪問專案頁面
      cy.visit(`/projects/${testProjectId}`)

      // 開啟卡片
      cy.contains('測試截止日').click()
      cy.get('.fixed.inset-0').should('be.visible')

      // 設定截止日期
      const testDate = '2026-12-31'
      cy.get('input[type="date"]').type(testDate)

      // 儲存
      cy.intercept('PUT', `/api/cards/${card.id}`).as('updateCard')
      cy.contains('button', '儲存').click()
      cy.wait('@updateCard')

      // 驗證日期顯示在卡片上
      cy.contains('📅').should('be.visible')
    })
  })

  it('應該能夠取消編輯', () => {
    // 建立測試卡片
    cy.createTestCard(testColumnId, '測試取消').then(() => {
      // 訪問專案頁面
      cy.visit(`/projects/${testProjectId}`)

      // 開啟卡片
      cy.contains('測試取消').click()
      cy.get('.fixed.inset-0').should('be.visible')

      // 修改標題但不儲存
      cy.contains('label', '標題').parent().find('input').clear().type('不應該儲存的標題')

      // 點擊取消
      cy.contains('button', '取消').click()

      // 驗證模態框已關閉
      cy.get('.fixed.inset-0').should('not.exist')

      // 驗證原始標題仍然存在
      cy.contains('測試取消').should('be.visible')
      cy.contains('不應該儲存的標題').should('not.exist')
    })
  })
})
