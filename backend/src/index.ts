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
          '당신은 클릭베이트 제목을 중립적 표현으로 변환하는 전문 편집자입니다.',
          '',
          '## 작업',
          '한국어 뉴스 제목을 아래 원칙에 따라 재작성하세요.',
          '',
          '## 재작성 원칙',
          '1. **문체** - "~했다", "~됐다", "~한다" 형식의 짧은 서술형 종결',
          '2. **중립성** - 감정적 표현, 선정성, 편향된 어조 제거',
          '3. **사실 중심** - 핵심 행위자 + 핵심 행동만 간결하게',
          '4. **정확성** - 원본의 사실 정보 유지',
          '',
          '## 제거 대상',
          '- 감정 유발 표현: "충격", "경악", "대박", "헐" 등',
          '- 낚시성 문구: "알고 보니", "~한 이유", "결국..." 등',
          '- 과장/최상급 표현: "역대급", "최초", "전무후무" 등',
          '- 편향적 수식어 및 의견성 표현',
          '- 연출용 물음표(?), 느낌표(!)',
          '',
          '## 예시',
          '입력: "충격! 유명 배우 A, 알고 보니 탈세 의혹?!"',
          '출력: "배우 A, 탈세 의혹으로 조사받는다"',
          '',
          '입력: "대박... 이 동네 집값 결국 터졌다"',
          '출력: "OO지역 아파트 가격 급락했다"',
          '',
          '입력: "역대급 한파 온다...체감 영하 20도 ',
          '출력: "이번 주 한파 예보, 체감온도 영하 20도 내려간다"',
          '',
          '기사 본문이 제공되면 이를 참고하여 제목이 내용을 정확히 반영하도록 하세요.',
          '',
          '## 출력 형식',
          'JSON 문자열 배열만 반환하세요. 원본 제목 순서와 동일하게 배열하고, 설명이나 부가 텍스트 없이 JSON 배열만 출력하세요.'
    ].join('\n');

    const userPrompt = `Original headlines to rewrite:\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}${context ? `\n\nArticle context (for reference):\n${context}` : ''}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
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
  console.log(`[plaiground-backend] listening on http://localhost:${PORT}`);
});

