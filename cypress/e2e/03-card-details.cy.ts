/**
 * 測試：卡片詳細功能
 */
describe('卡片詳細功能', () => {
  let testProjectId: string
  let testColumnId: string
  let testCardId: string

  beforeEach(() => {
    cy.createTestProject('卡片詳細測試').then((project) => {
      testProjectId = project.id

      cy.createTestColumn(testProjectId, '待辦', 0).then((column) => {
        testColumnId = column.id

        cy.createTestCard(testColumnId, '測試卡片').then((card) => {
          testCardId = card.id
        })
      })
    })
  })

  afterEach(() => {
    if (testProjectId) {
      cy.cleanupTestData(testProjectId)
    }
  })

  it('應該在儲存後保留所有資料', () => {
    cy.visit(`/projects/${testProjectId}`)
    cy.contains('測試卡片').click()
    cy.get('.fixed.inset-0').should('be.visible')

    // 填寫所有欄位
    cy.contains('label', '標題').parent().find('input').clear().type('完整測試卡片')
    cy.contains('label', '描述').parent().find('textarea').type('這是完整的描述')
    cy.contains('label', '指派').parent().find('input').type('測試人員')
    cy.get('input[type="date"]').type('2026-12-25')

    // 儲存
    cy.intercept('PUT', `/api/cards/${testCardId}`).as('updateCard')
    cy.contains('button', '儲存').click()
    cy.wait('@updateCard')

    cy.get('.fixed.inset-0').should('not.exist')

    // 重新開啟卡片驗證所有資料
    cy.contains('完整測試卡片').click()
    cy.get('.fixed.inset-0').should('be.visible')

    cy.contains('label', '標題').parent().find('input').should('have.value', '完整測試卡片')
    cy.contains('label', '描述').parent().find('textarea').should('have.value', '這是完整的描述')
    cy.contains('label', '指派').parent().find('input').should('have.value', '測試人員')
    cy.get('input[type="date"]').should('have.value', '2026-12-25')
  })

  it('應該能夠處理日期格式', () => {
    cy.visit(`/projects/${testProjectId}`)
    cy.contains('測試卡片').click()
    cy.get('.fixed.inset-0').should('be.visible')

    cy.get('input[type="date"]').type('2026-03-15')

    cy.intercept('PUT', `/api/cards/${testCardId}`).as('updateCard')
    cy.contains('button', '儲存').click()
    cy.wait('@updateCard')

    cy.get('.fixed.inset-0').should('not.exist')
    cy.reload()

    cy.contains('測試卡片').click()
    cy.get('.fixed.inset-0').should('be.visible')

    cy.get('input[type="date"]').should('have.value', '2026-03-15')
  })
})
