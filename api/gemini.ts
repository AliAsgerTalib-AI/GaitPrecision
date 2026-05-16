import { GoogleGenAI } from '@google/genai';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let prompt: string;
  try {
    const body = await req.json() as { prompt?: unknown };
    if (typeof body.prompt !== 'string' || !body.prompt) {
      return new Response('Missing prompt', { status: 400 });
    }
    prompt = body.prompt;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response('Server misconfiguration', { status: 500 });
  }

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
  const ai = new GoogleGenAI({ apiKey });

  const geminiStream = await ai.models.generateContentStream({
    model,
    contents: prompt,
    config: { maxOutputTokens: 600 },
  });

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of geminiStream) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
