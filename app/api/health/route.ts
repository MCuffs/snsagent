import { NextResponse } from 'next/server'
import { dbService } from '../../../lib/db-service'

export const runtime = 'nodejs'

export async function GET() {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    timestamp: string
    version: string
    checks: {
      database: 'ok' | 'error'
      environment: 'ok' | 'error'
    }
    errors?: string[]
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: 'ok',
      environment: 'ok'
    }
  }

  const errors: string[] = []

  // Check database connectivity
  try {
    await dbService.healthCheck()
  } catch (error) {
    health.checks.database = 'error'
    errors.push(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Check critical environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXT_PUBLIC_APP_URL'
  ]

  const missingEnvVars = requiredEnvVars.filter(name => !process.env[name])
  if (missingEnvVars.length > 0) {
    health.checks.environment = 'error'
    errors.push(`Missing environment variables: ${missingEnvVars.join(', ')}`)
  }

  // Determine overall status
  if (errors.length > 0) {
    health.errors = errors
    const hasCriticalError = health.checks.database === 'error'
    health.status = hasCriticalError ? 'unhealthy' : 'degraded'
    
    return NextResponse.json(health, {
      status: hasCriticalError ? 503 : 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }

  return NextResponse.json(health, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
}
