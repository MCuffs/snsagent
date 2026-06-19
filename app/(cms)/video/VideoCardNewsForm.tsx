'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Send, Sparkles, X } from 'lucide-react'

interface Brand {
  id: string
  name: string
  industry: string
  targetAudience: string
  toneOfVoice: string
  mainColor: string
  forbiddenWords: string
  ctaStyle: string
  brandDna?: string | null
  websiteUrl?: string | null
}

interface VideoCardNewsFormProps {
  brand: Brand | null
  userId?: string
  userEmail?: string | null
  userName?: string | null
  isGuest?: boolean
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
}

const SEEDANCE_READY = Boolean(process.env.NEXT_PUBLIC_SEEDANCE_READY)

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: '안녕하세요! 영상 카드뉴스를 만들어봅시다.\n\n참고할 이미지를 첨부하고, 어떤 영상 카드뉴스를 만들고 싶은지 주제를 입력해주세요.\n\n영상은 슬라이드별 3~5초 클립으로 생성되며, 9:16 화면 상단에 영상, 하단에 텍스트가 배치됩니다.',
}

export default function VideoCardNewsForm({ brand, userId: _userId, isGuest }: VideoCardNewsFormProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [attachedImage, setAttachedImage] = useState<{ url: string; file: File } | null>(null)
  const [previewSlide, setPreviewSlide] = useState<{ headline: string; body: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setAttachedImage({ url, file })
  }

  const handleRemoveImage = () => {
    if (attachedImage) URL.revokeObjectURL(attachedImage.url)
    setAttachedImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSend = () => {
    if (!input.trim() && !attachedImage) return

    if (isGuest) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: input, imageUrl: attachedImage?.url },
        { role: 'assistant', content: '영상 카드뉴스를 만들려면 로그인이 필요합니다.' },
      ])
      setInput('')
      setAttachedImage(null)
      return
    }

    if (!SEEDANCE_READY) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: input, imageUrl: attachedImage?.url },
        { role: 'assistant', content: '영상 카드뉴스 생성 기능은 현재 준비 중입니다. 곧 서비스됩니다! 🎬' },
      ])
      setInput('')
      setAttachedImage(null)
      return
    }

    // TODO: Seedance API 연결 후 실제 생성 로직 구현
    setMessages(prev => [...prev, { role: 'user', content: input, imageUrl: attachedImage?.url }])
    setInput('')
    setAttachedImage(null)
  }

  const isInputDisabled = !SEEDANCE_READY && !isGuest
    ? false // disabled 메시지만 보여주되 전송은 허용 (응답에서 "준비 중" 안내)
    : false

  return (
    <div className="flex h-full overflow-hidden">
      {/* 좌측: 채팅 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden border-r border-[#e4e4e7]">
        {/* 상단 헤더 */}
        <div className="flex items-center gap-2.5 border-b border-[#e4e4e7] bg-white px-5 py-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111111]">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#111111]">영상 카드뉴스 생성</p>
            <p className="text-[11px] text-[#71717a]">
              {brand ? `${brand.name} · ` : ''}Beta
              {!SEEDANCE_READY && <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold text-amber-700">준비 중</span>}
            </p>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#111111] text-white'
                  : 'bg-[#f4f4f5] text-[#111111]'
              }`}>
                {msg.imageUrl && (
                  <img
                    src={msg.imageUrl}
                    alt="첨부 이미지"
                    className="mb-2 max-h-40 rounded-lg object-cover"
                  />
                )}
                {msg.content.split('\n').map((line, j) => (
                  <span key={j}>{line}{j < msg.content.split('\n').length - 1 && <br />}</span>
                ))}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 이미지 첨부 미리보기 */}
        {attachedImage && (
          <div className="flex items-center gap-2 border-t border-[#e4e4e7] bg-[#fafafa] px-5 py-2">
            <div className="relative">
              <img src={attachedImage.url} alt="첨부" className="h-12 w-12 rounded-lg object-cover border border-[#e4e4e7]" />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#111] text-white"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
            <p className="text-[12px] text-[#71717a]">참고 이미지 첨부됨</p>
          </div>
        )}

        {/* 입력 영역 */}
        <div className="border-t border-[#e4e4e7] bg-white px-4 py-3">
          {!SEEDANCE_READY && (
            <p className="mb-2 text-center text-[11px] text-amber-600">
              ⚠️ 영상 생성 API 준비 중입니다. 입력하시면 완료 시 바로 연결됩니다.
            </p>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageAttach}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#e4e4e7] text-[#71717a] transition hover:bg-[#f4f4f5] hover:text-[#111111]"
              title="이미지 첨부"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              disabled={isInputDisabled}
              placeholder="주제나 키워드를 입력하세요... (이미지 첨부 권장)"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-[#e4e4e7] bg-[#fafafa] px-4 py-2.5 text-sm outline-none transition focus:border-[#111111] focus:bg-white disabled:opacity-50"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isInputDisabled || (!input.trim() && !attachedImage)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#111111] text-white transition hover:bg-[#333] disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 우측: 9:16 미리보기 */}
      <div className="hidden w-[240px] shrink-0 flex-col items-center justify-center bg-[#fafafa] p-5 lg:flex">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#a1a1aa]">미리보기</p>
        {/* 9:16 비율 컨테이너 */}
        <div
          className="w-full overflow-hidden rounded-2xl border border-[#e4e4e7] shadow-sm"
          style={{ aspectRatio: '9/16' }}
        >
          {/* 상단 50%: 영상 영역 */}
          <div className="relative flex h-1/2 items-center justify-center bg-[#e4e4e7]">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/60">
                <Sparkles className="h-5 w-5 text-[#a1a1aa]" />
              </div>
              <p className="text-[10px] text-[#a1a1aa]">생성형 영상</p>
            </div>
          </div>
          {/* 하단 50%: 검정 텍스트 영역 */}
          <div className="flex h-1/2 flex-col justify-center bg-[#111111] px-3 py-3">
            <p className="text-[11px] font-bold leading-tight text-white">
              {previewSlide?.headline || '제목이 여기에 표시됩니다'}
            </p>
            <p className="mt-2 text-[9px] leading-relaxed text-[#a1a1aa]">
              {previewSlide?.body || '본문 텍스트가 여기에 표시됩니다. AI가 슬라이드별로 생성합니다.'}
            </p>
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] text-[#a1a1aa]">
          9:16 · 슬라이드당 3~5초
        </p>
      </div>
    </div>
  )
}
