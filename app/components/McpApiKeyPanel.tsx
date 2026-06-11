'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, RefreshCw, Trash2, Key } from 'lucide-react'

export function McpApiKeyPanel({ isEn }: { isEn: boolean }) {
  const [key, setKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/mcp/key')
      .then((r) => r.json())
      .then((d) => setKey(d.key))
      .finally(() => setLoading(false))
  }, [])

  const generate = async () => {
    setGenerating(true)
    const r = await fetch('/api/mcp/key', { method: 'POST' })
    const d = await r.json()
    setKey(d.key)
    setGenerating(false)
  }

  const revoke = async () => {
    if (!confirm(isEn ? 'Revoke this API key?' : 'API 키를 삭제할까요?')) return
    await fetch('/api/mcp/key', { method: 'DELETE' })
    setKey(null)
  }

  const copy = () => {
    if (!key) return
    navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const masked = key ? `${key.slice(0, 10)}${'•'.repeat(24)}` : ''

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff6b35]/10">
          <Key className="h-4 w-4 text-[#ff6b35]" />
        </div>
        <h3 className="text-[15px] font-bold text-[#0a0a0a]">
          {isEn ? 'Your API Key' : 'API 키'}
        </h3>
      </div>

      {loading ? (
        <div className="h-10 animate-pulse rounded-lg bg-black/[0.04]" />
      ) : key ? (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-black/[0.07] bg-[#fafaf7] px-4 py-2.5">
            <code className="flex-1 font-mono text-[13px] text-[#525252]">{masked}</code>
            <button onClick={copy} className="shrink-0 rounded-md p-1.5 text-[#525252] transition hover:bg-black/5">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-[#8a8a8a]">
            {isEn ? 'Keep this key secret. It grants full access to your Shuffla account.' : '이 키는 외부에 노출되지 않도록 주의하세요.'}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[13px] font-medium text-[#525252] transition hover:bg-black/[0.03] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
              {isEn ? 'Regenerate' : '재발급'}
            </button>
            <button
              onClick={revoke}
              className="flex items-center gap-1.5 rounded-full border border-red-100 px-4 py-2 text-[13px] font-medium text-red-500 transition hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isEn ? 'Revoke' : '삭제'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-[13px] text-[#8a8a8a]">
            {isEn ? 'No API key yet. Generate one to connect Shuffla to your AI tools.' : '아직 API 키가 없습니다. 발급받아 AI 도구에 연결하세요.'}
          </p>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 rounded-full bg-[#0a0a0a] px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#1a1a1a] disabled:opacity-50"
          >
            <Key className="h-3.5 w-3.5" />
            {generating ? (isEn ? 'Generating…' : '발급 중…') : (isEn ? 'Generate API Key' : 'API 키 발급받기')}
          </button>
        </>
      )}
    </div>
  )
}
