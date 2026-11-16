/**
 * SoufTools Audio Providers Manager
 * Real server-side integrations for ElevenLabs (TTS / STT) & AssemblyAI (STT).
 */

import { decryptKey } from "@/lib/encryption";
import { loadServerAdminConfig } from "@/lib/adminConfigStore";

export const ASSEMBLYAI_MODELS = [
  "universal",
  "slam-1",
  "nano",
  "conformer-2",
];

export const ELEVENLABS_DEFAULT_MODELS = [
  "eleven_multilingual_v2",
  "eleven_turbo_v2_5",
  "eleven_flash_v2_5",
  "scribe_v1",
];

function extractConfiguredKeys(
  rawList: unknown,
  envFallbacks: Array<string | undefined>
): string[] {
  const keys: string[] = [];
  if (Array.isArray(rawList)) {
    for (const item of rawList) {
      const raw = typeof item === "string" ? item : (item as any)?.key || (item as any)?.apiToken || "";
      const dec = decryptKey(raw) || raw;
      if (dec && dec.trim().length >= 8 && !keys.includes(dec.trim())) {
        keys.push(dec.trim());
      }
    }
  }
  for (const envKey of envFallbacks) {
    if (envKey && envKey.trim().length >= 8 && !keys.includes(envKey.trim())) {
      keys.push(envKey.trim());
    }
  }
  return keys;
}

export async function getAudioProviderKeys(providerId: "elevenlabs" | "assemblyai"): Promise<string[]> {
  let configKeys: unknown = [];
  try {
    const config = await loadServerAdminConfig();
    configKeys = (config?.keys as any)?.[providerId] || [];
    if ((!Array.isArray(configKeys) || configKeys.length === 0) && config?.modelProviders) {
      const gathered: string[] = [];
      const providersMap = config.modelProviders as Record<string, unknown>;
      for (const tier of Object.values(providersMap)) {
        if (!Array.isArray(tier)) continue;
        for (const p of tier) {
          if ((p as any)?.providerId === providerId && Array.isArray((p as any).keys)) {
            for (const k of (p as any).keys) {
              const raw = typeof k === "string" ? k : (k as any)?.key || "";
              if (raw) gathered.push(raw);
            }
          }
        }
      }
      configKeys = gathered;
    }
  } catch {
    configKeys = [];
  }

  const envVar =
    providerId === "elevenlabs"
      ? [process.env.ELEVENLABS_API_KEY, process.env.ELEVENLABS_API_KEYS]
      : [process.env.ASSEMBLYAI_API_KEY, process.env.ASSEMBLYAI_API_KEYS];

  return extractConfiguredKeys(configKeys, envVar);
}

export async function testElevenLabsKey(
  apiKey: string,
  signal?: AbortSignal
): Promise<{ valid: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user", {
      method: "GET",
      headers: { "xi-api-key": apiKey },
      signal,
    });
    const latencyMs = Date.now() - start;
    if (res.ok) return { valid: true, latencyMs };
    const err = await res.json().catch(() => ({}));
    return {
      valid: false,
      latencyMs,
      error: `فشل التحقق من ElevenLabs: ${err?.detail?.message || `HTTP ${res.status}`}`,
    };
  } catch (err: any) {
    return {
      valid: false,
      latencyMs: Date.now() - start,
      error: err?.message || "فشل الاتصال بـ ElevenLabs",
    };
  }
}

export async function fetchElevenLabsModels(
  apiKey: string,
  signal?: AbortSignal
): Promise<{ success: boolean; models: string[]; error?: string }> {
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/models", {
      method: "GET",
      headers: { "xi-api-key": apiKey },
      signal,
    });
    if (!res.ok) {
      return { success: false, models: [], error: `فشل جلب نماذج ElevenLabs: HTTP ${res.status}` };
    }
    const data = await res.json();
    const list = Array.isArray(data)
      ? data.map((m: any) => m?.model_id || m?.name).filter(Boolean)
      : [];
    const models = Array.from(new Set([...list, "scribe_v1"]));
    return { success: models.length > 0, models };
  } catch (err: any) {
    return { success: false, models: [], error: err?.message || "تعذر الاتصال بـ ElevenLabs" };
  }
}

export async function testAssemblyAIKey(
  apiKey: string,
  signal?: AbortSignal
): Promise<{ valid: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.assemblyai.com/v2/transcript?limit=1", {
      method: "GET",
      headers: { Authorization: apiKey },
      signal,
    });
    const latencyMs = Date.now() - start;
    if (res.ok) return { valid: true, latencyMs };
    const err = await res.json().catch(() => ({}));
    return {
      valid: false,
      latencyMs,
      error: `فشل التحقق من AssemblyAI: ${err?.error || `HTTP ${res.status}`}`,
    };
  } catch (err: any) {
    return {
      valid: false,
      latencyMs: Date.now() - start,
      error: err?.message || "فشل الاتصال بـ AssemblyAI",
    };
  }
}

