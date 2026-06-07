export type BlogLocale = 'ko' | 'en'

export type BlogPost = {
  slug: string
  category: string
  tagClass: string
  date: string
  title: string
  desc: string
  readTime: string
  keywords: string[]
  sections: {
    heading: string
    paragraphs: string[]
  }[]
}

export const BLOG_LOCALES: BlogLocale[] = ['ko', 'en']

export const blogPosts: Record<BlogLocale, BlogPost[]> = {
  ko: [
    {
      slug: '카드뉴스-자동화-가이드',
      category: '이용 가이드',
      tagClass: 'bg-[#e7f5ff] text-[#1c7ed6]',
      date: '2026.05.20',
      title: '카드뉴스 자동화 첫 번째 시작하기: 5분 완성 가이드',
      desc: '주제 입력부터 슬라이드 구성, 디자인 선택, 다운로드까지 카드뉴스 자동화 과정을 단계별로 안내합니다.',
      readTime: '5분 읽기',
      keywords: ['카드뉴스 자동화', 'SNS 자동 업로드', '인스타그램 자동 게시'],
      sections: [
        {
          heading: '카드뉴스 자동화가 필요한 이유',
          paragraphs: [
            '브랜드가 꾸준히 SNS를 운영하려면 기획, 카피 작성, 이미지 제작, 편집, 업로드까지 반복되는 작업을 매주 처리해야 합니다. 처음에는 한두 건이면 충분해 보여도 제품 출시, 이벤트, 후기 콘텐츠, 정보성 콘텐츠가 쌓이면 담당자는 금방 병목을 만납니다. 카드뉴스 자동화는 이 반복 구간을 줄여 주는 방식입니다. 사람이 해야 할 일은 메시지의 방향과 검수에 집중하고, AI는 슬라이드 흐름과 초안 제작을 맡습니다.',
            'Shuffla에서는 브랜드 URL과 주제만 입력해도 카드뉴스의 목적, 독자, 핵심 문장, 슬라이드 순서가 한 번에 제안됩니다. 결과물은 인스타그램 피드에 맞는 4:5 비율로 만들어지며, 문구와 배경 이미지는 편집 화면에서 바로 수정할 수 있습니다. 즉 자동화가 최종 판단을 대체하는 것이 아니라, 빈 화면에서 시작하는 시간을 줄이고 게시 가능한 초안까지 빠르게 이동시키는 역할을 합니다.',
          ],
        },
        {
          heading: '5분 안에 첫 카드뉴스 만들기',
          paragraphs: [
            '첫 단계는 브랜드 정보 입력입니다. 브랜드 URL을 넣으면 AI가 상품군, 톤앤매너, 고객층, 주요 메시지를 읽어 카드뉴스에 맞는 기준을 만듭니다. 그다음 주제를 한 문장으로 입력합니다. 예를 들어 "여름철 선크림 고르는 법", "신규 요금제 안내", "고객 후기 활용법"처럼 실제 게시 목적이 보이는 문장이 좋습니다. 너무 넓은 주제보다 독자가 저장하거나 공유할 만한 문제를 좁혀 쓰면 결과가 안정적입니다.',
            'AI가 제안한 초안은 바로 확정하지 말고 슬라이드 순서를 확인하세요. 첫 장은 멈춰 보게 만드는 후킹 문장, 중간 장은 근거와 설명, 마지막 장은 저장 또는 문의 같은 행동 제안으로 이어져야 합니다. 필요한 경우 제목을 더 짧게 만들고, 본문은 한 장에 하나의 주장만 남기는 편이 좋습니다. 완성 후 PNG로 다운로드하면 인스타그램 자동 게시 도구나 SNS 자동 업로드 워크플로우에 연결하기 쉽습니다.',
          ],
        },
        {
          heading: '자동화 후에도 사람이 확인해야 할 것',
          paragraphs: [
            '자동화된 카드뉴스라도 브랜드 고유 표현, 가격, 혜택 조건, 법적 고지는 반드시 사람이 확인해야 합니다. 특히 의료, 금융, 교육, 식품처럼 오해가 생기기 쉬운 분야는 과장 표현을 줄이고 출처가 필요한 문장은 따로 검토해야 합니다. AI가 만든 문구는 빠른 초안으로 보고, 최종 게시 전에는 브랜드 담당자의 기준으로 다듬는 과정이 필요합니다.',
            '운영 효율을 높이려면 같은 형식의 카드뉴스를 묶어서 제작하는 것이 좋습니다. 월요일은 정보성 팁, 수요일은 상품 활용법, 금요일은 후기나 FAQ처럼 고정 포맷을 정하면 카드뉴스 자동화의 효과가 커집니다. 이렇게 만든 결과물은 인스타그램 자동 게시 일정에 맞춰 예약하고, 반응이 좋은 주제는 다음 콘텐츠의 입력값으로 다시 활용할 수 있습니다.',
            '처음부터 모든 과정을 자동화하려고 하기보다 한 가지 반복 업무부터 줄이는 접근이 현실적입니다. 예를 들어 매주 발행하는 팁 콘텐츠만 Shuffla로 만들고, 성과가 안정되면 이벤트 안내나 상품 소개까지 확장할 수 있습니다. 이렇게 범위를 넓히면 팀 내부 승인 기준도 자연스럽게 쌓이고, 자동 생성 결과를 어떤 기준으로 수정해야 하는지도 빠르게 정리됩니다.',
          ],
        },
      ],
    },
    {
      slug: '카드뉴스-주제-선정법',
      category: '이용 가이드',
      tagClass: 'bg-[#e7f5ff] text-[#1c7ed6]',
      date: '2026.05.20',
      title: '어떤 주제가 카드뉴스에 가장 잘 맞을까?',
      desc: '뉴스 요약, 꿀팁 정리, 순위, 비교 분석처럼 카드뉴스에 잘 맞는 주제 유형을 소개합니다.',
      readTime: '4분 읽기',
      keywords: ['카드뉴스 주제', 'SNS 콘텐츠 기획', '인스타그램 카드뉴스'],
      sections: [
        {
          heading: '저장할 이유가 있는 주제가 강하다',
          paragraphs: [
            '카드뉴스는 한 번 보고 지나가는 이미지보다 저장하거나 공유할 이유가 있을 때 성과가 좋습니다. 그래서 단순한 회사 소개보다 "초보자가 자주 하는 실수 5가지", "구매 전 확인할 체크리스트", "비슷한 제품 비교표"처럼 독자가 다시 열어 볼 만한 구조가 유리합니다. 정보가 작고 분명할수록 슬라이드마다 메시지가 살아납니다.',
            '주제를 고를 때는 브랜드가 말하고 싶은 것보다 고객이 이미 궁금해하는 것을 먼저 잡아야 합니다. 검색어, 고객 문의, 댓글, 상담 기록, 상품 리뷰에서 반복되는 질문을 모으면 좋은 소재가 나옵니다. 이 데이터를 카드뉴스 자동화 입력값으로 넣으면 AI가 독자 관점의 흐름을 만들기 쉬워지고, 결과적으로 SNS 자동 업로드 후에도 반응을 얻을 가능성이 높아집니다.',
          ],
        },
        {
          heading: '카드뉴스에 맞는 대표 포맷',
          paragraphs: [
            '첫 번째 포맷은 체크리스트입니다. "계약 전 확인할 7가지", "여행 전 챙길 것"처럼 항목이 분리되는 주제는 카드뉴스와 잘 맞습니다. 두 번째는 비교입니다. A와 B의 차이, 무료와 유료의 차이, 초보자와 전문가의 선택 기준처럼 대비가 있는 내용은 독자가 빠르게 이해합니다. 세 번째는 단계형 가이드입니다. 신청, 준비, 실행, 점검처럼 순서가 있는 정보는 슬라이드 흐름이 자연스럽습니다.',
            '네 번째는 FAQ입니다. 반복 문의가 많은 브랜드라면 질문 하나를 카드 한 장으로 풀어 고객 응대 비용을 줄일 수 있습니다. 다섯 번째는 트렌드 해석입니다. 최신 뉴스나 업계 변화를 그대로 옮기기보다 "우리 고객에게 어떤 의미인가"를 설명하면 브랜드 전문성이 드러납니다. 이런 포맷은 인스타그램 자동 게시를 위한 월간 콘텐츠 캘린더로도 확장하기 좋습니다.',
          ],
        },
        {
          heading: '피해야 할 주제와 다듬는 법',
          paragraphs: [
            '너무 많은 내용을 한 번에 담으려는 주제는 피해야 합니다. "마케팅 완전 정복"보다 "소상공인이 첫 인스타그램 카드뉴스를 만들 때 확인할 5가지"가 훨씬 좋습니다. 독자, 상황, 문제, 결과가 제목 안에 보이면 AI도 더 정확한 슬라이드 구성을 만들 수 있습니다. 주제가 넓다면 시리즈로 나누고, 각 글은 하나의 질문에만 답하도록 정리하세요.',
            '브랜드 홍보만 있는 주제도 반응이 약합니다. 신제품을 소개하더라도 "왜 필요한가", "누가 쓰면 좋은가", "구매 전 어떤 점을 보면 좋은가"로 바꾸면 정보성이 생깁니다. 카드뉴스 자동화는 이런 구조화를 빠르게 도와주지만, 좋은 입력값을 넣을수록 결과가 좋아집니다. 결국 좋은 카드뉴스는 자동화 도구와 명확한 주제 선정이 함께 작동할 때 나옵니다.',
            '주제 후보가 많을 때는 예상 저장 가치, 제작 난이도, 브랜드 연결성을 기준으로 우선순위를 매기면 됩니다. 저장 가치가 높고 브랜드가 자연스럽게 답할 수 있는 주제부터 먼저 발행하세요. 이후 조회수, 저장수, 문의 전환을 비교하면 다음 달 카드뉴스 주제 선정이 훨씬 쉬워지고, SNS 콘텐츠 기획도 감이 아니라 데이터 중심으로 바뀝니다.',
          ],
        },
      ],
    },
    {
      slug: '제품-이미지-카드뉴스-품질',
      category: '이용 가이드',
      tagClass: 'bg-[#e7f5ff] text-[#1c7ed6]',
      date: '2026.05.20',
      title: '제품 참고 이미지로 카드뉴스 생성 품질 높이기',
      desc: '제품 이미지를 추가해 카드뉴스의 비주얼 방향을 더 구체적으로 전달하는 방법을 안내합니다.',
      readTime: '3분 읽기',
      keywords: ['제품 이미지 카드뉴스', 'AI 이미지 생성', '브랜드 비주얼'],
      sections: [
        {
          heading: '참고 이미지는 브랜드 문맥을 보강한다',
          paragraphs: [
            'AI가 카드뉴스를 만들 때 텍스트 설명만으로도 초안을 만들 수 있지만, 실제 제품 이미지가 있으면 결과가 훨씬 구체적입니다. 제품의 색상, 형태, 질감, 패키지 분위기, 사용 장면을 AI가 참고할 수 있기 때문입니다. 특히 뷰티, 식품, 패션, 생활용품처럼 시각 요소가 구매 판단에 큰 영향을 주는 업종에서는 참고 이미지가 결과물의 설득력을 높입니다.',
            '좋은 참고 이미지는 선명하고 제품이 잘 보이며 배경이 복잡하지 않은 이미지입니다. 여러 제품이 섞인 사진보다 한 제품이 중심에 있는 사진이 안정적이고, 사용 장면을 보여 주고 싶다면 손, 테이블, 공간 같은 맥락이 자연스럽게 보이는 이미지를 고르는 것이 좋습니다. 이렇게 준비한 이미지는 카드뉴스 자동화 과정에서 비주얼 방향을 잡는 기준으로 쓰입니다.',
          ],
        },
        {
          heading: '업로드 전 확인할 기준',
          paragraphs: [
            '첫째, 저작권과 사용 권한을 확인해야 합니다. 직접 촬영한 이미지나 브랜드가 사용할 수 있는 공식 이미지를 쓰는 것이 안전합니다. 둘째, 해상도가 너무 낮지 않아야 합니다. 작은 썸네일을 확대하면 결과물에서도 제품 디테일이 뭉개질 수 있습니다. 셋째, 로고나 텍스트가 이미지 안에 과하게 들어간 사진은 피하는 편이 좋습니다. AI가 이를 배경 요소로 잘못 해석할 수 있습니다.',
            '참고 이미지를 넣었다고 해서 최종 결과가 그대로 복사되는 것은 아닙니다. Shuffla는 제품의 분위기와 방향을 읽고 카드뉴스 배경과 구성에 반영하도록 설계되어 있습니다. 따라서 제품 사진은 "이런 느낌을 유지해 달라"는 지시로 이해하는 것이 좋습니다. 최종 편집 화면에서는 이미지 밝기, 대비, 텍스트 위치를 조정해 브랜드 가독성을 맞출 수 있습니다.',
          ],
        },
        {
          heading: 'SNS 게시까지 연결하는 운영 팁',
          paragraphs: [
            '제품 이미지를 활용한 카드뉴스는 상품 상세페이지, 인스타그램 피드, 스토리, 광고 소재로 재활용하기 좋습니다. 같은 제품이라도 "문제 제기", "사용법", "후기", "비교", "FAQ"처럼 다른 관점으로 여러 개의 카드뉴스를 만들면 소재 소진을 줄일 수 있습니다. 이때 일정표를 만들어 인스타그램 자동 게시와 연결하면 운영 부담이 줄어듭니다.',
            '품질을 높이려면 한 번에 완벽한 결과를 기대하기보다 기준 이미지를 조금씩 바꿔 테스트하세요. 흰 배경 제품컷, 사용 장면, 패키지 근접 사진을 각각 넣어 보고 어떤 방향이 브랜드에 맞는지 비교하면 됩니다. 반응이 좋은 스타일은 다음 SNS 자동 업로드 콘텐츠에도 반복 적용해 일관된 비주얼 자산으로 키울 수 있습니다.',
            '이미지 테스트 결과는 간단히 기록해 두는 것이 좋습니다. 어떤 배경, 구도, 색감에서 클릭이나 저장 반응이 좋았는지 남기면 다음 제작 때 입력값이 더 구체적이 됩니다. Shuffla에서 만든 초안과 실제 게시 성과를 함께 보면 제품 이미지가 단순 장식인지, 구매 이해를 돕는 핵심 요소인지 판단할 수 있습니다.',
            '특히 상세페이지와 SNS가 같은 제품을 다룬다면 이미지 기준을 통일하세요. 사용자가 광고, 피드, 상세페이지에서 비슷한 톤을 만나면 브랜드 신뢰가 높아지고 구매 흐름도 자연스러워집니다.',
          ],
        },
      ],
    },
    {
      slug: '셔플라-공식-런칭',
      category: '릴리즈 노트',
      tagClass: 'bg-[#f3f0ff] text-[#7950f2]',
      date: '2026.05.20',
      title: '2026.05.20 Shuffla 공식 런칭',
      desc: '카드뉴스 자동 구성, 슬라이드 편집, 프리미엄 템플릿 추가 등 이번 릴리즈의 주요 기능을 안내합니다.',
      readTime: '6분 읽기',
      keywords: ['Shuffla 런칭', '카드뉴스 제작 도구', 'AI 콘텐츠 스튜디오'],
      sections: [
        {
          heading: '브랜드를 위한 AI 카드뉴스 스튜디오',
          paragraphs: [
            'Shuffla는 브랜드가 SNS 콘텐츠를 더 빠르게 만들 수 있도록 설계된 AI 카드뉴스 스튜디오입니다. 단순한 이미지 생성 도구가 아니라, 브랜드 URL 분석, 콘텐츠 기획, 슬라이드 카피 작성, 배경 이미지 생성, 편집, 다운로드까지 하나의 흐름으로 연결합니다. 운영자는 반복 작업을 줄이고 메시지 검수와 게시 전략에 더 많은 시간을 쓸 수 있습니다.',
            '이번 공식 런칭 버전에서는 카드뉴스 자동화의 기본 워크플로우를 안정화했습니다. 사용자는 브랜드 정보를 입력하고 주제를 작성한 뒤, AI가 제안한 슬라이드 구성을 확인할 수 있습니다. 이후 편집 화면에서 문구와 배경을 수정하고, 인스타그램 피드에 적합한 1080x1350px 결과물로 내보낼 수 있습니다. 다운로드한 이미지는 SNS 자동 업로드 또는 인스타그램 자동 게시 일정에 바로 활용할 수 있습니다.',
          ],
        },
        {
          heading: '이번 버전의 핵심 기능',
          paragraphs: [
            '첫 번째 핵심은 브랜드 URL 분석입니다. 브랜드의 업종, 고객, 톤앤매너, 메시지 방향을 읽어 카드뉴스 초안의 기준으로 삼습니다. 두 번째는 AI 카피 생성입니다. 슬라이드별 제목과 본문을 단순 나열하지 않고, 후킹에서 설명, 행동 제안으로 이어지는 구조를 만듭니다. 세 번째는 AI 배경 이미지 생성입니다. 콘텐츠 주제와 브랜드 분위기에 맞는 시각 방향을 제안합니다.',
            '네 번째는 편집 스튜디오입니다. 자동 생성 결과를 그대로 쓰지 않고 텍스트, 배경, 오버레이, 이미지 레이어를 조정할 수 있습니다. 다섯 번째는 4:5 고해상도 내보내기입니다. 인스타그램에서 사용하기 좋은 비율로 결과물을 받을 수 있어 별도 디자인 툴을 거치는 시간을 줄입니다. 이 기능들은 카드뉴스 제작을 한 번의 연결된 작업으로 바꾸는 데 초점을 맞췄습니다.',
          ],
        },
        {
          heading: '앞으로의 개선 방향',
          paragraphs: [
            'Shuffla는 앞으로 콘텐츠 성과를 더 잘 반영하는 방향으로 발전할 예정입니다. 반복 생성한 카드뉴스의 주제, 문구, 비주얼 스타일을 학습해 브랜드별로 더 일관된 결과를 만들고, 팀 단위 검수와 예약 게시 흐름도 강화할 계획입니다. 특히 SNS 자동 업로드, 인스타그램 자동 게시 같은 운영 단계와 자연스럽게 연결되는 기능을 계속 확장할 예정입니다.',
            '초기 버전에서 가장 중요한 목표는 사용자가 빈 화면 앞에서 멈추지 않게 만드는 것입니다. 좋은 콘텐츠는 아이디어, 구조, 비주얼, 검수, 게시가 이어질 때 완성됩니다. Shuffla는 이 과정을 짧고 예측 가능하게 만들어 브랜드가 더 자주, 더 일관되게 카드뉴스를 발행할 수 있도록 돕겠습니다.',
            '런칭 이후에는 실제 사용자 피드백을 바탕으로 편집 속도, 템플릿 다양성, 브랜드별 문체 유지, 결과물 관리 기능을 우선 개선할 예정입니다. 카드뉴스 제작은 한 번 만들고 끝나는 일이 아니라 꾸준히 반복되는 운영 업무이기 때문입니다. Shuffla는 반복 발행을 기준으로 기능을 다듬어, 콘텐츠 팀이 매주 안정적으로 결과물을 만들 수 있는 환경을 목표로 합니다.',
          ],
        },
      ],
    },
    {
      slug: '요금제-결제-faq',
      category: 'FAQ',
      tagClass: 'bg-[#eefbf0] text-[#2f9e44]',
      date: '2026.05.20',
      title: '요금제 및 결제 FAQ',
      desc: '무료 생성 횟수, 유료 플랜 선택, 구독 변경, 환불 정책 등 결제 관련 질문을 모았습니다.',
      readTime: '4분 읽기',
      keywords: ['Shuffla 요금제', '카드뉴스 제작 비용', '구독 결제 FAQ'],
      sections: [
        {
          heading: '무료로 어디까지 사용할 수 있나요?',
          paragraphs: [
            '무료 플랜은 Shuffla의 카드뉴스 자동화 흐름을 실제로 경험해 볼 수 있도록 제공됩니다. 브랜드 정보를 입력하고 AI가 카드뉴스를 생성하는 과정을 확인할 수 있으며, 제한된 횟수 안에서 결과물을 만들어 볼 수 있습니다. 무료 사용만으로도 주제 입력, 초안 확인, 편집, 다운로드 흐름이 브랜드 운영에 맞는지 판단할 수 있습니다.',
            '무료 플랜의 목적은 기능 체험입니다. 정기적으로 SNS 콘텐츠를 운영하거나 여러 브랜드를 관리한다면 생성 횟수, 보관 기간, 추가 기능이 필요할 수 있습니다. 이 경우 유료 플랜을 선택하면 월간 콘텐츠 캘린더에 맞춰 카드뉴스를 꾸준히 만들고, 인스타그램 자동 게시나 SNS 자동 업로드 워크플로우에 연결하기 쉬워집니다.',
          ],
        },
        {
          heading: '어떤 플랜을 선택해야 하나요?',
          paragraphs: [
            '개인 브랜드나 소규모 쇼핑몰이 월 몇 건의 콘텐츠를 만드는 정도라면 기본 유료 플랜으로도 충분할 수 있습니다. 반면 대행사, 커머스 팀, 교육 기관처럼 여러 주제를 동시에 운영한다면 더 많은 생성 횟수와 긴 보관 기간이 필요합니다. 선택 기준은 단순히 가격이 아니라 한 달에 실제로 발행해야 하는 카드뉴스 개수입니다.',
            '요금제를 고를 때는 콘텐츠 제작 비용 전체를 함께 비교해야 합니다. 기획자, 디자이너, 외주 제작, 검수 시간을 모두 합치면 카드뉴스 한 건의 실제 비용은 생각보다 높습니다. Shuffla는 초안 제작과 편집 시간을 줄여 반복 운영 비용을 낮추는 데 초점을 둡니다. 자동화로 절약한 시간은 메시지 전략과 성과 분석에 쓰는 것이 좋습니다.',
          ],
        },
        {
          heading: '결제와 환불 관련 확인 사항',
          paragraphs: [
            '결제는 서비스 화면에 표시된 조건에 따라 진행되며, 구독 변경이나 취소는 계정 상태와 결제 수단에 따라 반영됩니다. 결제 전에는 월 생성 가능 횟수, 보관 기간, 포함 기능을 확인하세요. 팀에서 함께 사용하는 경우에는 누가 생성하고 누가 검수할지 운영 기준을 먼저 정해 두면 불필요한 사용량 낭비를 줄일 수 있습니다.',
            '환불은 실제 사용 여부와 결제 정책에 따라 달라질 수 있습니다. AI 생성 기능은 사용 즉시 비용이 발생하는 특성이 있으므로, 구매 전 무료 플랜으로 필요한 흐름을 먼저 테스트하는 것을 권장합니다. 궁금한 점은 결제 전에 문의하면 더 정확한 안내를 받을 수 있습니다. 카드뉴스 자동화 도구는 꾸준히 사용할수록 효율이 커지므로, 자신의 발행 빈도에 맞는 플랜을 선택하는 것이 중요합니다.',
            '플랜을 변경할 때는 다음 달 발행 계획을 먼저 확인하세요. 시즌 이벤트, 신제품 출시, 캠페인 일정이 있는 달에는 평소보다 많은 카드뉴스가 필요할 수 있습니다. 반대로 콘텐츠 발행이 적은 기간에는 생성 횟수를 아껴 쓰는 방식이 합리적입니다. 결제는 제작량과 운영 리듬에 맞춰 관리해야 비용 대비 효과를 확인하기 쉽습니다.',
            '또한 팀 내부에서 사용량을 주기적으로 확인하면 남은 생성 횟수를 중요한 캠페인에 배분할 수 있습니다. 작은 운영 습관만 있어도 불필요한 결제를 줄이고 필요한 콘텐츠는 놓치지 않을 수 있습니다.',
          ],
        },
      ],
    },
    {
      slug: 'ai-저작권-faq',
      category: 'FAQ',
      tagClass: 'bg-[#eefbf0] text-[#2f9e44]',
      date: '2026.05.20',
      title: 'AI 기능 및 저작권 FAQ',
      desc: 'AI가 생성한 카드뉴스의 저작권, 상업적 사용 가능 여부, 이미지 출처 관련 질문을 안내합니다.',
      readTime: '5분 읽기',
      keywords: ['AI 카드뉴스 저작권', '상업적 사용', 'AI 이미지 출처'],
      sections: [
        {
          heading: 'AI가 만든 카드뉴스를 상업적으로 쓸 수 있나요?',
          paragraphs: [
            'Shuffla에서 만든 카드뉴스는 브랜드 홍보, 상품 소개, 교육 자료, SNS 게시물 등 다양한 목적으로 활용할 수 있도록 설계되어 있습니다. 다만 최종 사용 책임은 게시자에게 있습니다. 입력한 브랜드 자료, 제품 이미지, 참고 문구, 외부 자료의 사용 권한은 반드시 확인해야 합니다. AI가 생성한 결과물이라도 타인의 상표, 초상, 저작물을 침해해서는 안 됩니다.',
            '상업적 사용을 계획한다면 게시 전 검수 절차를 두는 것이 좋습니다. 가격, 효과, 성능, 혜택처럼 소비자 판단에 영향을 주는 표현은 사실 여부를 확인해야 하고, "100% 보장", "최고", "완치"처럼 과장으로 보일 수 있는 문장은 업종별 광고 기준에 맞게 조정해야 합니다. 카드뉴스 자동화는 제작 시간을 줄여 주지만, 법적 판단과 브랜드 책임을 대신하지는 않습니다.',
          ],
        },
        {
          heading: '이미지와 참고 자료는 어떻게 관리해야 하나요?',
          paragraphs: [
            '제품 사진이나 브랜드 이미지를 업로드할 때는 직접 촬영했거나 사용할 권리가 있는 자료를 쓰는 것이 안전합니다. 검색에서 찾은 이미지를 무단으로 참고 이미지로 넣으면 최종 결과물의 사용에도 문제가 생길 수 있습니다. 로고, 캐릭터, 유명인의 얼굴, 경쟁사 자료처럼 권리관계가 복잡한 이미지는 사용 전에 별도 확인이 필요합니다.',
            'AI 배경 이미지는 콘텐츠의 분위기와 방향을 빠르게 제안하는 용도로 유용합니다. 하지만 실제 제품의 형태나 기능을 보여 줘야 하는 경우에는 브랜드가 보유한 정확한 제품 이미지를 함께 활용하는 것이 좋습니다. 편집 화면에서 배경과 텍스트를 조정하고, 최종 게시 전에 사실과 표현을 확인하면 인스타그램 자동 게시 일정에서도 리스크를 줄일 수 있습니다.',
          ],
        },
        {
          heading: '안전한 운영을 위한 체크리스트',
          paragraphs: [
            '첫째, 입력 자료의 권리를 확인하세요. 둘째, AI가 만든 문장이 사실과 맞는지 검토하세요. 셋째, 업종별 광고 심의나 표시 의무가 있는지 확인하세요. 넷째, 민감한 개인정보나 내부 자료를 불필요하게 입력하지 마세요. 다섯째, 최종 게시 전에는 브랜드 담당자가 전체 슬라이드를 한 번 더 읽어야 합니다.',
            '이 체크리스트를 지키면 AI 카드뉴스를 더 안전하게 운영할 수 있습니다. Shuffla는 빠른 제작과 편집을 돕는 도구이며, 좋은 결과는 자동화와 검수가 함께 작동할 때 만들어집니다. 특히 SNS 자동 업로드나 인스타그램 자동 게시처럼 예약 발행을 사용하는 경우에는 일정 등록 전에 최종 승인 단계를 두는 것을 권장합니다.',
            '팀으로 운영한다면 승인 권한도 명확히 나누는 편이 좋습니다. 작성자는 초안을 만들고, 브랜드 담당자는 표현과 톤을 확인하며, 최종 승인자는 법적 문구와 게시 일정을 확인하는 식입니다. 이런 구조를 갖추면 AI 생성 결과물을 더 빠르게 활용하면서도 실수 가능성을 줄일 수 있습니다. 자동화의 목적은 검수를 없애는 것이 아니라 검수해야 할 초안을 더 빠르게 준비하는 데 있습니다.',
            '게시 후에는 문제 신고나 고객 문의도 함께 확인하세요. 반복되는 오해가 보이면 다음 카드뉴스의 금칙어와 표현 기준에 반영해 더 안전한 운영 체계를 만들 수 있습니다.',
          ],
        },
      ],
    },
  ],
  en: [
    {
      slug: 'card-news-automation-guide',
      category: 'Guide',
      tagClass: 'bg-[#e7f5ff] text-[#1c7ed6]',
      date: '2026.05.20',
      title: 'Create Your First Card News: 5-Minute Automation Guide',
      desc: 'A step-by-step walkthrough from topic input to slide layout, design selection, editing, and download.',
      readTime: '5 min read',
      keywords: ['card news automation', 'SNS auto upload', 'Instagram auto publishing'],
      sections: [
        {
          heading: 'Why card news automation matters',
          paragraphs: [
            'Consistent social publishing requires planning, copywriting, visual production, editing, and export. Card news automation reduces that repetitive production load so teams can focus on message quality and review.',
            'With Shuffla, a brand URL and topic can become a structured slide draft, editable copy, AI-assisted visuals, and a 4:5 export ready for Instagram workflows.',
          ],
        },
        {
          heading: 'The first workflow',
          paragraphs: [
            'Start with a narrow topic, check the proposed slide order, shorten headlines, and keep one idea per slide. The result should move from hook to proof to action.',
            'After export, the PNG set can be used in your regular social calendar, SNS auto upload process, or Instagram auto publishing queue.',
          ],
        },
      ],
    },
    {
      slug: 'best-topics-for-card-news',
      category: 'Guide',
      tagClass: 'bg-[#e7f5ff] text-[#1c7ed6]',
      date: '2026.05.20',
      title: 'What Topics Work Best for Card News?',
      desc: 'News summaries, tips, rankings, comparisons, and FAQ formats that perform well as social card news.',
      readTime: '4 min read',
      keywords: ['card news topics', 'social content planning', 'Instagram carousel'],
      sections: [
        { heading: 'Choose saveable ideas', paragraphs: ['Card news works best when readers have a reason to save or share it. Checklists, comparisons, and step-by-step guides are stronger than broad brand introductions.', 'Use customer questions, reviews, comments, and search terms as inputs. Clearer inputs make automated card news drafts more useful.'] },
        { heading: 'Reliable formats', paragraphs: ['Checklists, comparisons, guides, FAQs, and trend explanations are reliable formats for repeatable social publishing.', 'A monthly calendar built around these formats makes Instagram publishing easier to sustain.'] },
      ],
    },
    {
      slug: 'product-images-card-news-quality',
      category: 'Guide',
      tagClass: 'bg-[#e7f5ff] text-[#1c7ed6]',
      date: '2026.05.20',
      title: 'Boost Quality with Reference Product Images',
      desc: 'How product images help guide AI visual direction and improve card news quality.',
      readTime: '3 min read',
      keywords: ['product image card news', 'AI image generation', 'brand visuals'],
      sections: [
        { heading: 'Reference images add context', paragraphs: ['Product photos help AI understand color, form, packaging, texture, and usage context. This is especially useful for commerce, beauty, food, fashion, and lifestyle brands.', 'Use sharp images that you own or are allowed to use. Avoid cluttered screenshots or unauthorized images.'] },
        { heading: 'Connect visuals to publishing', paragraphs: ['Product-led card news can be reused across feeds, stories, landing pages, and ads. Turn one product into multiple angles: problem, usage, review, comparison, and FAQ.', 'Test several reference styles and repeat the ones that match your brand best.'] },
      ],
    },
    {
      slug: 'shuffla-official-launch',
      category: 'Release Notes',
      tagClass: 'bg-[#f3f0ff] text-[#7950f2]',
      date: '2026.05.20',
      title: '2026.05.20 Official Launch',
      desc: 'Auto slide composition, editing studio, AI backgrounds, and premium templates added in this release.',
      readTime: '6 min read',
      keywords: ['Shuffla launch', 'card news maker', 'AI content studio'],
      sections: [
        { heading: 'An AI card news studio for brands', paragraphs: ['Shuffla connects brand analysis, content planning, slide copy, AI visuals, editing, and export into one workflow.', 'The launch version focuses on reducing the blank-page problem and producing reviewable drafts quickly.'] },
        { heading: 'Core launch features', paragraphs: ['Brand URL analysis, AI copy generation, AI background images, an editing studio, and 4:5 export are included in the current workflow.', 'Future updates will continue improving team review, scheduling, and repeatable brand memory.'] },
      ],
    },
    {
      slug: 'billing-subscription-faq',
      category: 'FAQ',
      tagClass: 'bg-[#eefbf0] text-[#2f9e44]',
      date: '2026.05.20',
      title: 'Billing & Subscription FAQ',
      desc: 'Plan selection, subscription changes, refunds, and usage questions for Shuffla.',
      readTime: '4 min read',
      keywords: ['Shuffla pricing', 'card news cost', 'subscription FAQ'],
      sections: [
        { heading: 'Start with expected publishing volume', paragraphs: ['Choose a plan based on how many card news posts you need every month, not only the price. A small brand may need a few drafts, while an agency or commerce team may need many.', 'Free usage is best for testing the workflow before committing to a repeat production process.'] },
        { heading: 'Payment and refund notes', paragraphs: ['Review included generation limits, retention periods, and features before payment. AI generation can incur cost as soon as it is used.', 'If you are unsure, test the free workflow and contact support before upgrading.'] },
      ],
    },
    {
      slug: 'ai-copyright-faq',
      category: 'FAQ',
      tagClass: 'bg-[#eefbf0] text-[#2f9e44]',
      date: '2026.05.20',
      title: 'AI Features & Copyright FAQ',
      desc: 'Copyright, commercial use, image sourcing, and review responsibilities for AI-generated card news.',
      readTime: '5 min read',
      keywords: ['AI card news copyright', 'commercial use', 'AI image source'],
      sections: [
        { heading: 'Commercial use requires review', paragraphs: ['Shuffla is built for brand content, but the publisher remains responsible for checking input rights, product claims, trademarks, portraits, and legal notices.', 'AI saves production time, but it does not replace brand, legal, or industry-specific review.'] },
        { heading: 'Use safe source material', paragraphs: ['Upload product photos, logos, and references that your brand has the right to use. Avoid random search images or rights-sensitive assets.', 'Before scheduled publishing, add a final approval step for copy, visuals, and claims.'] },
      ],
    },
  ],
}

export function getBlogPosts(locale: string): BlogPost[] {
  return blogPosts[locale === 'en' ? 'en' : 'ko']
}

export function getBlogPost(locale: string, slug: string): BlogPost | undefined {
  return getBlogPosts(locale).find((post) => post.slug === slug)
}

export function getAllBlogPostPaths() {
  return BLOG_LOCALES.flatMap((locale) =>
    blogPosts[locale].map((post) => ({
      locale,
      slug: post.slug,
    })),
  )
}
