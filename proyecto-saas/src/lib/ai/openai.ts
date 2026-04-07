export interface ScriptRequest {
  platform: string;
  format: string;
  promptText: string;
  tone: string;
  language: string;
  useHashtags: boolean;
  useEmojis: boolean;
  brandContext?: string;
}

export interface ScriptResult {
  caption: string;
  hashtags: string[];
  imagePrompt: string;   // single image prompt (kept for backward compat)
  videoPrompt: string;
  scenePrompts: string[]; // 3 scene prompts for the visual story
}

const FORMAT_NAMES: Record<string, string> = {
  image: "imagen estática",
  carousel: "carrusel de imágenes",
  reel: "Reel (video corto vertical)",
  story: "Story (imagen vertical temporal)",
  short: "YouTube Short (video corto vertical)",
  long_video: "video largo",
  text: "publicación de texto",
};

const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

export class OpenAIClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateScript(req: ScriptRequest): Promise<ScriptResult> {
    const langLabel =
      req.language === "es" ? "español" :
      req.language === "en" ? "inglés" :
      req.language === "pt" ? "portugués" : req.language;

    const platformName = PLATFORM_NAMES[req.platform] ?? req.platform;
    const formatName = FORMAT_NAMES[req.format] ?? req.format;
    const isVideo = ["reel", "short", "long_video"].includes(req.format);

    const systemPrompt = `Eres un experto en marketing de contenidos para redes sociales con más de 10 años de experiencia.
Tu tarea es crear contenido de alta calidad para ${platformName} en ${langLabel} con tono ${req.tone}.
El formato del contenido es: ${formatName}.
${req.brandContext ? `\nContexto de la marca:\n${req.brandContext}` : ""}

Devuelve ÚNICAMENTE un objeto JSON válido con exactamente estas 5 claves, sin texto adicional:

{
  "caption": "El caption completo para el post. ${req.useEmojis ? "Incluye emojis relevantes de forma natural." : "Sin emojis."} ${req.useHashtags ? "Integra 3-5 hashtags dentro del texto de forma natural." : "Sin hashtags."} Optimizado para máximo engagement en ${platformName}. Longitud apropiada para el formato.",
  "hashtags": ${req.useHashtags ? `["array", "de", "10-20", "hashtags", "relevantes", "sin", "símbolo", "numeral"]` : "[]"},
  "imagePrompt": "Descripción en inglés, ultra detallada, para generación de imagen con IA. Incluye: estilo visual (fotográfico/ilustración/3D), paleta de colores, composición, iluminación, ambiente, elementos principales. Sin texto en la imagen. Máximo impacto visual para ${platformName}.",
  "videoPrompt": "${isVideo ? `Descripción en inglés para generación de video con IA. Incluye: tipo de plano, movimiento de cámara (lento, dinámico, drone, etc.), transiciones, velocidad, ambiente visual, color grading. Corto y cinematográfico. Aspectratio ${req.format === "long_video" ? "16:9 horizontal" : "9:16 vertical"}.` : "Igual que imagePrompt pero con indicación de movimiento sutil."}",
  "scenePrompts": ["Escena 1 en inglés: el inicio de la historia visual. Descripción ultra detallada para generación de imagen IA, estilo fotográfico profesional, iluminación cinematográfica. Sin texto.", "Escena 2 en inglés: el desarrollo o punto climático de la historia. Mismo estilo visual consistente con escena 1. Sin texto.", "Escena 3 en inglés: el desenlace o llamada a la acción visual. Mismo estilo visual consistente. Sin texto."]
}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Idea de contenido: ${req.promptText}`,
          },
        ],
        temperature: 0.75,
        max_tokens: 1800,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        `OpenAI error (${res.status}): ${(err as { error?: { message?: string } }).error?.message ?? res.statusText}`
      );
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("OpenAI returned empty response");

    const parsed = JSON.parse(content) as Partial<ScriptResult>;
    const imagePrompt = parsed.imagePrompt ?? req.promptText;
    const scenePrompts = Array.isArray(parsed.scenePrompts) && parsed.scenePrompts.length >= 3
      ? parsed.scenePrompts.slice(0, 3)
      : [imagePrompt, imagePrompt, imagePrompt];
    return {
      caption: parsed.caption ?? "",
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
      imagePrompt,
      videoPrompt: parsed.videoPrompt ?? imagePrompt,
      scenePrompts,
    };
  }
}
