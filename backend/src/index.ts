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
      '뉴스 제목에서 클릭베이트 요소만 제거하고, 정보는 모두 보존하세요.',
      '',
      '## 보존 (필수)',
      '주체, 수치(금액/퍼센트/날짜), 지역, 비교기준(전년 대비 등)',
      '',
      '## 제거',
      '감정어(충격/대박/헐), 낚시구문(알고보니/결국), 과장(역대급), 연출부호(?!/...)',
      '',
      '## 문체',
      '"~했다/~된다" 서술형 종결, 중립적 어조',
      '',
      '## 예시',
      '"충격! 삼성 3분기 영업이익 9조...전년比 12%↑" → "삼성, 3분기 영업이익 9조원…전년 대비 12% 증가"',
      '"대박 강남 아파트 30% 폭락" → "강남 아파트값 30% 하락했다"',
      '"헐 테슬라 주가 또 올랐다" → "테슬라 주가 상승했다"',
      '',
      '본문이 있으면 참고하세요. JSON 문자열 배열만 출력하세요.'
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
  console.log(`[newtox-backend] listening on http://localhost:${PORT}`);
});

