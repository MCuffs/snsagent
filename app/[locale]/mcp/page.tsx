import { MarketingNav } from '../../components/MarketingNav'
import { MarketingFooter } from '../../components/MarketingFooter'
import { McpChatDemos } from '../../components/McpChatDemos'
import { getSessionUser } from '../../../lib/auth/user'
import { Terminal, Zap, Bot, Copy, ArrowRight, Code2, Globe } from 'lucide-react'
import Link from 'next/link'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.shuffla.io'

  return {
    title: isEn ? 'MCP Integration | Shuffla' : 'MCP 연동 | Shuffla',
    description: isEn
      ? 'Use Shuffla directly inside Claude, Cursor, and any AI tool that supports MCP. Generate card news without leaving your workflow.'
      : 'Claude, Cursor 등 MCP를 지원하는 AI 도구에서 Shuffla를 바로 사용하세요. 워크플로우를 벗어나지 않고 카드뉴스를 만들 수 있습니다.',
    alternates: {
      canonical: `${base}/${locale}/mcp`,
      languages: { ko: `${base}/ko/mcp`, en: `${base}/en/mcp` },
    },
    openGraph: {
      title: isEn ? 'MCP Integration | Shuffla' : 'MCP 연동 | Shuffla',
      description: isEn
        ? 'Generate card news from Claude, Cursor, and more.'
        : 'Claude, Cursor에서 바로 카드뉴스를 생성하세요.',
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
  {
    name: 'generate_card_news',
    descKo: '주제와 브랜드 톤을 입력하면 카드뉴스 슬라이드를 자동 생성합니다.',
    descEn: 'Generate card news slides from a topic and brand tone.',
  },
  {
    name: 'list_card_news',
    descKo: '내 계정에 저장된 카드뉴스 목록을 가져옵니다.',
    descEn: 'List all card news saved in your account.',
  },
  {
    name: 'publish_to_instagram',
    descKo: '완성된 카드뉴스를 Instagram에 자동으로 업로드합니다.',
    descEn: 'Publish a finished card news directly to Instagram.',
  },
]

const STEPS_KO = [
  { icon: Globe, label: 'Claude Desktop 설정 열기', desc: '상단 메뉴 Claude → Settings → Developer 탭으로 이동하세요.' },
  { icon: Code2, label: '서버 URL 추가', desc: '아래 JSON을 claude_desktop_config.json에 붙여넣으세요.' },
  { icon: Bot, label: '대화창에서 바로 사용', desc: '"카드뉴스 만들어줘"라고 입력하면 Shuffla 도구가 자동으로 실행됩니다.' },
]

const STEPS_EN = [
  { icon: Globe, label: 'Open Claude Desktop settings', desc: 'Go to Claude → Settings → Developer tab.' },
  { icon: Code2, label: 'Add the server URL', desc: 'Paste the JSON below into your claude_desktop_config.json.' },
  { icon: Bot, label: 'Use it in chat', desc: 'Just type "Make a card news" — Shuffla tools activate automatically.' },
]

export default async function McpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isEn = locale === 'en'
  const user = await getSessionUser()

  const steps = isEn ? STEPS_EN : STEPS_KO

  return (
    <div className="flex min-h-screen flex-col bg-[#0C0C0C] text-white">
      <MarketingNav authenticated={!!user} locale={locale} />

      {/* Hero */}
      <section className="mx-auto w-full max-w-[1380px] px-5 pb-16 pt-28 md:px-8 md:pt-36">
        <div className="flex flex-col items-start gap-6 md:max-w-2xl">
          <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/60">
            <Terminal className="h-3.5 w-3.5" />
            {isEn ? 'Model Context Protocol' : 'Model Context Protocol'}
          </span>
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.03em] md:text-5xl">
            {isEn
              ? 'Use Shuffla inside\nyour AI tools'
              : 'AI 도구 안에서\nShuffla를 바로 사용하세요'}
          </h1>
          <p className="text-lg text-white/50">
            {isEn
              ? 'Connect Shuffla to Claude, Cursor, or any MCP-compatible client. Generate, edit, and publish card news without switching tabs.'
              : 'Claude, Cursor 등 MCP 호환 클라이언트에 Shuffla를 연결하세요. 탭을 전환하지 않고 카드뉴스를 만들고 게시할 수 있습니다.'}
          </p>
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/login`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-black transition hover:opacity-80"
            >
              {isEn ? 'Get API key' : 'API 키 발급받기'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 px-6 text-sm font-medium text-white/70 transition hover:text-white"
            >
              {isEn ? 'What is MCP?' : 'MCP란?'}
            </a>
          </div>
        </div>
      </section>

      {/* Chat demos */}
      <McpChatDemos isEn={isEn} />

      {/* How to connect */}
      <section className="mx-auto w-full max-w-[1380px] border-t border-white/[0.06] px-5 py-20 md:px-8">
        <h2 className="mb-12 text-2xl font-semibold tracking-tight">
          {isEn ? 'Connect in 3 steps' : '3단계로 연결하기'}
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                <step.icon className="h-4.5 w-4.5 text-white/70" />
              </div>
              <div>
                <p className="text-xs font-medium text-white/30">Step {i + 1}</p>
                <p className="mt-1 font-medium">{step.label}</p>
                <p className="mt-2 text-sm text-white/50">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Config snippet */}
        <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <span className="text-xs font-medium text-white/40">claude_desktop_config.json</span>
            <button
              data-copy-snippet
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-white/40 transition hover:bg-white/5 hover:text-white/70"
            >
              <Copy className="h-3.5 w-3.5" />
              {isEn ? 'Copy' : '복사'}
            </button>
          </div>
          <pre className="overflow-x-auto px-5 py-4 text-sm leading-relaxed text-white/70">
            <code>{CONFIG_SNIPPET}</code>
          </pre>
        </div>
      </section>

      {/* Available tools */}
      <section className="mx-auto w-full max-w-[1380px] border-t border-white/[0.06] px-5 py-20 md:px-8">
        <div className="mb-12 flex items-end justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">
            {isEn ? 'Available tools' : '사용 가능한 도구'}
          </h2>
          <span className="text-sm text-white/30">
            {isEn ? 'More tools coming soon' : '도구 지속 추가 예정'}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {TOOLS.map((tool) => (
            <div key={tool.name} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-white/40" />
                <code className="text-sm font-mono text-white/80">{tool.name}</code>
              </div>
              <p className="text-sm text-white/50">{isEn ? tool.descEn : tool.descKo}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compatible clients */}
      <section className="mx-auto w-full max-w-[1380px] border-t border-white/[0.06] px-5 py-20 md:px-8">
        <h2 className="mb-10 text-2xl font-semibold tracking-tight">
          {isEn ? 'Compatible clients' : '호환 클라이언트'}
        </h2>
        <div className="flex flex-wrap gap-3">
          {['Claude Desktop', 'Cursor', 'Windsurf', 'Zed', 'VS Code (Copilot)', 'Claude Code'].map((client) => (
            <span
              key={client}
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-white/60"
            >
              {client}
            </span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-[1380px] border-t border-white/[0.06] px-5 py-20 md:px-8">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-10 md:p-16">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight">
            {isEn ? 'Ready to connect?' : '지금 바로 연결해보세요'}
          </h2>
          <p className="mb-8 text-white/50">
            {isEn
              ? 'Sign up for free and get your API key in seconds.'
              : '무료로 가입하고 바로 API 키를 발급받으세요.'}
          </p>
          <Link
            href={`/${locale}/login`}
            className="inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-black transition hover:opacity-80"
          >
            {isEn ? 'Get started free' : '무료로 시작하기'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter locale={locale} />
    </div>
  )
}
