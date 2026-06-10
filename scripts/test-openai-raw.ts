import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// 수동 .env 파싱
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8');
    envFile.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index === -1) return;
      const key = trimmed.slice(0, index).trim();
      let val = trimmed.slice(index + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      process.env[key] = val;
    });
  }
} catch (e) {
  console.warn('Failed to parse .env file manually', e);
}

const apiKey = process.env.OPENAI_API_KEY;
const baseURL = process.env.OPENAI_BASE_URL;

console.log('🔑 API Key Loaded:', apiKey ? `${apiKey.slice(0, 10)}...` : 'None');
console.log('🌐 Base URL Loaded:', baseURL || 'Default (api.openai.com)');

// route.ts의 buildSystemPrompt 단순 모사 버전
function buildSystemPromptMock() {
  const brand = {
    name: 'PYEARCHIVE (파이아카이브)',
    industry: '가방 및 패션 잡화',
    targetAudience: '2030 미니멀 라이프스타일을 추구하는 트렌디한 남녀',
    toneOfVoice: '차분하고 정제되며 신뢰감 있는 에디토리얼 어조',
    brandDna: '불필요한 디테일을 배제하고 일상의 무질서 속에 질서와 균형을 채우는 가방 디자인'
  };

  return `당신은 한국 SNS 카드뉴스 전문 크리에이티브 디렉터이자 브랜드 콘텐츠 전략가입니다.
사용자가 상품명, 캠페인 주제, 또는 상품 URL을 입력하면, 브랜드 프로필과 감성 선호도를 깊이 분석하여 카드뉴스 전략 기획서와 각 슬라이드별 실제 카피 초안(Headline/Body)을 제안해 주어야 합니다.

## 브랜드 정보
브랜드명: ${brand.name}
업종: ${brand.industry}
타겟 고객: ${brand.targetAudience}
톤앤매너: ${brand.toneOfVoice}

## 브랜드 DNA
${brand.brandDna}

## 대화 규칙 및 역할
- **인간 크리에이티브 디렉터의 목소리**: 전문 에이전시의 든든한 파트너로서 예의를 갖추되 정답을 주도적으로 제시하는 전문가 톤을 취하십시오.
- **마크다운 서식 절대 사용 금지**: 별표("**" 또는 "*"), 샵("#")을 이용한 타이틀 구성 등 마크다운 스타일은 사용자가 읽기에 불필요한 AI 기계음 느낌을 줍니다. **어떠한 강조 기호도 사용하지 말고**, 오직 일반 텍텍스트, 평이한 문장, 그리고 자연스러운 단락 구분(줄바꿈)만을 활용하십시오. 필요 시 대시("-") 또는 일반 번호를 사용한 목록 형태로만 깔끔하게 나열하십시오.
- 사용자가 상품이나 주제를 말하면, 단순히 레이아웃 추천뿐만 아니라 **실제 각 슬라이드에 들어갈 카피 초안(headline, body)과 그렇게 작성한 의도(reasoning)**를 "draftSlides" 배열에 담아 함께 돌려주십시오.
- 대화 과정에서 사용자가 카피에 대한 피드백(예: '2장 본문 내용을 더 간결하게 수정해줘', '톤을 더 밝게 해줘')을 준다면, 사용자의 의도를 반영하여 해당 슬라이드들의 "headline"과 "body"를 수정하고, 변경 기획 사유를 "reasoning"에 한글로 1문장 작성하여 "draftSlides"를 실시간 갱신해 반환하세요.
- 단, 사용자의 입력에 상품·캠페인·고객 문제·핵심 관점이 거의 없어 실제 카드뉴스 품질이 낮아질 경우에는 무리하게 생성하지 말고 ready를 false로 두고 clarification을 반환하세요. 단, 이 때도 지금까지 정해진 정보나 임시 기획에 근거한 "params"와 "draftSlides"는 함께 채워서 내려주어야 유저가 중간 흐름을 파악할 수 있습니다.

## 응답 형식 (반드시 JSON)
추천안이 제안되고 생성할 준비가 끝났을 때 (ready: true):
{
  "message": "코멘트",
  "ready": true,
  "params": {
    "topic": "주제",
    "visualHint": "dark-editorial",
    "contentType": "저장형 카드뉴스",
    "objective": "목표",
    "slideCount": 5,
    "draftSlides": [
      {
        "slideNumber": 1,
        "role": "Hook",
        "headline": "제목",
        "body": "본문",
        "reasoning": "기획 의도"
      }
    ]
  }
}`;
}

async function testOpenAIRaw() {
  if (!apiKey) {
    console.error('❌ 테스트를 하려면 실제 OPENAI_API_KEY가 필요합니다.');
    return;
  }

  const openai = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {})
  });

  const prompt = buildSystemPromptMock();
  const messages: any[] = [
    { role: 'user', content: '오늘의 이슈를 카드뉴스로 만들어줘' }
  ];

  console.log('\n💬 Sending messages...');
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 4o-mini로 시도해보고, 만약 baseURL 설정이 있다면 baseURL의 디폴트 모델이 기동됨
      messages: [
        { role: 'system', content: prompt },
        ...messages
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1200
    });

    console.log('\n📥 Response Received:');
    console.log('--------------------------------------------------');
    console.log('Status: Success');
    console.log('Choice object:', JSON.stringify(response.choices[0], null, 2));
    console.log('--------------------------------------------------');
  } catch (error) {
    console.error('\n❌ OpenAI API Call Failed:');
    console.error(error);
  }
}

testOpenAIRaw().catch(console.error);
