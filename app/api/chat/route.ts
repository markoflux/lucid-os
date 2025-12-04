import OpenAI from 'openai';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type ChatRequest = {
  messages: ChatMessage[];
  model?: string;
};

const textEncoder = new TextEncoder();

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'OPENAI_API_KEY is not configured on the server' },
      { status: 500 }
    );
  }

  const body = (await request.json()) as ChatRequest;

  if (!body?.messages?.length) {
    return Response.json({ error: 'messages are required' }, { status: 400 });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await client.chat.completions.create({
          model: body.model || 'gpt-4o-mini',
          messages: body.messages,
          stream: true,
        });

        for await (const part of completion) {
          const delta = part.choices[0]?.delta?.content;
          const value = Array.isArray(delta)
            ? delta.map((item) => (typeof item === 'string' ? item : item?.text ?? '')).join('')
            : delta || '';

          if (value) {
            controller.enqueue(
              textEncoder.encode(JSON.stringify({ type: 'chunk', value }) + '\n')
            );
          }
        }

        controller.enqueue(textEncoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
      } catch (error: any) {
        controller.enqueue(
          textEncoder.encode(
            JSON.stringify({
              type: 'error',
              message: error?.message ?? 'OpenAI streaming failed',
            }) + '\n'
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  });
}
