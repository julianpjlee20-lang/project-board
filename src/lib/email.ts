import { Resend } from 'resend'

let resend: Resend | null = null

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

interface SendPasswordResetEmailParams {
  to: string
  resetUrl: string
}

interface SendEmailResult {
  success: boolean
  error?: string
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: SendPasswordResetEmailParams): Promise<SendEmailResult> {
  const client = getResend()

  // 開發環境 fallback：RESEND_API_KEY 未設定時，印出重設連結
  if (!client) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('[Email] RESEND_API_KEY 未設定，以下為開發模式輸出')
    console.log(`[Email] 收件人：${to}`)
    console.log(`[Email] 密碼重設連結：${resetUrl}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    return { success: true }
  }

  const from = process.env.EMAIL_FROM ?? 'Project Board <noreply@projectboard.app>'

  const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>重設您的 Project Board 密碼</title>
</head>
<body style="margin:0;padding:0;background-color:#F9F8F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9F8F5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#0B1A14;padding:32px 40px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.01em;">
                Project Board
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0B1A14;">
                重設您的密碼
              </h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#444444;">
                我們收到您重設 Project Board 帳號密碼的請求。請點擊下方按鈕完成重設。
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:8px;background-color:#0B1A14;">
                    <a href="${resetUrl}"
                       target="_blank"
                       style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.01em;">
                      重設密碼
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#777777;">
                此連結將在 <strong>60 分鐘</strong>後失效。
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#777777;">
                如果您沒有要求重設密碼，請忽略此郵件，您的帳號不會有任何變更。
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #EBEBEB;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#AAAAAA;">
                此為系統自動發送的郵件，請勿直接回覆。<br />
                &copy; ${new Date().getFullYear()} Project Board
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  try {
    const { error } = await client.emails.send({
      from,
      to,
      subject: '重設您的 Project Board 密碼',
      html,
    })

    if (error) {
      console.error('[Email] 發送失敗：', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知錯誤'
    console.error('[Email] 發送時發生例外：', message)
    return { success: false, error: message }
  }
}
