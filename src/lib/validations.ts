/**
 * Zod 驗證 Schema 定義
 * 用於所有 API 端點的輸入驗證
 */

import { z } from 'zod'

// ========================================
// 通用驗證規則
// ========================================

/** UUID 格式驗證 */
export const uuidSchema = z.string().uuid({ message: '無效的 UUID 格式' })

/** 非空字串驗證 */
export const nonEmptyString = z.string().min(1, { message: '不可為空字串' })

/** 可選的非空字串 */
export const optionalNonEmptyString = z.string().min(1).optional().or(z.literal(''))

/** 顏色驗證（十六進位格式） */
export const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, { message: '顏色格式必須為 #RRGGBB' }).optional()

/** 日期字串驗證（支援 YYYY-MM-DD 或 ISO 8601 格式） */
export const dateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/, { message: '無效的日期格式，需為 YYYY-MM-DD 或 ISO 8601 格式' })
  .optional()
  .or(z.literal(''))

/** 進度百分比驗證（0-100） */
export const progressSchema = z.number().int().min(0).max(100, { message: '進度必須在 0-100 之間' }).optional()

/** 位置索引驗證（非負整數） */
export const positionSchema = z.number().int().min(0, { message: '位置索引必須為非負整數' }).optional()

// ========================================
// Cards API 驗證
// ========================================

/** POST /api/cards - 建立卡片 */
export const createCardSchema = z.object({
  column_id: uuidSchema,
  title: nonEmptyString.max(200, { message: '標題不可超過 200 字元' }),
})

/** PUT /api/cards/[id] - 更新卡片 */
export const updateCardSchema = z.object({
  title: z.union([
    z.string().min(1, { message: '標題不可為空' }).max(200, { message: '標題不可超過 200 字元' }),
    z.undefined()
  ]),
  description: z.union([z.string().max(5000), z.literal(''), z.undefined()]),
  assignee: z.union([z.string().max(100), z.literal(''), z.undefined()]),
  due_date: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/),
    z.literal(''),
    z.null(),
    z.undefined()
  ]),
  progress: z.union([z.number().int().min(0).max(100), z.undefined()]),
  comment: z.union([z.string().max(1000), z.literal(''), z.undefined()]),
})

// ========================================
// Columns API 驗證
// ========================================

/** POST /api/columns - 建立欄位 */
export const createColumnSchema = z.object({
  project_id: uuidSchema,
  name: nonEmptyString.max(100, { message: '欄位名稱不可超過 100 字元' }),
  color: colorSchema,
})

/** PUT /api/columns - 更新欄位 */
export const updateColumnSchema = z.object({
  id: uuidSchema,
  name: nonEmptyString.max(100, { message: '欄位名稱不可超過 100 字元' }).optional(),
  color: colorSchema,
  position: positionSchema,
})

/** DELETE /api/columns - 刪除欄位（URL 參數） */
export const deleteColumnSchema = z.object({
  id: uuidSchema,
})

// ========================================
// Projects API 驗證
// ========================================

/** POST /api/projects - 建立專案 */
export const createProjectSchema = z.object({
  name: nonEmptyString.max(200, { message: '專案名稱不可超過 200 字元' }),
  description: z.string().max(5000, { message: '描述不可超過 5000 字元' }).optional().or(z.literal('')),
  status: z.enum(['active', 'completed', 'archived'], { message: '狀態必須為 active, completed 或 archived' }).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: '開始日期格式必須為 YYYY-MM-DD' }).optional().or(z.literal('')),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: '結束日期格式必須為 YYYY-MM-DD' }).optional().or(z.literal('')),
}).refine((data) => {
  // 驗證結束日期不早於開始日期
  if (data.start_date && data.end_date) {
    return new Date(data.end_date) >= new Date(data.start_date)
  }
  return true
}, {
  message: '結束日期不可早於開始日期',
  path: ['end_date'],
})

// ========================================
// 通用驗證輔助函數
// ========================================

/**
 * 驗證並回傳驗證結果
 * @param schema - Zod schema
 * @param data - 要驗證的資料
 * @returns 驗證成功回傳 { success: true, data }，失敗回傳 { success: false, errors }
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true as const, data: result.data }
  } else {
    return {
      success: false as const,
      errors: result.error.issues.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    }
  }
}
