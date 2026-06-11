import { MarketingNav } from '../../components/MarketingNav'
import { MarketingFooter } from '../../components/MarketingFooter'
import { McpChatDemos } from '../../components/McpChatDemos'
import { McpApiKeyPanel } from '../../components/McpApiKeyPanel'
import { getSessionUser } from '../../../lib/auth/user'
import { Terminal, Zap, Globe, Code2, Bot, Copy, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

  return {
    title: isEn ? 'MCP Integration | Shuffla' : 'MCP 연동 | Shuffla',
    description: isEn
      ? 'Use Shuffla directly inside Claude, Cursor, and any AI tool that supports MCP. Generate card news without leaving your workflow.'
      : 'Claude, Cursor 등 MCP를 지원하는 AI 도구에서 Shuffla를 바로 사용하세요.',
    alternates: {
      canonical: `${base}/${locale}/mcp`,
      languages: { ko: `${base}/ko/mcp`, en: `${base}/en/mcp` },
    },
    openGraph: {
      title: isEn ? 'MCP Integration | Shuffla' : 'MCP 연동 | Shuffla',
      description: isEn ? 'Generate card news from Claude, Cursor, and more.' : 'Claude, Cursor에서 바로 카드뉴스를 생성하세요.',
      url: `${base}/${locale}/mcp`,
      type: 'website',
      siteName: 'Shuffla',
      images: [{ url: `${base}/og-image.png`, width: 1200, height: 630, alt: 'Shuffla MCP' }],
    },
  }
}

const CONFIG_SNIPPET = `{
  "mcpServers": {
    "shuffla": {
      "type": "http",
      "url": "https://mcp.shuffla.io/sse"
    }
  }
}`

const TOOLS = [
  { name: 'generate_card_news', descKo: '주제와 브랜드 톤을 입력하면 카드뉴스 슬라이드를 자동 생성합니다.', descEn: 'Generate card news slides from a topic and brand tone.' },
  { name: 'list_card_news', descKo: '내 계정에 저장된 카드뉴스 목록을 가져옵니다.', descEn: 'List all card news saved in your account.' },
  { name: 'publish_to_instagram', descKo: '완성된 카드뉴스를 Instagram에 자동으로 업로드합니다.', descEn: 'Publish a finished card news directly to Instagram.' },
]

