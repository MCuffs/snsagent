import Link from 'next/link'
import { Sparkles, ArrowRight, CheckCircle2, ChevronRight, Target, Users, Check } from 'lucide-react'

export const metadata = {
  title: 'InstaAgent - AI 인스타그램 운영 자동화 SaaS',
  description: '매일 인스타그램에 올릴 콘텐츠, 이제 AI 직원이 대신 준비합니다.',
}

export default function LandingPage() {
  const targets = [
    { name: '스마트스토어', desc: '상품 설명과 상세 이미지만 넣으면 홍보 피드 뚝딱 완성' },
    { name: '로컬 카페 / 음식점', desc: '원두 향과 아늑한 공간 스토리를 담은 감성 카드뉴스' },
    { name: '병·의원 / 전문직', desc: '어려운 의학/전문 정보를 환자들이 이해하기 쉬운 요약 콘텐츠로' },
    { name: '뷰티 / 피부케어', desc: '전후 케어 루틴과 추천 스킨케어 팁 정보성 기획' },
    { name: '피트니스 / 필라테스', desc: '회원들을 자극하는 운동 팁과 식단 가이드 루틴 기획' },
    { name: '1인 지식창업 / 강사', desc: '본인의 노하우와 커리큘럼을 세련된 요약 피드로 배포' }
  ]

  const features = [
    { title: '브랜드 맞춤형 자동 기획', desc: '업종, 핵심 타겟, 브랜드 말투, 주요 색상과 절대 쓰면 안 되는 금지어까지 학습하여 완벽한 컨셉으로 자동 기획합니다.' },
    { title: 'AI 카드뉴스 이미지 생성', desc: '슬라이드 주제별 이미지 생성부터 브랜드 고유 컬러가 스며든 레이아웃 타이포 디자인까지 한번에 생성합니다.' },
    { title: '원클릭 예약 & 자동 발행', desc: 'AI가 디자인한 피드안을 확인하고 [승인]만 누르면, 인스타그램 그래프 API를 통해 예약 일시에 즉시 자동 발행됩니다.' },
  ]

  const pricing = [
    {
      name: 'Free',
      price: '₩0',
      period: '평생 무료',
      desc: 'AI 인턴 기능 맛보기',
      features: ['월 5개 카드뉴스 기획 생성', '브랜드 프로필 1개 설정', '이미지 수동 다운로드 업로드', '이미지 하단 워터마크 표시'],
      cta: '무료로 시작하기',
      popular: false
    },
    {
      name: 'Starter',
      price: '₩29,000',
      period: '/ 월',
      desc: '1인 창업가 및 소상공인 추천',
      features: ['월 30개 카드뉴스 생성', '브랜드 프로필 1개 설정', '인스타그램 예약/자동 업로드 지원', '워터마크 없음', '24시간 예약 큐 작동'],
      cta: '스타터 시작하기',
      popular: false
    },
    {
      name: 'Pro',
      price: '₩79,000',
      period: '/ 월',
      desc: '성장하는 브랜드와 전문 마케터',
      features: ['월 150개 카드뉴스 생성', '브랜드 프로필 최대 5개', '인스타그램 예약/자동 업로드 지원', '피드 성과 분석 대시보드', '프리미엄 비주얼 스타일 스위칭'],
      cta: '프로 플랜 시작하기',
      popular: true
    },
    {
      name: 'Agency',
      price: '₩199,000',
      period: '/ 월',
      desc: '다수의 계정을 관리하는 대행사',
      features: ['브랜드 프로필 무제한', '카드뉴스 생성 무제한', '클라이언트 독립 관리 보드', '팀 협업 및 승인 요청 메일링', '우선 순위 AI 모델 배정'],
      cta: '에이전시 문의하기',
      popular: false
    }
  ]

  return (
    <div className="min-h-screen bg-[#fcfbfa] text-[#1e1e1e] flex flex-col font-sans antialiased selection:bg-[#ff4f00]/10 selection:text-[#ff4f00]">
      
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-12 border-b border-slate-200/80 bg-white/80 backdrop-blur-md z-20 sticky top-0">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-1.5 group">
            <span className="text-[#ff4f00] font-black text-2xl tracking-tighter">_insta</span>
            <span className="font-extrabold text-2xl tracking-tighter text-slate-800">agent</span>
            <span className="text-[10px] px-1.5 py-0.5 font-bold rounded bg-slate-100 border border-slate-200 text-slate-500 ml-1">AI</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-500">
            <a href="#targets" className="hover:text-black transition-colors">대상 고객</a>
            <a href="#features" className="hover:text-black transition-colors">주요 기능</a>
            <a href="#pricing" className="hover:text-black transition-colors">요금제</a>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-bold text-slate-600 hover:text-black transition-colors">
            로그인
          </Link>
          <Link 
            href="/login" 
            className="px-4 py-2 rounded-md text-sm font-bold bg-[#ff4f00] text-white hover:bg-[#e04500] active:scale-[0.98] transition-all flex items-center gap-1"
          >
            <span>시작하기</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-12 md:py-20 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left Side: Copy */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-[#ff4f00] animate-pulse"></span>
            <span>인스타그램 운영을 자동화하는 최초의 AI 마케터 직원</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] text-slate-900">
            인스타그램 카드뉴스,<br />
            이제 <span className="text-[#ff4f00]">AI 직원</span>이 알아서 다 해드립니다.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 max-w-2xl font-medium leading-relaxed">
            매번 디자인 캔버스를 붙잡고 씨름하지 마세요. 상품 설명과 핵심 컨셉만 적어두면, AI가 브랜드 톤에 맞는 기획부터 슬라이드별 디자인, 인스타 전송까지 전부 대행합니다.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-[#ff4f00]" /> 평생 무료 플랜 제공
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-[#ff4f00]" /> 1분 가입 후 즉시 기획 시작
            </span>
            <span className="flex items-center gap-1">
              <Check className="w-4 h-4 text-[#ff4f00]" /> 인스타그램 예약 발행 공식 지원
            </span>
          </div>
        </div>

        {/* Right Side: Sign up box (Zapier Mockup Card) */}
        <div className="lg:col-span-5">
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-xl space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-extrabold text-slate-900">1초 데모 계정으로 바로 시작</h2>
              <p className="text-xs text-slate-500">신용카드나 번거로운 설정 없이 즉시 체험 가능</p>
            </div>

            {/* Simulated Google Button */}
            <Link 
              href="/login"
              className="w-full flex items-center justify-center gap-2.5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-bold transition-all shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#ea4335" d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.45 1.74 14.93 1 12 1 7.35 1 3.4 3.65 1.49 7.5l3.79 2.94C6.18 7.39 8.87 5.04 12 5.04z" />
                <path fill="#4285f4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.44c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.39-4.88 3.39-8.5z" />
                <path fill="#fbbc05" d="M5.28 14.76A7.05 7.05 0 0 1 4.8 12c0-.98.17-1.92.48-2.76L1.49 6.3C.54 8.01 0 9.94 0 12s.54 3.99 1.49 5.7l3.79-2.94z" />
                <path fill="#34a853" d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.66-2.84c-1.01.67-2.3 1.07-4.3 1.07-3.13 0-5.82-2.35-6.77-5.4L1.49 15.85C3.4 19.7 7.35 23 12 23z" />
              </svg>
              <span>구글 계정으로 시작하기</span>
            </Link>

            {/* Divider */}
            <div className="flex items-center text-xs text-slate-400 font-bold uppercase">
              <div className="flex-1 border-t border-slate-200/80"></div>
              <span className="px-3">또는 이메일 간편 가입</span>
              <div className="flex-1 border-t border-slate-200/80"></div>
            </div>

            {/* Input Form Fields */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">업무용 이메일 *</label>
                <input 
                  type="email" 
                  placeholder="name@company.com" 
                  disabled
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-400 cursor-not-allowed"
                />
              </div>

              <Link 
                href="/login"
                className="w-full inline-flex items-center justify-center py-3 bg-[#ff4f00] hover:bg-[#e04500] text-white text-sm font-extrabold rounded-lg shadow-md transition-all"
              >
                <span>무료로 시작하기</span>
              </Link>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed text-center">
              가입 시 InstaAgent의 <span className="underline cursor-pointer">서비스 이용약관</span> 및 <span className="underline cursor-pointer">개인정보 보호정책</span>에 동의하게 됩니다.
            </p>
          </div>
        </div>
      </section>

      {/* Metrics Section (High Contrast Statistics Line) */}
      <section className="border-y border-slate-200 bg-white py-10 z-10">
        <div className="max-w-6xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-800">
          
          <div className="space-y-2 border-b md:border-b-0 md:border-r border-slate-200 pb-6 md:pb-0 pr-6">
            <span className="text-5xl md:text-6xl font-black text-[#ff4f00] tracking-tight">13%</span>
            <p className="text-sm font-bold text-slate-800 mt-1">
              InstaAgent 도입 후 매장/스마트스토어 평균 매출 증가율
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              콘텐츠 기획 및 일관된 피드 발행 덕분에 도달 범가 2.4배 늘어나 유입 고객이 증가했습니다.
            </p>
          </div>

          <div className="space-y-2 pl-0 md:pl-6">
            <span className="text-5xl md:text-6xl font-black text-slate-850 tracking-tight">10min</span>
            <p className="text-sm font-bold text-slate-800 mt-1">
              피드 1개당 평균 기획 및 그래픽 디자인 소요 시간
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              캔버스를 켜서 레이아웃을 고치고 문구를 고치는 고통스러운 작업이, AI 직원 승인 단 10초로 단축됩니다.
            </p>
          </div>

        </div>
      </section>

      {/* Workflow Section: What is InstaAgent */}
      <section id="features" className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 text-center space-y-16">
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">단순한 디자인 캔버스 툴이 아닌 &ldquo;AI 마케팅 직원&rdquo;입니다</h2>
            <p className="text-slate-600 max-w-xl mx-auto font-medium text-sm">
              인스타그램 기획부터 그래픽 타이포 생성, 본문 캡션 작성 및 스케줄에 맞춘 업로드 자동화까지 인스타 운영에 관한 모든 프로세스를 스스로 책임집니다.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {features.map((f, idx) => (
              <div key={idx} className="bg-white p-8 rounded-xl border border-slate-200/80 shadow-sm text-left flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-[#ff4f00]/10 flex items-center justify-center text-[#ff4f00]">
                    {idx === 0 ? <Target className="w-6 h-6" /> : idx === 1 ? <Sparkles className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{f.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{f.desc}</p>
                </div>
                <div className="border-t border-slate-100 pt-4">
                  <span className="text-[10px] text-[#ff4f00] font-black uppercase tracking-wider">Step 0{idx + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Targets Grid */}
      <section id="targets" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl font-black tracking-tight text-slate-950">어떤 업종에서 AI 직원을 활용하고 있나요?</h2>
            <p className="text-sm font-medium text-slate-500 max-w-xl mx-auto">
              매일 인스타그램 업로드에 시달리지만 마케터나 디자이너를 추가 고용하기 부담스러웠던 1인 창업가와 소상공인 대표님들을 위한 솔루션입니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {targets.map((t, idx) => (
              <div 
                key={idx} 
                className="p-6 rounded-xl border border-slate-200 bg-white hover:border-[#ff4f00] hover:shadow-md transition-all duration-200"
              >
                <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-extrabold text-xs mb-4">
                  0{idx + 1}
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mb-2">{t.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Plans Grid */}
      <section id="pricing" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16 space-y-3">
            <h2 className="text-3xl font-black text-slate-950 tracking-tight">인스타 대행 요금의 10분의 1, 합리적인 AI 멤버십</h2>
            <p className="text-sm font-medium text-slate-500 max-w-xl mx-auto">
              초기 스타트업부터 멀티 브랜드를 운영하는 마케팅 대행사까지 알맞은 요금제를 선택하세요.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricing.map((p, idx) => (
              <div 
                key={idx} 
                className={`p-6 rounded-xl border flex flex-col justify-between bg-white relative transition-all duration-300 ${
                  p.popular 
                    ? 'border-[#ff4f00] shadow-lg scale-102 z-10' 
                    : 'border-slate-200'
                }`}
              >
                {p.popular && (
                  <span className="absolute top-0 right-6 translate-y-[-50%] px-3 py-1 rounded-full bg-[#ff4f00] text-[9px] font-black uppercase text-white tracking-wider shadow">
                    Most Popular
                  </span>
                )}
                <div>
                  <h3 className="text-base font-black text-slate-900 mb-1">{p.name}</h3>
                  <p className="text-[10px] text-slate-400 mb-4 font-semibold">{p.desc}</p>
                  
                  <div className="flex items-baseline mb-6">
                    <span className="text-2xl font-black text-slate-900">{p.price}</span>
                    <span className="text-xs text-slate-400 ml-1 font-bold">{p.period}</span>
                  </div>

                  <ul className="space-y-3 mb-8 border-t border-slate-100 pt-4">
                    {p.features.map((f, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-[#ff4f00] flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href="/login"
                  className={`w-full py-3 rounded-lg text-xs font-bold text-center transition-all ${
                    p.popular 
                      ? 'bg-[#ff4f00] hover:bg-[#e04500] text-white shadow' 
                      : 'bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA Block */}
      <section className="py-20 bg-white border-t border-slate-200 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <div className="p-12 rounded-3xl bg-[#2d1b33] text-white relative overflow-hidden space-y-6">
            <div className="absolute top-0 right-0 w-[40%] h-[40%] rounded-full bg-[#ff4f00]/10 blur-[80px] pointer-events-none"></div>
            
            <h2 className="text-3xl font-black tracking-tight leading-tight">
              매일 인스타그램에 쏟던 에너지를<br />
              본업 성장에 더 투자하세요.
            </h2>
            <p className="text-sm text-slate-350 max-w-lg mx-auto font-medium leading-relaxed">
              하루 단 10초, AI가 밤새 기획해 둔 카드뉴스 초안을 스마트폰으로 승인하고 예약 발행하세요. 인스타 자동 관리가 시작됩니다.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 py-4 px-8 rounded-lg font-bold bg-[#ff4f00] text-white hover:bg-[#e04500] active:scale-[0.98] transition-all cursor-pointer shadow-lg shadow-[#ff4f00]/20"
            >
              <span>지금 무료 가입하기</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6 md:px-12 text-slate-500 bg-white text-xs z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-[#ff4f00] font-black text-sm tracking-tighter">_insta</span>
            <span className="font-extrabold text-sm tracking-tighter text-slate-800">agent</span>
          </div>
          <span>© 2026 InstaAgent. All rights reserved.</span>
          <div className="flex gap-4 font-semibold">
            <a href="#" className="hover:text-black">이용약관</a>
            <a href="#" className="hover:text-black">개인정보처리방침</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
