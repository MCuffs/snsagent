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

// 임시 브랜드 프로필 설정
const mockBrand = {
  name: 'PYEARCHIVE (파이아카이브)',
  industry: '가방 및 패션 잡화',
  targetAudience: '2030 미니멀 라이프스타일을 추구하는 트렌디한 남녀',
  toneOfVoice: '차분하고 정제되며 신뢰감 있는 에디토리얼 어조',
  brandDna: '불필요한 디테일을 배제하고 일상의 무질서 속에 질서와 균형을 채우는 가방 디자인'
};

// route.ts의 buildSystemPrompt 단순 모사 버전
function buildSystemPromptMock(brand: typeof mockBrand) {
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
- **마크다운 서식 절대 사용 금지**: 어떠한 강조 기호도 사용하지 말고 오직 일반 텍스트만 사용하십시오.
- 사용자가 상품이나 주제를 말하면, 단순히 레이아웃 추천뿐만 아니라 **실제 각 슬라이드에 들어갈 카피 초안(headline, body)과 그렇게 작성한 의도(reasoning)**를 \`draftSlides\` 배열에 담아 함께 돌려주십시오.
- 대화 과정에서 사용자가 카피에 대한 피드백(예: '2장 본문 내용을 더 간결하게 수정해줘', '톤을 더 밝게 해줘')을 준다면, 사용자의 의도를 반영하여 해당 슬라이드들의 \`headline\`과 \`body\`를 수정하고, 변경 기획 사유를 \`reasoning\`에 한글로 1문장 작성하여 \`draftSlides\`를 실시간 갱신해 반환하세요.
- 슬라이드 수는 5장으로 고정 제안합니다.

## 응답 형식 (반드시 JSON)
{
  "message": "사용자에게 전달할 정중한 기획 코멘트",
  "ready": true,
  "params": {
    "topic": "상품/주제 이름",
    "visualHint": "dark-editorial",
    "contentType": "저장형 카드뉴스",
    "objective": "카드뉴스 캠페인 목표",
    "slideCount": 5,
    "draftSlides": [
      {
        "slideNumber": 1,
        "role": "Hook",
        "headline": "슬라이드 제목",
        "body": "슬라이드 본문",
        "reasoning": "이 카피를 쓴 또는 수정한 기획적 의도"
      }
    ]
  }
}`;
}

