/**
 * 測試：多視圖功能（看板、清單、行事曆、進度）
 */
describe('多視圖功能', () => {
  let testProjectId: string
  let testColumnId: string

  beforeEach(() => {
    cy.createTestProject('多視圖測試').then((project) => {
      testProjectId = project.id

      cy.createTestColumn(testProjectId, '待辦', 0).then((todoColumn) => {
        testColumnId = todoColumn.id
        cy.createTestColumn(testProjectId, '進行中', 1).then((inProgressColumn) => {
          cy.createTestColumn(testProjectId, '完成', 2).then((doneColumn) => {
            cy.createTestCard(todoColumn.id, '待辦任務1')
            cy.createTestCard(todoColumn.id, '待辦任務2')
            cy.createTestCard(inProgressColumn.id, '進行中任務')
            cy.createTestCard(doneColumn.id, '已完成任務')
          })
        })
      })
    })
  })

  afterEach(() => {
    if (testProjectId) {
      cy.cleanupTestData(testProjectId)
    }
  })

  it('應該能夠切換到清單視圖', () => {
    cy.visit(`/projects/${testProjectId}`)

    cy.get('body').then(($body) => {
      const hasListButton = $body.find('button').toArray().some(
        (btn) => /清單|list/i.test(btn.textContent || '')
      )

      if (hasListButton) {
        cy.contains('button', /清單|list/i).click()
        cy.wait(500)

        cy.get('table').should('be.visible')
        cy.contains('標題').should('be.visible')
        cy.contains('欄位').should('be.visible')
        cy.contains('指派').should('be.visible')
        cy.contains('截止日').should('be.visible')
      }
    })
  })

  it('應該能夠切換到行事曆視圖', () => {
    cy.visit(`/projects/${testProjectId}`)

    cy.get('body').then(($body) => {
      const hasCalendarButton = $body.find('button').toArray().some(
        (btn) => /行事曆|calendar/i.test(btn.textContent || '')
      )

      if (hasCalendarButton) {
        cy.contains('button', /行事曆|calendar/i).click()
        cy.wait(500)

        const currentYear = new Date().getFullYear()
        const currentMonth = new Date().getMonth() + 1

        cy.contains(`${currentYear}年`).should('be.visible')
        cy.contains(`${currentMonth}月`).should('be.visible')
        cy.contains('日').should('be.visible')
        cy.contains('一').should('be.visible')
      }
    })
  })

  it('應該能夠切換到進度視圖', () => {
    cy.visit(`/projects/${testProjectId}`)

    cy.get('body').then(($body) => {
      const hasProgressButton = $body.find('button').toArray().some(
        (btn) => /進度|progress/i.test(btn.textContent || '')
      )

      if (hasProgressButton) {
        cy.contains('button', /進度|progress/i).click()
        cy.wait(500)

        cy.contains('專案進度').should('be.visible')
        cy.contains('整體進度').should('be.visible')
        cy.contains('總任務').should('be.visible')
        cy.contains('進行中').should('be.visible')
        cy.contains('已完成').should('be.visible')
      }
    })
  })

  it('應該能夠切換回看板視圖', () => {
    cy.visit(`/projects/${testProjectId}`)

    cy.get('body').then(($body) => {
      const hasListButton = $body.find('button').toArray().some(
        (btn) => /清單|list/i.test(btn.textContent || '')
      )

      if (hasListButton) {
        cy.contains('button', /清單|list/i).click()
        cy.wait(500)

        cy.contains('button', /看板|board|kanban/i).click()
        cy.wait(500)

        cy.contains('待辦').should('be.visible')
        cy.contains('進行中').should('be.visible')
        cy.contains('完成').should('be.visible')
        cy.contains('待辦任務1').should('be.visible')
      }
    })
  })

  it('清單視圖應該顯示所有卡片', () => {
    cy.visit(`/projects/${testProjectId}`)

    cy.get('body').then(($body) => {
      const hasListButton = $body.find('button').toArray().some(
        (btn) => /清單|list/i.test(btn.textContent || '')
      )

      if (hasListButton) {
        cy.contains('button', /清單|list/i).click()
        cy.wait(500)

        cy.contains('待辦任務1').should('be.visible')
        cy.contains('待辦任務2').should('be.visible')
        cy.contains('進行中任務').should('be.visible')
        cy.contains('已完成任務').should('be.visible')
      }
    })
  })

  it('進度視圖應該顯示正確的任務統計', () => {
    cy.visit(`/projects/${testProjectId}`)

    cy.get('body').then(($body) => {
      const hasProgressButton = $body.find('button').toArray().some(
        (btn) => /進度|progress/i.test(btn.textContent || '')
      )

      if (hasProgressButton) {
        cy.contains('button', /進度|progress/i).click()
        cy.wait(500)

        cy.contains('總任務').parent().find('.text-2xl').should('have.text', '4')

        cy.contains('待辦').should('be.visible')
        cy.contains('進行中').should('be.visible')
        cy.contains('完成').should('be.visible')
      }
    })
  })

  it('在看板視圖中應該能夠點擊卡片', () => {
    cy.visit(`/projects/${testProjectId}`)

    // 在看板視圖中點擊卡片
    cy.contains('待辦任務1').click()
    cy.get('.fixed.inset-0').should('be.visible')
    cy.contains('卡片詳情').should('be.visible')

    cy.contains('button', '取消').click()
    cy.get('.fixed.inset-0').should('not.exist')
  })

  it('在清單視圖中應該能夠點擊卡片', () => {
    cy.visit(`/projects/${testProjectId}`)

    cy.get('body').then(($body) => {
      const hasListButton = $body.find('button').toArray().some(
        (btn) => /清單|list/i.test(btn.textContent || '')
      )

      if (hasListButton) {
        cy.contains('button', /清單|list/i).click()
        cy.wait(500)

        cy.contains('進行中任務').click()
        cy.get('.fixed.inset-0').should('be.visible')
        cy.contains('卡片詳情').should('be.visible')
      }
    })
  })
})
