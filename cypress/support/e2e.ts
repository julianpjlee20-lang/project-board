// Cypress 支援文件
// 在每個測試文件之前載入

// 匯入 Cypress 命令
import './commands'

// 全域配置
Cypress.on('uncaught:exception', (err, runnable) => {
  // 防止未捕獲的異常導致測試失敗
  // 可以根據需要調整
  console.error('Uncaught exception:', err)
  return false
})
