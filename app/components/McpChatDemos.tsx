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
      { role: 'user', content: '스트릿 패션 브랜드 계정인데, 이번 시즌 포인트 컬러 룩 카드뉴스 만들어줘. 묵직하고 강한 무드로 부탁해.' },
      {
        role: 'assistant',
        toolCall: 'shuffla › generate_card_news',
        content: '완료됐어요! 포인트 컬러를 과감하게 누른 스트릿 무드로 카드뉴스를 만들었습니다. 편집이 필요하면 말씀해 주세요.',
        images: [{ src: '/mcp-demo/fashion-street.png', alt: '스트릿 패션 포인트 컬러 카드뉴스' }],
      },
    ],
  },
  {
    client: 'chatgpt',
    messages: [
      { role: 'user', content: '우리 카페 인스타 계정에 겨울 딸기 신메뉴 홍보 카드뉴스 만들어줘. 감성적인 톤으로.' },
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
      { role: 'user', content: '오늘 서울 카페 추천 콘텐츠 카드뉴스 만들고, 완성되면 인스타그램에 바로 올려줘.' },
      {
        role: 'assistant',
        toolCall: 'shuffla › generate_card_news → publish_to_instagram',
        content: '카드뉴스 생성 후 Instagram 게시까지 완료했어요! 방금 업로드된 게시물은 인스타그램 앱에서 바로 확인하실 수 있습니다.',
        images: [{ src: '/mcp-demo/food-cafe.png', alt: '서울 카페 추천 카드뉴스' }],
      },
    ],
  },
  {
    client: 'chatgpt',
    messages: [
      { role: 'user', content: '체형별 비율 팁 패션 피팅 가이드 카드뉴스 만들어줘. 실용적인 스타일링 정보 위주로.' },
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
      { role: 'user', content: "We run a streetwear brand. Make a card news for this season's bold color point look — heavy, strong mood." },
      {
        role: 'assistant',
        toolCall: 'shuffla › generate_card_news',
        content: "Done! I generated a card news with a heavy street mood that leans into the color point. Let me know if you'd like any edits.",
        images: [{ src: '/mcp-demo/fashion-street.png', alt: 'Street fashion card news' }],
      },
    ],
  },
  {
    client: 'chatgpt',
    messages: [
      { role: 'user', content: 'Make a card news for our cafe Instagram — promoting a new winter strawberry drink. Keep the tone warm and editorial.' },
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
      { role: 'user', content: 'Create a Seoul cafe recommendation card news, then publish it directly to Instagram when done.' },
      {
        role: 'assistant',
        toolCall: 'shuffla › generate_card_news → publish_to_instagram',
        content: 'All done — card news generated and published to Instagram! You can check the live post in your Instagram app right now.',
        images: [{ src: '/mcp-demo/food-cafe.png', alt: 'Seoul cafe card news' }],
      },
    ],
  },
  {
    client: 'chatgpt',
    messages: [
      { role: 'user', content: 'Make a fashion fitting guide card news focused on body proportion tips — practical styling advice.' },
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
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#D97757]">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M8.5 16.5L12 7.5L15.5 16.5M9.8 13.5H14.2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function ChatGPTIcon() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#10A37F]">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 6.5C9.51 6.5 7.5 8.51 7.5 11c0 .87.25 1.68.68 2.36L7 17l3.64-1.18A4.47 4.47 0 0012 16c2.49 0 4.5-2.01 4.5-4.5S14.49 6.5 12 6.5z" stroke="white" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function ChatWindow({ demo, isEn }: { demo: ChatDemo; isEn: boolean }) {
  const isClaude = demo.client === 'claude'
  const clientName = isClaude ? 'Claude' : 'ChatGPT'

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-sm">
      {/* Window chrome */}
      <div className="flex items-center gap-2.5 border-b border-black/[0.06] bg-[#f5f5f2] px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-[#8a8a8a]">
          {isClaude ? <ClaudeIcon /> : <ChatGPTIcon />}
          <span className="font-medium">{clientName}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-0 px-4 py-4">
        {demo.messages.map((msg, i) => (
          <div
            key={i}
            className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} ${i > 0 ? 'mt-4' : ''}`}
          >
            {/* Avatar */}
            {msg.role === 'user' ? (
              <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-[11px] font-bold text-white">
                {isEn ? 'U' : '나'}
              </div>
            ) : (
              <div className="mb-0.5 shrink-0">
                {isClaude ? <ClaudeIcon /> : <ChatGPTIcon />}
              </div>
            )}

            {/* Bubble */}
            <div className={`max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
              {msg.role === 'assistant' && msg.toolCall && (
                <div className="inline-flex items-center gap-1.5 rounded-md border border-black/[0.07] bg-[#fafaf7] px-2.5 py-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="font-mono text-[11px] text-[#8a8a8a]">{msg.toolCall}</span>
                </div>
              )}
              <div
                className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'rounded-br-sm bg-[#0a0a0a] text-white'
                    : 'rounded-bl-sm bg-[#f0efec] text-[#0a0a0a]'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'assistant' && msg.images && msg.images.length > 0 && (
                <div className={`grid gap-2 ${msg.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} w-full max-w-[320px]`}>
                  {msg.images.map((img, j) => (
                    <div key={j} className="aspect-[4/5] overflow-hidden rounded-xl">
                      <Image
                        src={img.src}
                        alt={img.alt}
                        width={320}
                        height={400}
                        className="h-full w-full object-cover object-center scale-[1.04]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div className="border-t border-black/[0.06] bg-[#f5f5f2] px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3.5 py-2">
          <span className="flex-1 text-[13px] text-[#c0bfbc]">
            {isEn ? `Message ${clientName}` : `${clientName}에게 메시지 보내기`}
          </span>
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-black/[0.06]">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M6 10V2M2 6l4-4 4 4" stroke="#8a8a8a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
    <section className="mx-auto w-full max-w-5xl border-t border-black/[0.06] px-5 py-14 md:px-8">
      <div className="mb-8">
        <h2 className="text-[20px] font-black tracking-[-0.03em]">
          {isEn ? 'See it in action' : '실제로 이렇게 작동해요'}
        </h2>
        <p className="mt-1.5 text-[13px] text-[#8a8a8a]">
          {isEn
            ? 'Ask your AI assistant to make card news — Shuffla handles the rest.'
            : 'AI 에이전트에게 카드뉴스를 요청하면 Shuffla가 자동으로 처리합니다.'}
        </p>
      </div>
      <div className="flex flex-col gap-6">
        {demos.map((demo, i) => (
          <ChatWindow key={i} demo={demo} isEn={isEn} />
        ))}
      </div>
    </section>
  )
}