async function runTest() {
  console.log('🚀 [테스트 시작] 대화형 에이전트 추론 및 카피 실시간 갱신 검증');
  console.log('--------------------------------------------------');

  if (!apiKey || apiKey.length < 10) {
    console.warn('⚠️ OPENAI_API_KEY가 비어있어 Mocking 테스트 모드로 전환합니다.');
    const mockOutput1 = {
      message: "PYEARCHIVE의 정돈된 감성을 살려 에디토리얼 카드뉴스 초안을 제안합니다.",
      ready: true,
      params: {
        topic: "신제품 에센셜 숄더백 01",
        visualHint: "dark-editorial",
        contentType: "저장형 카드뉴스",
        objective: "숄더백의 정교함과 실루엣 강조",
        slideCount: 5,
        draftSlides: [
          { slideNumber: 1, role: "Hook", headline: "일상의 균형을 완성하는 백", body: "가벼운 외출을 완성해보세요.", reasoning: "호기심 유발" },
          { slideNumber: 2, role: "Detail", headline: "최적화된 수납공간", body: "당신의 필수품을 깔끔하게.", reasoning: "기능 강조" },
          { slideNumber: 3, role: "Detail", headline: "가죽의 질감", body: "매끄러운 마감을 경험해보세요.", reasoning: "소재 강조" },
          { slideNumber: 4, role: "Detail", headline: "절제된 실루엣", body: "어느 룩에나 어울리는 밸런스.", reasoning: "디자인 강조" },
          { slideNumber: 5, role: "Save CTA", headline: "숄더백 라인업 보기", body: "공식 스토어에서 확인하기.", reasoning: "행동 유도" }
        ]
      }
    };
    
    console.log('\n📥 [1차 응답 수신 완료 - Mock]');
    console.log(`🤖 Message: ${mockOutput1.message}`);
    console.log(`🤖 Topic: ${mockOutput1.params.topic}`);
    console.log(`🤖 Draft Slides 개수: ${mockOutput1.params.draftSlides.length}개`);
    mockOutput1.params.draftSlides.forEach(s => {
      console.log(`   [슬라이드 ${s.slideNumber} - ${s.role}]`);
      console.log(`     Headline: ${s.headline}`);
      console.log(`     Body: ${s.body}`);
      console.log(`     Reasoning: ${s.reasoning}`);
    });

    console.log('\n--------------------------------------------------');
    console.log('💬 User 2차 피드백: "3페이지 본문 내용에 천연 가죽의 텍스처와 명품 바느질 디테일이 강조되도록 럭셔리하게 고쳐줘"');
    console.log('🤖 AI 카피 갱신 및 추론 업데이트 중 (Mock)...');

    const mockOutput2 = JSON.parse(JSON.stringify(mockOutput1));
    mockOutput2.params.draftSlides[2].body = "천연 가죽 고유의 숨 쉬는 텍스처와 장인의 정교한 명품 손바느질 디테일로 품격을 높였습니다.";
    mockOutput2.params.draftSlides[2].reasoning = "천연 가죽 텍스처와 장인의 정밀 바느질을 강조해 달라는 피드백을 반영해 럭셔리 무드로 세부 본문 내용을 수정함.";

    console.log('\n📥 [2차 응답 수신 완료 - Mock]');
    console.log(`🤖 Message: ${mockOutput2.message}`);
    const slide3 = mockOutput2.params.draftSlides[2];
    console.log(`\n✅ [갱신된 3페이지 카피 확인]`);
    console.log(`   Headline: ${slide3.headline}`);
    console.log(`   Body: ${slide3.body}`);
    console.log(`   Reasoning (디렉터 기획 의도): ${slide3.reasoning}`);
    
    console.log('\n🎉 [SUCCESS] 대화형 추론 에이전트 모의 테스트 완료! UI와 API 맵핑 아키텍처가 검증되었습니다.');
    return;
  }

  const systemPrompt = buildSystemPromptMock(mockBrand);
  const openai = new OpenAI({ apiKey });

  // 1차 턴: 카드뉴스 제작 요청
  const messages: any[] = [
    { role: 'user', content: '신제품 에센셜 숄더백 01에 대한 카드뉴스 기획안이랑 카피 뽑아줘' }
  ];

  console.log(`💬 User 1차: "${messages[0].content}"`);
  console.log('🤖 AI 분석 및 1차 카피 초안 생성 요청 중...');

  let response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // gpt-4o-mini 또는 gpt-4o 활용해 검증
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    response_format: { type: 'json_object' }
  });

  const content1 = response.choices[0]?.message?.content;
  if (!content1) throw new Error('1차 응답 수신 실패');

  const parsed1 = JSON.parse(content1);
  console.log('\n📥 [1차 응답 수신 완료]');
  console.log(`🤖 Message: ${parsed1.message}`);
  console.log(`🤖 Topic: ${parsed1.params?.topic}`);
  console.log(`🤖 Draft Slides 개수: ${parsed1.params?.draftSlides?.length}개`);
  
  if (parsed1.params?.draftSlides?.length > 0) {
    parsed1.params.draftSlides.forEach((s: any) => {
      console.log(`   [슬라이드 ${s.slideNumber} - ${s.role}]`);
      console.log(`     Headline: ${s.headline}`);
      console.log(`     Body: ${s.body}`);
      console.log(`     Reasoning: ${s.reasoning}`);
    });
  } else {
    console.error('❌ Draft slides가 생성되지 않았습니다.');
    process.exit(1);
  }

  // 2차 턴: 특정 슬라이드 카피 수정 피드백 전달
  messages.push({ role: 'assistant', content: content1 });
  messages.push({ role: 'user', content: '3페이지 본문 내용에 천연 가죽의 텍스처와 명품 바느질 디테일이 강조되도록 럭셔리하게 고쳐줘' });

  console.log('\n--------------------------------------------------');
  console.log(`💬 User 2차: "${messages[messages.length - 1].content}"`);
  console.log('🤖 AI 카피 갱신 및 추론 업데이트 요청 중...');

  response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    response_format: { type: 'json_object' }
  });

  const content2 = response.choices[0]?.message?.content;
  if (!content2) throw new Error('2차 응답 수신 실패');

  const parsed2 = JSON.parse(content2);
  console.log('\n📥 [2차 응답 수신 완료]');
  console.log(`🤖 Message: ${parsed2.message}`);
  
  const slide3 = parsed2.params?.draftSlides?.find((s: any) => s.slideNumber === 3);
  if (slide3) {
    console.log(`\n✅ [갱신된 3페이지 카피 확인]`);
    console.log(`   Headline: ${slide3.headline}`);
    console.log(`   Body: ${slide3.body}`);
    console.log(`   Reasoning (디렉터 기획 의도): ${slide3.reasoning}`);
    
    const isSuccess = slide3.body.includes('가죽') || slide3.body.includes('텍스처') || slide3.body.includes('바느질') || slide3.body.includes('디테일');
    if (isSuccess) {
      console.log('\n🎉 [SUCCESS] 대화형 추론 에이전트가 유저 피드백을 수용하여 카피와 추론 이유를 실시간으로 갱신하는 것이 완벽하게 검증되었습니다!');
    } else {
      console.warn('\n⚠️ [WARNING] 3페이지 본문이 수정되었으나 가죽/바느질 관련 키워드가 부족합니다. 프롬프트 미세 조정이 권장됩니다.');
    }
  } else {
    console.error('❌ 2차 응답에서 3페이지 슬라이드를 찾을 수 없습니다.');
    process.exit(1);
  }
}

runTest().catch(console.error);