export async function fetchAssemblyAIModels(
  apiKey: string,
  signal?: AbortSignal
): Promise<{ success: boolean; models: string[]; error?: string }> {
  const check = await testAssemblyAIKey(apiKey, signal);
  if (!check.valid) {
    return { success: false, models: [], error: check.error };
  }
  return { success: true, models: [...ASSEMBLYAI_MODELS] };
}

export async function textToSpeechViaElevenLabs(options: {
  text: string;
  apiKey: string;
  voiceId?: string;
  modelId?: string;
  signal?: AbortSignal;
}): Promise<{ audioBase64: string; mimeType: string }> {
  const voiceId = options.voiceId || "21m00Tcm4TlvDq8ikWAM";
  const modelId = options.modelId || "eleven_multilingual_v2";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": options.apiKey,
      Accept: "audio/mpeg",
    },
    signal: options.signal,
    body: JSON.stringify({
      text: options.text,
      model_id: modelId,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS Error (${res.status}): ${errText.slice(0, 180)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    audioBase64: buf.toString("base64"),
    mimeType: "audio/mpeg",
  };
}

export async function transcribeViaElevenLabs(options: {
  audioBuffer: Buffer;
  mimeType: string;
  apiKey: string;
  language?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const form = new FormData();
  const ext = options.mimeType.includes("mp3")
    ? "mp3"
    : options.mimeType.includes("wav")
    ? "wav"
    : "webm";
  form.append(
    "file",
    new Blob([new Uint8Array(options.audioBuffer)], { type: options.mimeType }),
    `audio.${ext}`
  );
  form.append("model_id", "scribe_v1");
  if (options.language) {
    form.append("language_code", options.language);
  }

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": options.apiKey,
    },
    signal: options.signal,
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs STT Error (${res.status}): ${errText.slice(0, 180)}`);
  }
  const data = await res.json();
  return typeof data?.text === "string" ? data.text.trim() : "";
}

export async function transcribeViaAssemblyAI(options: {
  audioBuffer: Buffer;
  apiKey: string;
  language?: string;
  signal?: AbortSignal;
  maxPollMs?: number;
}): Promise<string> {
  // 1. Upload binary audio
  const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      Authorization: options.apiKey,
      "Content-Type": "application/octet-stream",
    },
    signal: options.signal,
    body: new Uint8Array(options.audioBuffer),
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => "");
    throw new Error(`AssemblyAI Upload Error (${uploadRes.status}): ${errText.slice(0, 180)}`);
  }

  const uploadData = await uploadRes.json();
  const audioUrl = uploadData?.upload_url;
  if (!audioUrl) {
    throw new Error("AssemblyAI Upload Error: missing upload_url");
  }

  // 2. Create transcript job
  const transcriptBody: Record<string, any> = {
    audio_url: audioUrl,
    speech_model: "universal",
  };
  if (options.language && options.language !== "auto") {
    transcriptBody.language_code = options.language;
  } else {
    transcriptBody.language_detection = true;
  }

  const createRes = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      Authorization: options.apiKey,
      "Content-Type": "application/json",
    },
    signal: options.signal,
    body: JSON.stringify(transcriptBody),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => "");
    throw new Error(`AssemblyAI Transcript Error (${createRes.status}): ${errText.slice(0, 180)}`);
  }

  const created = await createRes.json();
  const transcriptId = created?.id;
  if (!transcriptId) {
    throw new Error("AssemblyAI Transcript Error: missing transcript id");
  }

  // 3. Poll until completed/error
  const deadline = Date.now() + (options.maxPollMs ?? 45000);
  while (Date.now() < deadline) {
    if (options.signal?.aborted) {
      throw options.signal.reason || new Error("AssemblyAI transcription aborted");
    }
    await new Promise((r) => setTimeout(r, 1200));

    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${encodeURIComponent(transcriptId)}`, {
      method: "GET",
      headers: { Authorization: options.apiKey },
      signal: options.signal,
    });
    if (!pollRes.ok) {
      throw new Error(`AssemblyAI Poll Error (${pollRes.status})`);
    }
    const pollData = await pollRes.json();
    if (pollData?.status === "completed") {
      return typeof pollData.text === "string" ? pollData.text.trim() : "";
    }
    if (pollData?.status === "error") {
      throw new Error(`AssemblyAI Failed: ${pollData.error || "transcription error"}`);
    }
  }

  throw new Error("AssemblyAI transcription timed out while polling");
}
