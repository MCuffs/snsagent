import fs from 'fs'
import path from 'path'
import os from 'os'
import prisma from './db'

const ERROR_LOG_FILE = process.env.VERCEL
  ? path.join(os.tmpdir(), 'shuffla-errors.log')
  : path.join(process.cwd(), 'prisma', 'errors.log')

export async function saveErrorLog(
  userId: string | null | undefined,
  actionName: string,
  error: unknown,
  contextData?: Record<string, any>
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack || null : null
  const contextStr = contextData ? JSON.stringify(contextData) : null
  const timestamp = new Date().toISOString()

  // 1. Write to standard output
  console.error(`[ERROR_LOG] [${timestamp}] Action: ${actionName}, User: ${userId || 'guest'}, Message: ${errorMessage}`)
  if (errorStack) {
    console.error(errorStack)
  }

  // 2. Write to local / tmp log file
  try {
    const dir = path.dirname(ERROR_LOG_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const logLine = `[${timestamp}] Action: ${actionName} | User: ${userId || 'guest'} | Message: ${errorMessage} | Stack: ${errorStack || 'N/A'} | Context: ${contextStr || 'N/A'}\n`
    fs.appendFileSync(ERROR_LOG_FILE, logLine, 'utf8')
  } catch (fileErr) {
    console.error('Failed to write error log to file:', fileErr)
  }

  // 3. Write to PostgreSQL database
  try {
    await prisma.errorLog.create({
      data: {
        userId: userId || null,
        actionName,
        errorMessage,
        errorStack,
        contextData: contextStr,
      },
    })
    console.log('[ERROR_LOG] Successfully saved error log to Supabase DB.')
  } catch (dbErr) {
    console.error('[ERROR_LOG] Failed to save error log to Supabase DB:', dbErr)
  }
}
