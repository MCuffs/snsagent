import Image from 'next/image'

type ChatClient = 'claude' | 'chatgpt'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCall?: string
  images?: { src: string; alt: string }[]
}

interface ChatDemo {
  client: ChatClient
  messages: ChatMessage[]
}

const DEMOS_KO: ChatDemo[] = [
  {
    client: 'claude',
    messages: [
      {
        role: 'user',
        content: '스트릿 패션 브랜드 계정인데, 이번 시즌 포인트 컬러 룩 카드뉴스 만들어줘. 묵직하고 강한 무드로 부탁해.',
      },
      {
        role: 'assistant',
        toolCall: 'shuffla › generate_card_news',
        content: '완료됐어요! 포인트 컬러를 과감하게 누른 스트릿 무드로 카드뉴스를 만들었습니다. 편집이 필요하면 말씀해 주세요.',
        images: [
          { src: '/mcp-demo/fashion-street.png', alt: '스트릿 패션 포인트 컬러 카드뉴스' },
        ],
      },
    ],
  },
  {
    client: 'chatgpt',
    messages: [
      {
        role: 'user',
        content: '우리 카페 인스타 계정에 겨울 딸기 신메뉴 홍보 카드뉴스 만들어줘. 감성적인 톤으로.',
      },
      {
        role: 'assistant',
        toolCall: 'shuffla › generate_card_news',
        content: '생성 완료! 겨울 제철 딸기의 감성을 담은 카드뉴스입니다. 슬라이드를 넘길수록 제품 정보가 자연스럽게 이어지도록 구성했어요.',
        images: [
          { src: '/mcp-demo/food-strawberry.png', alt: '겨울 딸기 카드뉴스 1' },
          { src: '/mcp-demo/food-blueberry.png', alt: '겨울 딸기 카드뉴스 2' },
        ],
      },
    ],
  },
  {
    client: 'claude',
    messages: [
      {
        role: 'user',
        content: '오늘 서울 카페 추천 콘텐츠 카드뉴스 만들고, 완성되면 인스타그램에 바로 올려줘.',
      },
      {
        role: 'assistant',
        toolCall: 'shuffla › generate_card_news → publish_to_instagram',
        content: '카드뉴스 생성 후 Instagram 게시까지 완료했어요! 방금 업로드된 게시물은 인스타그램 앱에서 바로 확인하실 수 있습니다.',
        images: [
          { src: '/mcp-demo/food-cafe.png', alt: '서울 카페 추천 카드뉴스' },
        ],
      },
    ],
  },
  {
    client: 'chatgpt',
    messages: [
      {
        role: 'user',
        content: '체형별 비율 팁 패션 피팅 가이드 카드뉴스 만들어줘. 실용적인 스타일링 정보 위주로.',
      },
      {
        role: 'assistant',
        toolCall: 'shuffla › generate_card_news',
        content: '완성됐어요! 비율과 핏 중심으로 실용적인 스타일링 팁을 담은 2장 카드뉴스입니다. 슬라이드마다 핵심 포인트를 한 문장으로 정리했어요.',
        images: [
          { src: '/mcp-demo/fashion-ratio.png', alt: '패션 비율 피팅 가이드 1' },
          { src: '/mcp-demo/fashion-hoodie.png', alt: '패션 비율 피팅 가이드 2' },
        ],
      },
    ],
  },
]

const DEMOS_EN: ChatDemo[] = [
  {
    client: 'claude',
    messages: [
      {
        role: 'user',
        content: "We run a streetwear brand. Make a card news for this season's bold color point look — heavy, strong mood.",
      },
      {
        role: 'assistant',
        toolCall: 'shuffla › generate_card_news',
        content: "Done! I generated a card news with a heavy street mood that leans into the color point. Let me know if you'd like any edits.",
        images: [
          { src: '/mcp-demo/fashion-street.png', alt: 'Street fashion card news' },
        ],
      },
    ],
  },
  {
    client: 'chatgpt',
    messages: [
      {
        role: 'user',
        content: 'Make a card news for our cafe Instagram — promoting a new winter strawberry drink. Keep the tone warm and editorial.',
      },
      {
        role: 'assistant',
        toolCall: 'shuffla › generate_card_news',
        content: 'Generated! The card news captures the seasonal strawberry vibe with a soft editorial feel. Each slide naturally leads into the next.',
        images: [
          { src: '/mcp-demo/food-strawberry.png', alt: 'Winter strawberry card news 1' },
          { src: '/mcp-demo/food-blueberry.png', alt: 'Winter strawberry card news 2' },
        ],
      },
    ],
  },
  {
    client: 'claude',
    messages: [
      {
        role: 'user',
        content: 'Create a Seoul cafe recommendation card news, then publish it directly to Instagram when done.',
      },
      {
        role: 'assistant',
        toolCall: 'shuffla › generate_card_news → publish_to_instagram',
        content: 'All done — card news generated and published to Instagram! You can check the live post in your Instagram app right now.',
        images: [
          { src: '/mcp-demo/food-cafe.png', alt: 'Seoul cafe card news' },
        ],
      },
    ],
  },
  {
    client: 'chatgpt',
    messages: [
      {
        role: 'user',
        content: 'Make a fashion fitting guide card news focused on body proportion tips — practical styling advice.',
      },
      {
        role: 'assistant',
        toolCall: 'shuffla › generate_card_news',
        content: "Here's your 2-slide fashion fitting guide! Each slide focuses on one key proportion rule, summarized in a single punchy line.",
        images: [
          { src: '/mcp-demo/fashion-ratio.png', alt: 'Fashion proportion guide 1' },
          { src: '/mcp-demo/fashion-hoodie.png', alt: 'Fashion proportion guide 2' },
        ],
      },
    ],
  },
]

function ClaudeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#D97757" />
      <path d="M8.5 16.5L12 7.5L15.5 16.5M9.8 13.5H14.2" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChatGPTIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#10A37F" />
      <path d="M12 6.5C9.51 6.5 7.5 8.51 7.5 11c0 .87.25 1.68.68 2.36L7 17l3.64-1.18A4.47 4.47 0 0012 16c2.49 0 4.5-2.01 4.5-4.5S14.49 6.5 12 6.5z" stroke="white" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
    </svg>
  )
}

function ToolCallBadge({ label }: { label: string }) {
  return (
    <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
      <span className="font-mono text-[11px] text-white/40">{label}</span>
    </div>
  )
}

function ChatWindow({ demo, isEn }: { demo: ChatDemo; isEn: boolean }) {
  const isClaude = demo.client === 'claude'
  const clientName = isClaude ? 'Claude' : 'ChatGPT'
  const windowBg = isClaude ? 'bg-[#1A1612]' : 'bg-[#121212]'
  const headerBg = isClaude ? 'bg-[#201C18]' : 'bg-[#171717]'
  const assistantBg = isClaude ? 'bg-[#241F1A]' : 'bg-[#1E1E1E]'

  return (
    <div className={`w-full overflow-hidden rounded-2xl border border-white/[0.07] ${windowBg}`}>
      {/* Window chrome */}
      <div className={`flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3 ${headerBg}`}>
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/30">
          {isClaude ? <ClaudeIcon /> : <ChatGPTIcon />}
          <span>{clientName}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-0">
        {demo.messages.map((msg, i) => (
          <div key={i} className={`px-5 py-5 ${msg.role === 'assistant' ? assistantBg : ''}`}>
            {msg.role === 'user' ? (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white/50">
                  {isEn ? 'U' : '나'}
                </div>
                <p className="pt-0.5 text-sm leading-relaxed text-white/80">{msg.content}</p>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {isClaude ? <ClaudeIcon /> : <ChatGPTIcon />}
                </div>
                <div className="min-w-0 flex-1">
                  {msg.toolCall && <ToolCallBadge label={msg.toolCall} />}
                  <p className="mb-4 text-sm leading-relaxed text-white/80">{msg.content}</p>
                  {msg.images && msg.images.length > 0 && (
                    <div className={`grid gap-2 ${msg.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1 max-w-[260px]'}`}>
                      {msg.images.map((img, j) => (
                        <div key={j} className="overflow-hidden rounded-xl border border-white/[0.07]">
                          <Image
                            src={img.src}
                            alt={img.alt}
                            width={480}
                            height={600}
                            className="h-auto w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div className={`border-t border-white/[0.05] px-4 py-3 ${headerBg}`}>
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5">
          <span className="flex-1 text-sm text-white/20">
            {isEn ? 'Message ' : '메시지 입력...'}{clientName}
          </span>
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/10">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 10V2M2 6l4-4 4 4" stroke="white" strokeOpacity="0.4" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

export function McpChatDemos({ isEn }: { isEn: boolean }) {
  const demos = isEn ? DEMOS_EN : DEMOS_KO

  return (
    <section className="mx-auto w-full max-w-[1380px] border-t border-white/[0.06] px-5 py-20 md:px-8">
      <div className="mb-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          {isEn ? 'See it in action' : '실제로 이렇게 작동해요'}
        </h2>
        <p className="mt-3 text-sm text-white/40">
          {isEn
            ? 'Ask your AI assistant to make card news — Shuffla handles the rest.'
            : 'AI 에이전트에게 카드뉴스를 요청하면 Shuffla가 자동으로 처리합니다.'}
        </p>
      </div>

      <div className="flex flex-col gap-8 md:gap-10">
        {demos.map((demo, i) => (
          <ChatWindow key={i} demo={demo} isEn={isEn} />
        ))}
      </div>
    </section>
  )
}
