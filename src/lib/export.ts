'use client'

import type { Card, Column, Phase } from '@/app/projects/[id]/types'
import * as XLSX from 'xlsx'

// ============================================================
// 輔助函式
// ============================================================

/** 格式化日期為 YYYY/MM/DD，null 回傳空字串 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

/** 優先度中文標籤 */
export function getPriorityLabel(priority: string): string {
  const map: Record<string, string> = { high: '高', medium: '中', low: '低' }
  return map[priority] ?? priority
}

/** 計算卡片進度：優先用子任務完成率，fallback 用 card.progress */
export function getCardProgress(card: Card): number {
  if (card.subtasks.length > 0) {
    const completed = card.subtasks.filter((s) => s.is_completed).length
    return Math.round((completed / card.subtasks.length) * 100)
  }
  return card.progress
}

/** 產生匯出檔案的日期字串 YYYYMMDD */
function getDateStamp(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

// ============================================================
// 卡片資料扁平化（共用）
// ============================================================

interface FlatRow {
  編號: string
  標題: string
  欄位: string
  階段: string
  優先度: string
  指派人: string
  截止日: string
  '進度(%)': number
  標籤: string
}

function flattenCards(
  columns: Column[],
  phases: Phase[],
): FlatRow[] {
  const phaseMap = new Map(phases.map((p) => [p.id, p.name]))
  const rows: FlatRow[] = []

  for (const col of columns) {
    for (const card of col.cards) {
      if (card.is_archived) continue
      rows.push({
        編號: card.card_number != null ? `#${card.card_number}` : '',
        標題: card.title,
        欄位: col.name,
        階段: card.phase_id ? (phaseMap.get(card.phase_id) ?? '') : '',
        優先度: getPriorityLabel(card.priority),
        指派人: card.assignees.map((a) => a.name).join(', '),
        截止日: formatDate(card.due_date),
        '進度(%)': getCardProgress(card),
        標籤: card.tags.map((t) => t.name).join(', '),
      })
    }
  }
  return rows
}

function buildPhaseRows(phases: Phase[]) {
  return phases.map((p) => ({
    階段名稱: p.name,
    總任務數: p.total_cards,
    已完成數: p.completed_cards,
    '進度(%)': p.progress,
  }))
}

// ============================================================
// XLSX 匯出
// ============================================================

/** 欄位背景色（按 Column 順序循環） */
const COL_FILLS = [
  'DCE6F1', // 淡藍
  'E2EFDA', // 淡綠
  'FCE4D6', // 淡橘
  'D9E2F3', // 淡紫藍
  'FFF2CC', // 淡黃
  'F2DCDB', // 淡紅
]

export function exportToXlsx(
  projectName: string,
  columns: Column[],
  phases: Phase[],
): void {
  const wb = XLSX.utils.book_new()

  // --- Sheet 1: 任務總覽 ---
  const taskRows = flattenCards(columns, phases)
  const ws1 = XLSX.utils.json_to_sheet(taskRows)

  // 欄寬自動適應
  const headers = Object.keys(taskRows[0] ?? {})
  ws1['!cols'] = headers.map((h) => {
    const maxLen = Math.max(
      h.length * 2, // header（中文約 2 byte）
      ...taskRows.map((r) => {
        const v = String((r as unknown as Record<string, unknown>)[h] ?? '')
        // 粗估中文字寬
        return [...v].reduce((acc, ch) => acc + (ch.charCodeAt(0) > 127 ? 2 : 1), 0)
      }),
    )
    return { wch: Math.min(maxLen + 2, 40) }
  })

  // 套用背景色 — 按欄位分組
  const colNameIndex = headers.indexOf('欄位')
  if (colNameIndex !== -1) {
    const colNameToColor = new Map<string, string>()
    columns.forEach((c, i) => {
      colNameToColor.set(c.name, COL_FILLS[i % COL_FILLS.length])
    })

    for (let r = 0; r < taskRows.length; r++) {
      const bgColor = colNameToColor.get(taskRows[r].欄位) ?? 'FFFFFF'
      for (let c = 0; c < headers.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: r + 1, c }) // +1 跳過 header
        if (ws1[addr]) {
          ws1[addr].s = {
            fill: { fgColor: { rgb: bgColor } },
          }
        }
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws1, '任務總覽')

  // --- Sheet 2: 階段進度 ---
  const phaseRows = buildPhaseRows(phases)
  const ws2 = XLSX.utils.json_to_sheet(phaseRows)
  const phaseHeaders = Object.keys(phaseRows[0] ?? {})
  ws2['!cols'] = phaseHeaders.map((h) => {
    const maxLen = Math.max(
      h.length * 2,
      ...phaseRows.map((r) => String((r as unknown as Record<string, unknown>)[h] ?? '').length * 2),
    )
    return { wch: Math.min(maxLen + 2, 30) }
  })
  XLSX.utils.book_append_sheet(wb, ws2, '階段進度')

  // 下載
  const fileName = `${projectName}_匯出_${getDateStamp()}.xlsx`
  XLSX.writeFile(wb, fileName)
}

// ============================================================
// PDF 匯出（瀏覽器原生列印 — 保證中文正常）
// ============================================================

/** 建立列印用 HTML 並開啟列印對話框 */
export function exportToPdf(
  projectName: string,
  columns: Column[],
  phases: Phase[],
): void {
  const taskRows = flattenCards(columns, phases)
  const phaseRows = buildPhaseRows(phases)
  const dateStamp = getDateStamp()

  const html = buildPrintHtml(projectName, dateStamp, taskRows, phaseRows, columns)

  // 開新視窗列印
  const printWindow = window.open('', '_blank', 'width=1200,height=800')
  if (!printWindow) {
    alert('無法開啟列印視窗，請允許彈出視窗後重試。')
    return
  }

  printWindow.document.write(html)
  printWindow.document.close()

  // 等待樣式載入後觸發列印
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}

function buildPrintHtml(
  projectName: string,
  dateStamp: string,
  taskRows: FlatRow[],
  phaseRows: ReturnType<typeof buildPhaseRows>,
  columns: Column[],
): string {
  // 每個 column 的背景色
  const colColorMap = new Map<string, string>()
  columns.forEach((c, i) => {
    colColorMap.set(c.name, `#${COL_FILLS[i % COL_FILLS.length]}`)
  })

  const priorityColorMap: Record<string, string> = {
    '高': '#DC2626',
    '中': '#F59E0B',
    '低': '#22C55E',
  }

  const taskHeaders = ['編號', '標題', '欄位', '階段', '優先度', '指派人', '截止日', '進度(%)', '標籤']
  const phaseHeaders = ['階段名稱', '總任務數', '已完成數', '進度(%)']

  // 任務表格 rows
  const taskTbody = taskRows
    .map((row, i) => {
      const bgColor = colColorMap.get(row.欄位) ?? (i % 2 === 0 ? '#FFFFFF' : '#F9FAFB')
      const priorityColor = priorityColorMap[row.優先度] ?? '#6B7280'

      const progressBar = `
        <div style="display:flex;align-items:center;gap:4px;">
          <div style="flex:1;height:8px;background:#E5E7EB;border-radius:4px;overflow:hidden;">
            <div style="width:${row['進度(%)']}%;height:100%;background:${row['進度(%)'] >= 100 ? '#22C55E' : '#3B82F6'};border-radius:4px;"></div>
          </div>
          <span style="font-size:10pt;white-space:nowrap;">${row['進度(%)']}%</span>
        </div>`

      return `<tr style="background:${bgColor};">
        <td>${row.編號}</td>
        <td>${escapeHtml(row.標題)}</td>
        <td>${escapeHtml(row.欄位)}</td>
        <td>${escapeHtml(row.階段)}</td>
        <td style="color:${priorityColor};font-weight:600;">${row.優先度}</td>
        <td>${escapeHtml(row.指派人)}</td>
        <td>${row.截止日}</td>
        <td style="min-width:100px;">${progressBar}</td>
        <td>${escapeHtml(row.標籤)}</td>
      </tr>`
    })
    .join('\n')

  // 階段表格 rows
  const phaseTbody = phaseRows
    .map((row, i) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : '#F9FAFB'
      const progressBar = `
        <div style="display:flex;align-items:center;gap:4px;">
          <div style="flex:1;height:8px;background:#E5E7EB;border-radius:4px;overflow:hidden;">
            <div style="width:${row['進度(%)']}%;height:100%;background:${row['進度(%)'] >= 100 ? '#22C55E' : '#3B82F6'};border-radius:4px;"></div>
          </div>
          <span style="font-size:10pt;white-space:nowrap;">${row['進度(%)']}%</span>
        </div>`
      return `<tr style="background:${bg};">
        <td>${escapeHtml(row.階段名稱)}</td>
        <td style="text-align:center;">${row.總任務數}</td>
        <td style="text-align:center;">${row.已完成數}</td>
        <td style="min-width:100px;">${progressBar}</td>
      </tr>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(projectName)}_匯出_${dateStamp}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 15mm;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft JhengHei", "PingFang TC", sans-serif;
      font-size: 11pt;
      color: #1F2937;
      line-height: 1.5;
      padding: 20px;
    }

    h1 {
      font-size: 18pt;
      margin-bottom: 4px;
      color: #111827;
    }

    .subtitle {
      font-size: 11pt;
      color: #6B7280;
      margin-bottom: 20px;
    }

    h2 {
      font-size: 14pt;
      margin: 30px 0 12px;
      color: #1E3A5F;
      border-bottom: 2px solid #1E3A5F;
      padding-bottom: 4px;
      page-break-after: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 11pt;
    }

    thead th {
      background: #1E3A5F;
      color: #FFFFFF;
      font-size: 12pt;
      font-weight: 600;
      padding: 8px 10px;
      text-align: left;
      white-space: nowrap;
    }

    tbody td {
      padding: 6px 10px;
      border-bottom: 1px solid #E5E7EB;
      vertical-align: middle;
    }

    .page-break {
      page-break-before: always;
    }

    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(projectName)}</h1>
  <div class="subtitle">匯出日期：${dateStamp.replace(/(\d{4})(\d{2})(\d{2})/, '$1/$2/$3')}</div>

  <h2>任務總覽</h2>
  <table>
    <thead>
      <tr>${taskHeaders.map((h) => `<th>${h}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${taskTbody}
    </tbody>
  </table>

  <div class="page-break"></div>

  <h2>階段進度</h2>
  <table>
    <thead>
      <tr>${phaseHeaders.map((h) => `<th>${h}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${phaseTbody}
    </tbody>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
