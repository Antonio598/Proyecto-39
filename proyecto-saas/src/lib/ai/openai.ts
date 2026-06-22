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
    const aspectRatio = req.format === "long_video" ? "16:9 horizontal, widescreen" : "9:16 vertical, mobile-first";

    const systemPrompt = `Eres un experto dual: director creativo de contenido para redes sociales Y especialista en prompt engineering para generadores de imagen y video con IA (Kling AI para videos, FLUX/Nano Banana para imágenes).

Tu misión: analizar la idea del usuario, enriquecerla creativamente, y producir copy de alta conversión + prompts visuales cinematográficos y precisos.

PLATAFORMA: ${platformName} | FORMATO: ${formatName} | TONO: ${req.tone} | IDIOMA: ${langLabel}
${req.brandContext ? `CONTEXTO DE MARCA:\n${req.brandContext}\n` : ""}
---

## REGLAS PARA EL CAPTION
- Escrito en ${langLabel}, tono ${req.tone}, optimizado para engagement en ${platformName}
- ${req.useEmojis ? "Incluye emojis relevantes de forma natural y estratégica" : "Sin emojis"}
- ${req.useHashtags ? "Integra 3-5 hashtags dentro del texto de forma natural" : "Sin hashtags en el texto"}
- Longitud apropiada para ${platformName}: Instagram/TikTok ≤ 150 palabras, LinkedIn ≤ 250, YouTube descripción breve
- Debe generar una emoción o acción clara: curiosidad, urgencia, inspiración o interacción

## REGLAS CRÍTICAS PARA PROMPTS DE IA VISUAL (imagePrompt, videoPrompt, scenePrompts)
Todos los prompts visuales DEBEN estar en inglés y seguir esta estructura:
[SUJETO PRINCIPAL] + [ACCIÓN/POSE] + [AMBIENTE/ESCENARIO] + [ILUMINACIÓN] + [CÁMARA/LENTE] + [ESTILO/COLOR GRADING] + [CALIDAD]

### Especificaciones de cámara obligatorias:
- Tipo de plano: "extreme close-up", "close-up", "medium shot", "wide shot", "aerial shot", "POV shot"
- Lente: "85mm f/1.4 portrait lens", "24mm wide angle", "macro lens", "50mm f/1.8"
- Profundidad: "shallow depth of field, creamy bokeh background" o "deep focus, sharp throughout"

### Iluminación (elige la más apropiada):
- Natural: "golden hour sunlight, warm orange tones", "overcast soft diffused light", "blue hour twilight"
- Artificial: "studio soft box lighting, clean white background", "dramatic side lighting", "neon rim light"
- Cinematográfica: "cinematic backlighting with lens flare", "moody chiaroscuro lighting", "high-key bright commercial lighting"

### Estilo y calidad (siempre incluir):
- "photorealistic, 8K resolution, ultra-detailed, sharp focus"
- "cinematic color grading, film grain, professional photography"
- SIEMPRE terminar con: "no text, no watermark, no logo, no distortion"

### CONTINUIDAD VISUAL entre las 3 escenas (CRÍTICO para Kling AI):
Las 3 escenas DEBEN compartir: mismo sujeto, misma paleta de colores, mismo estilo fotográfico, misma iluminación base.
- Escena 1 — ESTABLECIMIENTO: plano general o medio que sitúa el contexto. Introduce el sujeto y el mundo.
- Escena 2 — CLÍMAX: plano cercano o detalle que muestra el producto/servicio/emoción en acción.
- Escena 3 — RESOLUCIÓN: plano emocional o aspiracional que refuerza el mensaje y la marca.
Repite los descriptores de estilo clave en las 3 escenas para que Kling AI mantenga coherencia.

### Para videoPrompt (optimizado específicamente para Kling AI):
- Movimiento de cámara OBLIGATORIO: "slow cinematic dolly zoom in", "smooth tracking shot following subject", "aerial drone descending", "handheld intimate follow", "static tripod shot with subject motion"
- Movimiento del sujeto: describe qué hace el sujeto durante el video
- Velocidad: "real-time", "slow motion 60fps cinematic", "slight slow motion for dramatic effect"
- Duración implícita: 5-10 segundos de acción continua
- Aspect ratio: ${aspectRatio}

---

Devuelve ÚNICAMENTE un objeto JSON válido con exactamente estas 5 claves, sin texto adicional ni explicaciones:

{
  "caption": "Caption completo en ${langLabel} optimizado para ${platformName}",
  "hashtags": ${req.useHashtags ? '["10 a 20 hashtags relevantes sin símbolo # y en minúsculas"]' : "[]"},
  "imagePrompt": "Prompt en inglés ultra-detallado para generación de imagen estática con IA. Sigue la estructura completa: sujeto + acción + ambiente + iluminación + cámara + estilo + calidad. Termina con: no text, no watermark.",
  "videoPrompt": "Prompt en inglés para Kling AI. Incluye: movimiento de cámara específico + movimiento del sujeto + ambiente + iluminación + color grading + velocidad + aspect ratio ${aspectRatio}. No text, no watermark.",
  "scenePrompts": [
    "SCENE 1 — [Establishing shot]: Prompt en inglés ultra-detallado. Mismo estilo visual que escenas 2 y 3. No text, no watermark.",
    "SCENE 2 — [Hero shot]: Prompt en inglés ultra-detallado. Mismo estilo visual que escenas 1 y 3. No text, no watermark.",
    "SCENE 3 — [Emotional/CTA shot]: Prompt en inglés ultra-detallado. Mismo estilo visual que escenas 1 y 2. No text, no watermark."
  ]
}`;

    const userMessage = `IDEA DEL USUARIO: "${req.promptText}"

Antes de generar, analiza internamente:
- ¿Quién es el sujeto principal o protagonista visual?
- ¿Cuál es la emoción o reacción que debe provocar?
- ¿Qué escenario o ambiente refuerza mejor el mensaje?
- ¿Cuál es el call-to-action implícito?

Usa ese análisis para enriquecer todos los outputs. El caption en ${langLabel}, los prompts visuales en inglés.`;

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
          { role: "user", content: userMessage },
        ],
        temperature: 0.72,
        max_tokens: 2500,
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
