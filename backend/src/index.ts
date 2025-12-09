import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import { z } from 'zod';

const app = express();

const PORT = Number(process.env.PORT || 4000);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  console.warn('[warn] OPENAI_API_KEY is not set. Requests will fail until provided.');
}

const openai = new OpenAI({ apiKey: openaiApiKey });

app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  })
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const rewriteRequestSchema = z.object({
  titles: z.array(z.string().min(4)).min(1).max(20),
  context: z.string().max(2000).optional()
});

app.post('/api/rewrite', async (req, res) => {
  const parsed = rewriteRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  if (!openaiApiKey) {
    return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' });
  }

  const { titles, context } = parsed.data;
  try {
    const systemPrompt = [
      '당신은 한국 뉴스 제목을 중립적이고 사실 중심으로 재작성하는 전문 편집자입니다.',
      '',
      '## ⚠️ 중요: 반드시 원본과 다르게 재작성하세요',
      '- 원본 제목을 그대로 반환하지 마세요',
      '- 클릭베이트 요소를 적극적으로 제거하고 문체를 변경하세요',
      '- 원본과 동일하거나 거의 비슷하면 안 됩니다',
      '',
      '## 작업 목표',
      '클릭베이트 요소를 완전히 제거하고, 모든 사실 정보는 정확히 보존하되, 문체와 표현을 명확히 변경하세요.',
      '',
      '## 반드시 보존할 정보',
      '- 주체(인물, 기업, 기관명): "삼성", "이재명", "쿠팡" 등',
      '- 수치: 금액("1.1조", "152억"), 퍼센트("30%", "12%↑"), 날짜("12월 10일")',
      '- 지역: "부산", "강남", "서울" 등',
      '- 비교 기준: "전년 대비", "전월 대비", "작년 대비" 등',
      '- 핵심 사건/행동: "구속", "기소", "인하", "상승" 등',
      '',
      '## 반드시 제거하고 변경할 요소',
      '- 감정 유발 표현: "충격", "대박", "헐", "경악", "충격적" → 완전 제거',
      '- 낚시성 문구: "알고 보니", "결국", "드디어", "마침내", "~한 이유", "~했다" → 제거',
      '- 과장/최상급 표현: "역대급", "최초", "전무후무", "사상 최대", "폭락", "급등" → 중립적 표현으로 변경',
      '- 편향적 수식어: "극악하다", "참담하다", "찬란하다", "마냥 반기다" → 제거',
      '- 연출용 부호: 물음표(?), 느낌표(!), 말줄임표(...) → 모두 제거',
      '- 반복 강조: "또", "또다시", "계속해서" → 제거 (중요한 맥락이 아닌 경우)',
      '- [단독], [속보], [영상] 등 태그 → 모두 제거',
      '- 비유적 표현: "품다", "터지다" 등 → 사실적 표현으로 변경',
      '',
      '## 문체 규칙 (반드시 적용)',
      '- 서술형 종결: "~했다", "~됐다", "~한다" 형식으로 통일',
      '- 중립적 어조: 감정이나 의견 없이 사실만 전달',
      '- 간결성: 불필요한 수식어 제거, 핵심만 전달',
      '- 자연스러운 한국어: 어색한 번역체 지양',
      '- 문장 구조 변경: 원본과 다른 문장 구조로 재작성',
      '',
      '## 재작성 예시 (원본과 명확히 다르게)',
      '입력: "충격! 삼성 3분기 영업이익 9조...전년比 12%↑"',
      '출력: "삼성, 3분기 영업이익 9조원 기록…전년 대비 12% 증가"',
      '',
      '입력: "[단독] 대박 강남 아파트 30% 폭락...역대급 하락세"',
      '출력: "강남 아파트값 30% 하락"',
      '',
      '입력: "1.1조에 이지스 품은 힐하우스, 핵심 설계자는 \'조 개그넌\'"',
      '출력: "힐하우스, 1.1조원에 이지스 인수…핵심 설계자는 조 개그넌"',
      '',
      '입력: "부산살이 시작한 해수부… 마냥 반기는 수정동 사람들 [해수부 부산 시대]"',
      '출력: "해수부 부산 이전 시작…수정동 주민 환영"',
      '',
      '입력: "[영상] "美 금리인하 후 산타 랠리로 S&P500 7000 육박할 듯"',
      '출력: "미국 금리인하 후 S&P500 지수가 7000에 근접할 전망"',
      '',
      '입력: "[오늘의 급등주] 이수스페셜티케미컬, 이차전지 반등 전망에 강세"',
      '출력: "이수스페셜티케미컬, 이차전지 반등 전망으로 주가 상승"',
      '',
      '## 출력 형식',
      'JSON 문자열 배열만 반환하세요. 원본 제목 순서와 동일하게 배열하고, 설명이나 부가 텍스트 없이 JSON 배열만 출력하세요.',
      '각 제목은 원본과 명확히 다르게 재작성되어야 합니다. 원본과 동일하거나 거의 비슷하면 안 됩니다.',
      '본문이 제공되면 이를 참고하여 제목이 내용을 정확히 반영하도록 하세요.'
    ].join('\n');

    const userPrompt = `Original headlines to rewrite:\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}${context ? `\n\nArticle context (for reference):\n${context}` : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7, // 더 다양한 재작성을 위해 temperature 증가
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: userPrompt
        }
      ]
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      return res.status(502).json({ error: 'Empty response from OpenAI' });
    }

    let parsedResponse: string[] = [];
    try {
      parsedResponse = JSON.parse(content);
    } catch {
      // If model added prose, attempt to extract JSON
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        parsedResponse = JSON.parse(match[0]);
      } else {
        throw new Error('Unable to parse model response');
      }
    }

    if (!Array.isArray(parsedResponse)) {
      return res.status(502).json({ error: 'Unexpected model response shape', raw: content });
    }

    return res.json({ rewritten: parsedResponse });
  } catch (error: any) {
    console.error('rewrite error', error?.message || error);
    return res.status(502).json({ error: 'Failed to rewrite titles', details: error?.message });
  }
});

app.listen(PORT, () => {
  console.log(`[newtox-backend] listening on http://localhost:${PORT}`);
});