export default async function McpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const user = await getSessionUser()

  const steps = isEn
    ? [
        { icon: Globe, label: 'Open Claude Desktop settings', desc: 'Go to Claude → Settings → Developer tab.' },
        { icon: Code2, label: 'Add the server URL', desc: 'Paste the JSON below into your claude_desktop_config.json.' },
        { icon: Bot, label: 'Use it in chat', desc: 'Just type "Make a card news" — Shuffla tools activate automatically.' },
      ]
    : [
        { icon: Globe, label: 'Claude Desktop 설정 열기', desc: '상단 메뉴 Claude → Settings → Developer 탭으로 이동하세요.' },
        { icon: Code2, label: '서버 URL 추가', desc: '아래 JSON을 claude_desktop_config.json에 붙여넣으세요.' },
        { icon: Bot, label: '대화창에서 바로 사용', desc: '"카드뉴스 만들어줘"라고 입력하면 Shuffla 도구가 자동으로 실행됩니다.' },
      ]

  return (
    <div className="flex min-h-screen flex-col bg-[#fafaf7] text-[#0a0a0a]">
      <MarketingNav authenticated={!!user} locale={locale} />

      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-12 pt-24 md:px-8 md:pt-32">
        <div className="flex flex-col items-start gap-4 md:max-w-xl">
          <span className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#ff6b35]">
            <Terminal className="h-3 w-3" />
            Model Context Protocol
          </span>
          <h1 className="text-[36px] font-black leading-tight tracking-[-0.04em] md:text-[48px]">
            {isEn ? 'Use Shuffla inside\nyour AI tools' : 'AI 도구 안에서\nShuffla를 바로 사용하세요'}
          </h1>
          <p className="text-[16px] leading-relaxed text-[#525252]">
            {isEn
              ? 'Connect Shuffla to Claude, Cursor, or any MCP-compatible client. Generate and publish card news without switching tabs.'
              : 'Claude, Cursor 등 MCP 호환 클라이언트에 Shuffla를 연결하세요. 탭을 전환하지 않고 카드뉴스를 만들고 게시할 수 있습니다.'}
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/[0.1] bg-white px-5 text-[13px] font-medium text-[#525252] transition hover:border-black/20"
            >
              {isEn ? 'What is MCP?' : 'MCP란?'}
            </a>
          </div>
        </div>
      </section>

      {/* Chat demos */}
      <McpChatDemos isEn={isEn} />

      {/* How to connect */}
      <section className="mx-auto w-full max-w-5xl border-t border-black/[0.06] px-5 py-14 md:px-8">
        <h2 className="mb-8 text-[20px] font-black tracking-[-0.03em]">
          {isEn ? 'Connect in 3 steps' : '3단계로 연결하기'}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={i} className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff6b35]/10">
                <step.icon className="h-4 w-4 text-[#ff6b35]" />
              </div>
              <p className="mt-3 text-[11px] font-black uppercase tracking-[0.1em] text-[#8a8a8a]">Step {i + 1}</p>
              <p className="mt-1 text-[14px] font-bold text-[#0a0a0a]">{step.label}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#525252]">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Config snippet */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-3">
            <span className="text-[12px] font-medium text-[#8a8a8a]">claude_desktop_config.json</span>
            <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-[#8a8a8a] transition hover:bg-black/[0.04] hover:text-[#0a0a0a]">
              <Copy className="h-3.5 w-3.5" />
              {isEn ? 'Copy' : '복사'}
            </button>
          </div>
          <pre className="overflow-x-auto px-5 py-4 text-[13px] leading-relaxed text-[#525252]">
            <code>{CONFIG_SNIPPET}</code>
          </pre>
        </div>
      </section>

      {/* API Key section */}
      <section className="mx-auto w-full max-w-5xl border-t border-black/[0.06] px-5 py-14 md:px-8">
        <div className="mb-6">
          <h2 className="text-[20px] font-black tracking-[-0.03em]">
            {isEn ? 'API Key' : 'API 키'}
          </h2>
          <p className="mt-1.5 text-[13px] text-[#8a8a8a]">
            {isEn
              ? 'Use your API key to authenticate Shuffla in MCP-compatible clients.'
              : 'MCP 클라이언트에서 Shuffla 인증에 사용할 API 키입니다.'}
          </p>
        </div>
        {user ? (
          <McpApiKeyPanel isEn={isEn} />
        ) : (
          <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center shadow-sm">
            <p className="mb-4 text-[14px] text-[#525252]">
              {isEn ? 'Sign in to generate your API key.' : '로그인 후 API 키를 발급받으세요.'}
            </p>
            <Link
              href={`/${locale}/login`}
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#0a0a0a] px-6 text-[13px] font-bold text-white transition hover:bg-[#1a1a1a]"
            >
              {isEn ? 'Sign in' : '로그인'}
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* Available tools */}
      <section className="mx-auto w-full max-w-5xl border-t border-black/[0.06] px-5 py-14 md:px-8">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-[20px] font-black tracking-[-0.03em]">
            {isEn ? 'Available tools' : '사용 가능한 도구'}
          </h2>
          <span className="text-[12px] text-[#8a8a8a]">
            {isEn ? 'More tools coming soon' : '도구 지속 추가 예정'}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {TOOLS.map((tool) => (
            <div key={tool.name} className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
              <div className="mb-2.5 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-[#ff6b35]" />
                <code className="font-mono text-[13px] font-medium text-[#0a0a0a]">{tool.name}</code>
              </div>
              <p className="text-[13px] leading-relaxed text-[#525252]">{isEn ? tool.descEn : tool.descKo}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compatible clients */}
      <section className="mx-auto w-full max-w-5xl border-t border-black/[0.06] px-5 py-14 md:px-8">
        <h2 className="mb-6 text-[20px] font-black tracking-[-0.03em]">
          {isEn ? 'Compatible clients' : '호환 클라이언트'}
        </h2>
        <div className="flex flex-wrap gap-2">
          {['Claude Desktop', 'Cursor', 'Windsurf', 'Zed', 'VS Code (Copilot)', 'Claude Code'].map((client) => (
            <span
              key={client}
              className="rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[13px] text-[#525252] shadow-sm"
            >
              {client}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-5xl border-t border-black/[0.06] px-5 py-14 md:px-8">
        <div className="rounded-2xl border border-black/[0.06] bg-white p-10 shadow-sm">
          <h2 className="mb-2 text-[24px] font-black tracking-[-0.03em]">
            {isEn ? 'Ready to connect?' : '지금 바로 연결해보세요'}
          </h2>
          <p className="mb-6 text-[14px] text-[#525252]">
            {isEn ? 'Sign up for free and get your API key instantly.' : '무료로 가입하고 바로 API 키를 발급받으세요.'}
          </p>
          <Link
            href={`/${locale}/login`}
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#0a0a0a] px-6 text-[13px] font-bold text-white transition hover:bg-[#1a1a1a]"
          >
            {isEn ? 'Get started free' : '무료로 시작하기'}
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <MarketingFooter locale={locale} />
    </div>
  )
}
