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
      'You are a calm, impartial headline editor.',
      'Rewrite each provided news headline in Korean to be clear, factual, and non-clickbait.',
      'Preserve key facts, subjects, and neutrality. Avoid sensational words.',
      'If context is provided, use it to stay accurate.',
      'Respond with a JSON array of rewritten titles in the same order.'
    ].join(' ');

    const userPrompt = JSON.stringify({ titles, context: context || '' }, null, 2);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Rewrite these headlines (Korean). Respond ONLY with a JSON array of strings.\n${userPrompt}`
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

