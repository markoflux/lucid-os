import OpenAI from 'openai';

type ImageRequest = {
  prompt: string;
  size?: string;
};

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'OPENAI_API_KEY is not configured on the server' },
      { status: 500 }
    );
  }

  const body = (await request.json()) as ImageRequest;

  if (!body?.prompt) {
    return Response.json({ error: 'prompt is required' }, { status: 400 });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await client.images.generate({
      model: 'gpt-image-1',
      prompt: body.prompt,
      size: body.size ?? '1024x1024',
    });
    const url = result.data?.[0]?.url;

    if (!url) {
      throw new Error('No image returned from OpenAI');
    }

    return Response.json({ url, prompt: body.prompt });
  } catch (error: any) {
    return Response.json(
      { error: error?.message ?? 'Image generation failed' },
      { status: 500 }
    );
  }
}
