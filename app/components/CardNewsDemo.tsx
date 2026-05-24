'use client'

import { useState } from 'react'
import { FileText, ImageIcon, Sparkles, CheckCircle2, Download, Pencil } from 'lucide-react'

const steps = [
    { label: '주제 분석 중...', icon: FileText },
    { label: '슬라이드 구조 생성 중...', icon: Sparkles },
    { label: '디자인 적용 중...', icon: ImageIcon },
    { label: '카드뉴스 완성!', icon: CheckCircle2 },
]

const cards = [
    { label: '표지', gradient: 'from-blue-500 to-indigo-600', delay: 0 },
    { label: '2장', gradient: 'from-indigo-400 to-purple-500', delay: 150 },
    { label: '3장', gradient: 'from-blue-400 to-blue-600', delay: 300 },
    { label: '4장', gradient: 'from-purple-500 to-pink-500', delay: 450 },
    { label: '5장', gradient: 'from-cyan-400 to-blue-500', delay: 600 },
]

type Phase = 'idle' | 'loading' | 'done'

export default function CardNewsDemo() {
    const [phase, setPhase] = useState<Phase>('idle')
    const [currentStep, setCurrentStep] = useState(0)
    const [visibleCards, setVisibleCards] = useState<boolean[]>([false, false, false, false, false])
    const [selectedCard, setSelectedCard] = useState(0)

    function handleGenerate() {
        if (phase !== 'idle') return
        setPhase('loading')
        setCurrentStep(0)
        setVisibleCards([false, false, false, false, false])

        // Step through loading steps
        steps.forEach((_, i) => {
            setTimeout(() => {
                setCurrentStep(i)
            }, i * 700)
        })

        // After all steps, show cards one by one
        setTimeout(() => {
            setPhase('done')
            cards.forEach((card, i) => {
                setTimeout(() => {
                    setVisibleCards(prev => {
                        const next = [...prev]
                        next[i] = true
                        return next
                    })
                }, card.delay)
            })
        }, steps.length * 700 + 200)
    }

    function handleReset() {
        setPhase('idle')
        setCurrentStep(0)
        setVisibleCards([false, false, false, false, false])
        setSelectedCard(0)
    }

    return (
        <div className="mx-auto max-w-5xl rounded-[24px] border border-gray-200/60 bg-white shadow-2xl shadow-blue-900/5 p-2 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
            <div className="bg-gray-50/50 rounded-[20px] p-8 md:p-10 overflow-hidden relative min-h-[360px]">
                <div className="grid md:grid-cols-3 gap-6 h-full">

                    {/* Left: Input Panel */}
                    <div className="col-span-1 rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col gap-4">
                        <div className="flex gap-2 items-center">
                            <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <FileText className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-[13px] font-bold text-gray-700">주제 입력</span>
                        </div>

                        <div className="relative h-10 rounded-xl bg-gray-50 border border-dashed border-gray-200 flex items-center px-3 overflow-hidden">
                            <span className="text-[12px] text-gray-400">&ldquo;2024 SNS 트렌드 총정리&rdquo;</span>
                            {/* Blinking cursor animation when idle */}
                            {phase === 'idle' && (
                                <span className="ml-0.5 inline-block w-0.5 h-3 bg-blue-500 animate-[blink_1s_ease-in-out_infinite]" />
                            )}
                        </div>

                        <div className="h-5 w-3/4 rounded bg-gray-100" />
                        <div className="h-5 w-1/2 rounded bg-gray-100" />

                        <div className="mt-auto">
                            {phase === 'done' ? (
                                <button
                                    onClick={handleReset}
                                    className="w-full h-10 rounded-xl border border-gray-200 text-[13px] font-semibold text-gray-500 hover:bg-gray-50 transition-all"
                                >
                                    다시 만들기
                                </button>
                            ) : (
                                <button
                                    onClick={handleGenerate}
                                    disabled={phase === 'loading'}
                                    className={`w-full h-10 rounded-xl text-[13px] font-semibold text-white transition-all relative overflow-hidden
                    ${phase === 'loading'
                                            ? 'bg-blue-400 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700 hover:shadow-[0_4px_14px_rgba(0,102,255,0.3)] hover:-translate-y-[1px] active:translate-y-0'
                                        }`}
                                >
                                    {phase === 'loading' ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                                            생성 중...
                                        </span>
                                    ) : '생성하기'}
                                    {/* Shimmer sweep when idle */}
                                    {phase === 'idle' && (
                                        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right: Preview Panel */}
                    <div className="col-span-2 rounded-2xl bg-white p-5 shadow-sm border border-gray-100 flex flex-col gap-4 relative overflow-hidden">

                        {/* Loading overlay */}
                        {phase === 'loading' && (
                            <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center gap-5 z-10 px-8">
                                <div className="w-full max-w-xs space-y-3">
                                    {steps.map((step, i) => {
                                        const Icon = step.icon
                                        const isActive = i === currentStep
                                        const isDone = i < currentStep
                                        return (
                                            <div
                                                key={i}
                                                className={`flex items-center gap-3 transition-all duration-500 ${i > currentStep ? 'opacity-20' : 'opacity-100'
                                                    }`}
                                            >
                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${isDone
                                                    ? 'bg-green-100 text-green-600'
                                                    : isActive
                                                        ? 'bg-blue-100 text-blue-600'
                                                        : 'bg-gray-100 text-gray-400'
                                                    }`}>
                                                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className={`h-4 w-4 ${isActive ? 'animate-pulse' : ''}`} />}
                                                </div>
                                                <div className="flex-1">
                                                    <span className={`text-[13px] font-semibold ${isDone ? 'text-green-600' : isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                                                        {step.label}
                                                    </span>
                                                    {isActive && (
                                                        <div className="mt-1 h-1 w-full rounded-full bg-gray-100 overflow-hidden">
                                                            <div className="h-full bg-blue-500 rounded-full animate-[progress_0.7s_ease-out_forwards]" />
                                                        </div>
                                                    )}
                                                    {isDone && (
                                                        <div className="mt-1 h-1 w-full rounded-full bg-green-100">
                                                            <div className="h-full w-full bg-green-400 rounded-full" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-gray-700">슬라이드 미리보기</span>
                            {phase === 'done' && (
                                <span className="text-[11px] text-blue-500 font-semibold animate-in fade-in duration-300">
                                    ✨ {cards.length}장 생성됨
                                </span>
                            )}
                            {phase === 'idle' && (
                                <span className="text-[11px] text-gray-400">생성하기를 눌러보세요</span>
                            )}
                        </div>

                        {/* Cards Grid */}
                        <div className="grid grid-cols-3 gap-3 flex-1">
                            {cards.slice(0, Math.min(3, cards.length)).map((card, i) => (
                                <button
                                    key={card.label}
                                    onClick={() => phase === 'done' && setSelectedCard(i)}
                                    className={`relative rounded-xl bg-gradient-to-br ${card.gradient} flex flex-col items-center justify-center transition-all duration-500
                    ${visibleCards[i]
                                            ? 'opacity-100 translate-y-0 scale-100'
                                            : 'opacity-0 translate-y-4 scale-95'
                                        }
                    ${selectedCard === i && phase === 'done' ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                    ${phase === 'done' ? 'cursor-pointer hover:brightness-105 hover:-translate-y-0.5 active:scale-95' : 'cursor-default'}
                  `}
                                    style={{ minHeight: 130 }}
                                >
                                    <ImageIcon className="h-6 w-6 text-white/60 mb-2" />
                                    <span className="text-white/80 text-[11px] font-medium">{card.label}</span>
                                    {visibleCards[i] && selectedCard === i && phase === 'done' && (
                                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                                            <CheckCircle2 className="h-3 w-3 text-white" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Action buttons */}
                        <div className={`flex gap-2 transition-all duration-500 ${phase === 'done' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                            <button className="h-9 flex-1 rounded-xl bg-gray-900 flex items-center justify-center gap-1.5 hover:bg-gray-800 transition-colors">
                                <Download className="h-3.5 w-3.5 text-white" />
                                <span className="text-white text-[12px] font-bold">전체 다운로드</span>
                            </button>
                            <button className="h-9 px-4 rounded-xl border border-gray-200 flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors">
                                <Pencil className="h-3.5 w-3.5 text-gray-600" />
                                <span className="text-gray-600 text-[12px] font-medium">편집하기</span>
                            </button>
                        </div>

                    </div>
                </div>
            </div>

            {/* Custom keyframes via style tag */}
            <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          60%, 100% { transform: translateX(200%); }
        }
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
        </div>
    )
}
