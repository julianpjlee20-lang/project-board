/**
 * 測試：卡片 CRUD 操作
 */
describe('卡片基礎操作', () => {
  let testProjectId: string
  let testColumnId: string

  beforeEach(() => {
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
    cy.visit(`/projects/${testProjectId}`)

    cy.intercept('POST', '/api/cards').as('createCard')

    cy.contains('+ 新增卡片').first().click()

    const cardTitle = '卡片_' + Date.now()
    cy.get('input[placeholder*="卡片標題"]').type(cardTitle)
    cy.get('button[type="submit"]').first().click()

    cy.wait('@createCard')

    cy.contains(cardTitle).should('be.visible')
  })

  it('應該能夠點擊卡片開啟詳細資訊', () => {
    cy.createTestCard(testColumnId, '測試卡片詳情').then(() => {
      cy.visit(`/projects/${testProjectId}`)

      cy.contains('測試卡片詳情').click()

      cy.get('.fixed.inset-0').should('be.visible')
      cy.contains('卡片詳情').should('be.visible')
      cy.contains('測試卡片詳情').should('be.visible')
    })
  })

  it('應該能夠編輯卡片標題', () => {
    cy.createTestCard(testColumnId, '原始標題').then((card) => {
      cy.visit(`/projects/${testProjectId}`)

      cy.contains('原始標題').click()
      cy.get('.fixed.inset-0').should('be.visible')

      cy.contains('label', '標題').parent().find('input').clear().type('新標題')

      cy.intercept('PUT', `/api/cards/${card.id}`).as('updateCard')
      cy.contains('button', '儲存').click()
      cy.wait('@updateCard')

      cy.get('.fixed.inset-0').should('not.exist')
      cy.contains('新標題').should('be.visible')
    })
  })

  it('應該能夠編輯卡片描述', () => {
    cy.createTestCard(testColumnId, '測試描述編輯').then((card) => {
      cy.visit(`/projects/${testProjectId}`)

      cy.contains('測試描述編輯').click()
      cy.get('.fixed.inset-0').should('be.visible')

      cy.contains('label', '描述').parent().find('textarea').type('這是新的描述內容')

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
    cy.createTestCard(testColumnId, '測試截止日').then((card) => {
      cy.visit(`/projects/${testProjectId}`)

      cy.contains('測試截止日').click()
      cy.get('.fixed.inset-0').should('be.visible')

      const testDate = '2026-12-31'
      cy.get('input[type="date"]').type(testDate)

      cy.intercept('PUT', `/api/cards/${card.id}`).as('updateCard')
      cy.contains('button', '儲存').click()
      cy.wait('@updateCard')

      cy.contains('📅').should('be.visible')
    })
  })

  it('應該能夠指派人員', () => {
    cy.createTestCard(testColumnId, '測試指派').then((card) => {
      cy.visit(`/projects/${testProjectId}`)

      cy.contains('測試指派').click()
      cy.get('.fixed.inset-0').should('be.visible')

      cy.contains('label', '指派').parent().find('input').type('張三')

      cy.intercept('PUT', `/api/cards/${card.id}`).as('updateCard')
      cy.contains('button', '儲存').click()
      cy.wait('@updateCard')

      cy.contains('👤').should('be.visible')
      cy.contains('張三').should('be.visible')
    })
  })

  it('應該能夠取消編輯', () => {
    cy.createTestCard(testColumnId, '測試取消').then(() => {
      cy.visit(`/projects/${testProjectId}`)

      cy.contains('測試取消').click()
      cy.get('.fixed.inset-0').should('be.visible')

      cy.contains('label', '標題').parent().find('input').clear().type('不應該儲存的標題')

      cy.contains('button', '取消').click()

      cy.get('.fixed.inset-0').should('not.exist')
      cy.contains('測試取消').should('be.visible')
      cy.contains('不應該儲存的標題').should('not.exist')
    })
  })
})
