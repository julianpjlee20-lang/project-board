/**
 * 測試：整合測試 - 完整的使用者流程
 */
describe('完整使用者流程整合測試', () => {
  let testProjectId: string

  afterEach(() => {
    if (testProjectId) {
      cy.cleanupTestData(testProjectId)
    }
  })

  it('完整工作流：建立專案 → 新增欄位 → 建立卡片 → 編輯卡片', () => {
    // 步驟 1: 建立專案
    const projectName = '整合測試專案_' + Date.now()
    cy.createTestProject(projectName).then((project) => {
      testProjectId = project.id

      // 步驟 2: 訪問專案頁面
      cy.visit(`/projects/${testProjectId}`)

      // 步驟 3: 建立第一個欄位
      cy.intercept('POST', '/api/columns').as('createColumn1')
      cy.get('input[placeholder*="新欄位名稱"]').type('待辦事項')
      cy.get('button[type="submit"]').first().click()
      cy.wait('@createColumn1')

      cy.contains('待辦事項').should('be.visible')

      // 步驟 4: 建立第二個欄位
      cy.intercept('POST', '/api/columns').as('createColumn2')
      cy.get('input[placeholder*="新欄位名稱"]').type('進行中')
      cy.get('button[type="submit"]').first().click()
      cy.wait('@createColumn2')

      cy.contains('進行中').should('be.visible')

      // 步驟 5: 在第一個欄位建立卡片
      const cardTitle = '完成專案文件'
      cy.intercept('POST', '/api/cards').as('createCard')
      cy.contains('+ 新增卡片').first().click()
      cy.get('input[placeholder*="卡片標題"]').type(cardTitle)
      cy.get('button[type="submit"]').first().click()
      cy.wait('@createCard')

      cy.contains(cardTitle).should('be.visible')

      // 步驟 6: 開啟卡片進行編輯
      cy.contains(cardTitle).click()
      cy.get('.fixed.inset-0').should('be.visible')

      // 步驟 7: 編輯卡片詳細資訊
      cy.contains('label', '描述').parent().find('textarea')
        .type('需要撰寫完整的專案文件，包括 README 和 API 文件')
      cy.contains('label', '指派').parent().find('input').type('張小明')
      cy.get('input[type="date"]').type('2026-03-30')

      // 步驟 8: 儲存所有變更
      cy.intercept('PUT', '/api/cards/*').as('updateCard')
      cy.contains('button', '儲存').click()
      cy.wait('@updateCard')

      cy.get('.fixed.inset-0').should('not.exist')

      // 步驟 9: 驗證卡片上顯示資訊
      cy.contains('📅').should('be.visible')
      cy.contains('👤').should('be.visible')
      cy.contains('張小明').should('be.visible')

      // 步驟 10: 重新開啟卡片驗證所有資料都已保存
      cy.contains(cardTitle).click()
      cy.get('.fixed.inset-0').should('be.visible')

      cy.contains('label', '描述').parent().find('textarea')
        .should('have.value', '需要撰寫完整的專案文件，包括 README 和 API 文件')
      cy.contains('label', '指派').parent().find('input').should('have.value', '張小明')
      cy.get('input[type="date"]').should('have.value', '2026-03-30')
    })
  })

  it('多卡片操作流程：建立多個卡片並編輯', () => {
    cy.createTestProject('多卡片測試').then((project) => {
      testProjectId = project.id

      cy.createTestColumn(testProjectId, '任務清單', 0).then(() => {
        cy.visit(`/projects/${testProjectId}`)

        const tasks = ['任務A', '任務B', '任務C']

        // 建立多個卡片
        tasks.forEach((task) => {
          cy.intercept('POST', '/api/cards').as('createCard')
          cy.contains('+ 新增卡片').first().click()
          cy.get('input[placeholder*="卡片標題"]').type(task)
          cy.get('button[type="submit"]').first().click()
          cy.wait('@createCard')
          cy.contains(task).should('be.visible')
        })

        // 驗證所有卡片都顯示
        tasks.forEach((task) => {
          cy.contains(task).should('be.visible')
        })

        // 驗證欄位顯示正確的卡片數量
        cy.contains('3').should('be.visible')

        // 編輯其中一個卡片
        cy.contains('任務B').click()
        cy.get('.fixed.inset-0').should('be.visible')

        cy.contains('label', '描述').parent().find('textarea').type('任務B的詳細描述')

        cy.intercept('PUT', '/api/cards/*').as('updateCard')
        cy.contains('button', '儲存').click()
        cy.wait('@updateCard')

        cy.get('.fixed.inset-0').should('not.exist')

        // 重新開啟驗證
        cy.contains('任務B').click()
        cy.get('.fixed.inset-0').should('be.visible')

        cy.contains('label', '描述').parent().find('textarea')
          .should('have.value', '任務B的詳細描述')
      })
    })
  })

  it('錯誤處理：測試各種邊界情況', () => {
    cy.createTestProject('錯誤處理測試').then((project) => {
      testProjectId = project.id

      cy.createTestColumn(testProjectId, '測試欄位', 0).then(() => {
        cy.visit(`/projects/${testProjectId}`)

        // 測試：嘗試建立空標題的卡片
        cy.contains('+ 新增卡片').first().click()
        cy.get('input[placeholder*="卡片標題"]').type('   ')
        cy.get('button[type="submit"]').first().click()
        cy.wait(500)

        // 取消操作（如果還在表單狀態）
        cy.get('body').then(($body) => {
          if ($body.find('button:contains("取消")').length > 0) {
            cy.contains('button', '取消').click()
          }
        })

        // 建立正常的卡片
        cy.intercept('POST', '/api/cards').as('createCard')
        cy.contains('+ 新增卡片').first().click()
        cy.get('input[placeholder*="卡片標題"]').type('正常卡片')
        cy.get('button[type="submit"]').first().click()
        cy.wait('@createCard')

        // 開啟卡片並編輯
        cy.contains('正常卡片').click()
        cy.get('.fixed.inset-0').should('be.visible')

        // 編輯描述並儲存
        cy.contains('label', '描述').parent().find('textarea').type('正常的描述內容')

        cy.intercept('PUT', '/api/cards/*').as('updateCard')
        cy.contains('button', '儲存').click()
        cy.wait('@updateCard')

        cy.get('.fixed.inset-0').should('not.exist')
      })
    })
  })
})
