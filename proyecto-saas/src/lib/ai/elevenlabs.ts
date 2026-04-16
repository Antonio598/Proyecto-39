const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

// Sarah — multilingual v2, natural for Spanish/English/Portuguese
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

/** Strip hashtags, emojis and extra whitespace so text reads naturally as speech */
export function captionToVoiceScript(caption: string): string {
  return caption
    .replace(/#\w+/g, "")
    // Surrogate pairs cover almost all emoji (most are in the supplementary planes)
    .replace(/[\uD800-\uDFFF]/g, "")
    // BMP symbol blocks: misc symbols, dingbats, enclosed alphanumeric supplement, etc.
    .replace(/[\u2600-\u27BF\u2B00-\u2BFF\u3000-\u303F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

/** Generate speech from text using ElevenLabs TTS — returns MP3 as Buffer */
export async function generateSpeech(params: {
  text: string;
  apiKey: string;
  voiceId?: string;
}): Promise<Buffer> {
  const voiceId = params.voiceId ?? DEFAULT_VOICE_ID;
  const res = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": params.apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: params.text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `ElevenLabs TTS error ${res.status}: ${(err as { detail?: { message?: string } }).detail?.message ?? JSON.stringify(err)}`
    );
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
