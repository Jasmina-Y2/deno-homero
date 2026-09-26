// src/service/googleTts.service.ts
import {
  googleTtsClient,
  GOOGLE_OFFICIAL_VOICES,
  GOOGLE_VOICES_CATALOG,
  GOOGLE_VOICES_SHORT_MAP,
  FOLDER_GOOGLE_VOCES,
  TEXTO_MUESTRA_DEFAULT,
  extractLanguageCode,
  GoogleVoiceMetadata,
  getGoogleCredentials,
} from "../config/google.ts";
import { BUCKET_NAME, s3Client } from "../config/aws.ts";
import { PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { db } from "../config/firebase.ts";
import { mergeAudioBuffersWithFFmpeg } from "../utils/audio.utils.ts";
import { GoogleAuth } from "npm:google-auth-library";

export interface DialogueSegmentGoogle {
  personaje?: string;
  Personaje?: string;
  PERSONAJE?: string;
  character?: string;
  voice?: string;
  voz?: string;
  voiceName?: string;
  voice_name?: string;
  voiceId?: string;
  voice_id?: string;
  texto?: string;
  Texto?: string;
  TEXTO?: string;
  text?: string;
  Text?: string;
  languageCode?: string;
  idioma?: string;
  speakingRate?: number;
  pitch?: number;
  volumeGainDb?: number;
  prompt?: string;
  style?: string;
  style_instructions?: string;
  styleInstructions?: string;
  instruccion?: string;
  emocion?: string;
  emotion?: string;
}

export interface SynthesizeOptions {
  text?: string;
  prompt?: string;
  voiceName?: string;
  modelName?: string; // "gemini-2.5-pro-tts" | "gemini-2.5-flash-tts"
  languageCode?: string;
  speakingRate?: number;
  pitch?: number;
  volumeGainDb?: number;
  audioEncoding?: "MP3" | "LINEAR16" | "OGG_OPUS" | "ALAW" | "MULAW";
  sampleRateHertz?: number;
}

export interface UploadOptions extends SynthesizeOptions {
  folder?: string;
  fileName?: string;
}

let cachedAuthToken: string | null = null;
let tokenExpiresAt = 0;

async function getGoogleOAuthToken(): Promise<string> {
  const now = Date.now();
  if (cachedAuthToken && now < tokenExpiresAt) {
    return cachedAuthToken;
  }

  const { credentials, path } = await getGoogleCredentials();

  let auth: GoogleAuth;
  if (credentials) {
    auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  } else {
    try {
      auth = new GoogleAuth({
        keyFilename: "./clave.json",
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
    } catch {
      throw new Error("No se encontraron credenciales de Google (clave.json o variable de entorno GOOGLE_CREDENTIALS / FIREBASE_KEY)");
    }
  }

  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  if (!tokenRes.token) {
    throw new Error(`No se pudo obtener el OAuth token de Google desde ${path || "credenciales"}`);
  }

  cachedAuthToken = tokenRes.token;
  tokenExpiresAt = now + 50 * 60 * 1000;
  return cachedAuthToken;
}

/**
 * Extrae la instrucción de estilo entre paréntesis (ej: "(furious, aggressive and loud tone) ¡No me pidas que me calme!...")
 */
function extractPromptStyle(rawText: string, explicitPrompt?: string): { cleanText: string; prompt: string } {
  let clean = rawText.trim();
  let prompt = explicitPrompt ? explicitPrompt.trim() : "";

  const tagRegex = /^\s*\(([^)]+)\)\s*/i;
  const match = clean.match(tagRegex);

  if (match) {
    clean = clean.replace(match[0], "").trim();
    if (!prompt) {
      prompt = match[1].trim();
    }
  }

  return { cleanText: clean, prompt };
}

export class GoogleTtsService {
  resolveVoiceAndLanguage(voiceInput?: string, languageInput?: string): { voiceName: string; languageCode: string; shortName: string } {
    const defaultVoice = "Aoede";
    const defaultLang = "es-MX";

    if (!voiceInput || voiceInput.trim() === "") {
      return {
        voiceName: defaultVoice,
        languageCode: languageInput || defaultLang,
        shortName: defaultVoice,
      };
    }

    const trimmed = voiceInput.trim();
    const lower = trimmed.toLowerCase();

    if (GOOGLE_VOICES_SHORT_MAP[lower]) {
      const match = GOOGLE_VOICES_SHORT_MAP[lower];
      return {
        voiceName: match.shortName,
        languageCode: languageInput || "es-MX",
        shortName: match.shortName,
      };
    }

    if (trimmed.includes("-")) {
      const short = trimmed.split("-").pop() || trimmed;
      return {
        voiceName: short,
        languageCode: languageInput || extractLanguageCode(trimmed, defaultLang),
        shortName: short,
      };
    }

    return {
      voiceName: trimmed,
      languageCode: languageInput || defaultLang,
      shortName: trimmed,
    };
  }

  async checkStatus() {
    try {
      const token = await getGoogleOAuthToken();
      return {
        available: true,
        status: "online",
        provider: "Google Cloud Text-to-Speech (Gemini 2.5 Pro TTS)",
        motor: "gemini-2.5-pro-tts",
        endpoint: "https://texttospeech.googleapis.com/v1beta1/text:synthesize",
        tokenValido: Boolean(token),
        vocesOficialesGoogle: GOOGLE_OFFICIAL_VOICES.map((v) => v.shortName),
        storage: `AWS S3 Bucket (${BUCKET_NAME})`,
      };
    } catch (error) {
      console.error("❌ Error verificando Google Cloud TTS status:", error);
      return {
        available: false,
        status: "offline",
        provider: "Google Cloud Text-to-Speech",
        message: "Error al autenticar con clave.json.",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getVoices(_filterLang?: string) {
    let firestoreVoices: GoogleVoiceMetadata[] = [];
    try {
      const snapshot = await db.collection(FOLDER_GOOGLE_VOCES).get();
      if (!snapshot.empty) {
        firestoreVoices = snapshot.docs
          .filter((doc) => doc.id !== "_resumen")
          .map((doc) => doc.data() as GoogleVoiceMetadata);
      }
    } catch {
      // Continuar con catálogo predeterminado
    }

    const firestoreMap = new Map(firestoreVoices.map((v) => [(v.id || v.name || v.shortName || "").toLowerCase(), v]));
    const voices = GOOGLE_VOICES_CATALOG.map((cv) => {
      const existing = firestoreMap.get(cv.shortName.toLowerCase());
      return existing ? { ...cv, ...existing } : cv;
    });

    const gratis = voices.filter((v) => !v.is_premium);
    const premium = voices.filter((v) => v.is_premium);

    return {
      success: true,
      total: voices.length,
      totalGratis: gratis.length,
      totalPremium: premium.length,
      provider: "Google Cloud Text-to-Speech (Gemini 2.5 Pro TTS)",
      folderS3: FOLDER_GOOGLE_VOCES,
      textoMuestra: TEXTO_MUESTRA_DEFAULT,
      vocesOficialesGoogle: voices,
      vocesGratis: gratis.map((v) => v.name || v.shortName),
      vocesPremium: premium.map((v) => v.name || v.shortName),
      listaVocesGratis: gratis,
      listaVocesPremium: premium,
      vocesFemeninas: voices.filter((v) => v.gender === "female" || v.genero === "Femenino").map((v) => v.name || v.shortName),
      vocesMasculinas: voices.filter((v) => v.gender === "male" || v.genero === "Masculino").map((v) => v.name || v.shortName),
    };
  }

  /**
   * Sintetiza audio usando Gemini 2.5 Pro TTS con Style Instructions (input.prompt) a través de Google Cloud TTS v1beta1
   */
  async synthesizeSpeech(options: SynthesizeOptions): Promise<Uint8Array> {
    const {
      text,
      prompt: explicitPrompt,
      voiceName: rawVoice,
      modelName = "gemini-2.5-pro-tts",
      languageCode: rawLang,
      speakingRate = 1.0,
      pitch = 0.0,
      audioEncoding = "MP3",
    } = options;

    if (!text) {
      throw new Error("Debes proporcionar 'text' o 'texto' para generar audio.");
    }

    // 1. Extraer texto limpio y la instrucción de estilo entre paréntesis
    const { cleanText, prompt } = extractPromptStyle(text, explicitPrompt);
    const { shortName, languageCode } = this.resolveVoiceAndLanguage(rawVoice, rawLang);

    const token = await getGoogleOAuthToken();

    // 2. Formato exacto de Google Cloud Text-to-Speech v1beta1 con Gemini 2.5 Pro TTS
    const payload: any = {
      audioConfig: {
        audioEncoding: audioEncoding === "LINEAR16" ? "LINEAR16" : "MP3",
        speakingRate: Math.max(0.25, Math.min(4.0, speakingRate)),
        pitch: Math.max(-20.0, Math.min(20.0, pitch)),
      },
      input: {
        text: cleanText,
        ...(prompt ? { prompt } : {}),
      },
      voice: {
        languageCode: languageCode || "es-MX",
        modelName: modelName,
        name: shortName,
      },
    };

    const url = "https://texttospeech.googleapis.com/v1beta1/text:synthesize";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    // 3. Si la API de Gemini 2.5 Pro TTS requiere permisos adicionales en Google Cloud,
    // hacer fallback transparente con Chirp3-HD con modulación emocional
    if (data.error) {
      console.warn(
        `ℹ️ Gemini 2.5 Pro TTS (${data.error.code}): ${data.error.message?.substring(0, 120)}...`
      );
      console.warn("🔄 Realizando síntesis de alta definición con Google Cloud Chirp3-HD...");

      const fallbackRequest = {
        input: { text: cleanText },
        voice: {
          languageCode: "es-US",
          name: `es-US-Chirp3-HD-${shortName}`,
        },
        audioConfig: {
          audioEncoding: audioEncoding === "LINEAR16" ? "LINEAR16" : "MP3",
          speakingRate: speakingRate,
        },
      };

      const [fallbackRes] = await googleTtsClient.synthesizeSpeech(fallbackRequest as any);
      if (fallbackRes.audioContent) {
        if (typeof fallbackRes.audioContent === "string") {
          const bString = atob(fallbackRes.audioContent);
          const bytes = new Uint8Array(bString.length);
          for (let i = 0; i < bString.length; i++) bytes[i] = bString.charCodeAt(i);
          return bytes;
        }
        return new Uint8Array(fallbackRes.audioContent as Uint8Array);
      }
      throw new Error(`Google Cloud TTS Error (${data.error.code}): ${data.error.message}`);
    }

    if (!data.audioContent) {
      throw new Error("Google Cloud TTS no devolvió audioContent en la respuesta.");
    }

    const binaryString = atob(data.audioContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Sintetiza audio individual y lo sube a AWS S3.
   */
  async synthesizeAndUpload(options: UploadOptions) {
    const folder = options.folder || "HISTORIA";
    const audioBuffer = await this.synthesizeSpeech(options);
    const { shortName, languageCode } = this.resolveVoiceAndLanguage(
      options.voiceName,
      options.languageCode
    );

    const ext = options.audioEncoding === "LINEAR16" ? "wav" : "mp3";
    const mimeType = options.audioEncoding === "LINEAR16" ? "audio/wav" : "audio/mpeg";

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const actualFileName = options.fileName ? `${options.fileName}.${ext}` : `${shortName}-${uniqueId}.${ext}`;
    const s3Key = `${folder}/${actualFileName}`;

    const uploadCmd = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: audioBuffer,
      ContentType: mimeType,
      ACL: "public-read",
    });

    await s3Client.send(uploadCmd);

    const s3Url = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${encodeURI(s3Key)}`;

    return {
      estado: "completado",
      url: s3Url,
      audio: s3Url,
      audioUrl: s3Url,
      preview_url: s3Url,
      s3Key,
      bucket: BUCKET_NAME,
      personaje: shortName,
      modelo: options.modelName || "gemini-2.5-pro-tts",
      idioma: languageCode,
      tamanoBytes: audioBuffer.length,
      formato: ext,
    };
  }

  /**
   * Genera audio multivoz a partir de HISTORIA con soporte de Style Instructions (input.prompt).
   */
  async generateMultiVoiceAndUpload(
    segments: DialogueSegmentGoogle[],
    folderOrOptions: string | { folder?: string; customName?: string; modelName?: string } = "HISTORIA",
    customNameArg?: string
  ) {
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      throw new Error("El arreglo de HISTORIA no puede estar vacío.");
    }

    const folder = typeof folderOrOptions === "string" ? folderOrOptions : (folderOrOptions?.folder || "HISTORIA");
    const customName = typeof folderOrOptions === "object" ? (folderOrOptions?.customName || customNameArg) : customNameArg;
    const modelName = typeof folderOrOptions === "object" ? (folderOrOptions?.modelName || "gemini-2.5-pro-tts") : "gemini-2.5-pro-tts";

    const audioParts: Uint8Array[] = [];
    const vocesUtilizadas: Record<string, string> = {};
    const personajesSet = new Set<string>();

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const rawText = seg.texto || seg.Texto || seg.TEXTO || seg.text || seg.Text;
      const text = rawText ? String(rawText).trim() : "";
      if (!text) continue;

      const rawPersonaje = seg.personaje || seg.Personaje || seg.PERSONAJE ||
        seg.character || seg.voice || seg.voz || seg.voiceName || seg.voice_name ||
        seg.voiceId || seg.voice_id || "Aoede";

      const personajeName = String(rawPersonaje).trim();
      personajesSet.add(personajeName);

      const resolved = this.resolveVoiceAndLanguage(personajeName, seg.languageCode || seg.idioma);
      vocesUtilizadas[personajeName] = resolved.voiceName;

      const prompt = seg.prompt || seg.style || seg.style_instructions || seg.styleInstructions || seg.instruccion || seg.emocion || seg.emotion;

      const part = await this.synthesizeSpeech({
        text,
        prompt,
        voiceName: resolved.voiceName,
        languageCode: resolved.languageCode,
        speakingRate: seg.speakingRate,
        pitch: seg.pitch,
        modelName: modelName || "gemini-2.5-pro-tts",
        audioEncoding: "MP3",
      });

      audioParts.push(part);
    }

    if (audioParts.length === 0) {
      throw new Error("No se pudo generar ningún fragmento de audio válido.");
    }

    const merged = await mergeAudioBuffersWithFFmpeg(audioParts, {
      bitrate: "128k",
      sampleRate: "24000",
    });

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const fileName = customName ? `${customName}.mp3` : `historia-${uniqueId}.mp3`;
    const s3Key = `${folder}/${fileName}`;

    const uploadCmd = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: merged,
      ContentType: "audio/mpeg",
      ACL: "public-read",
    });

    await s3Client.send(uploadCmd);

    const s3Url = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${encodeURI(s3Key)}`;

    return {
      estado: "completado",
      url: s3Url,
      audio: s3Url,
      audioUrl: s3Url,
      s3Key,
      bucket: BUCKET_NAME,
      modelo: "gemini-2.5-pro-tts",
      totalSegmentos: segments.length,
      personajes: Array.from(personajesSet),
      vocesUtilizadas,
      tamanoBytes: merged.length,
      formato: "mp3",
    };
  }

  /**
   * Sincroniza todas las 30 voces oficiales de Google con S3 y Firebase Firestore.
   */
  async syncVoicesWithS3AndFirebase(
    sampleText = TEXTO_MUESTRA_DEFAULT,
    folder = FOLDER_GOOGLE_VOCES
  ) {
    const results: Array<{
      id: string;
      nombre: string;
      genero: string;
      mp3: string;
      preview_url: string;
      status: "ok" | "error";
      error?: string;
    }> = [];

    for (let i = 0; i < GOOGLE_VOICES_CATALOG.length; i++) {
      const v = GOOGLE_VOICES_CATALOG[i];
      const indexStr = `[${i + 1}/${GOOGLE_VOICES_CATALOG.length}]`;
      console.log(`${indexStr} ⏳ Sintetizando muestra para Google: ${v.shortName} (${v.genero})...`);

      try {
        const audioBuffer = await this.synthesizeSpeech({
          text: sampleText,
          voiceName: v.shortName,
          languageCode: "es-MX",
          modelName: "gemini-2.5-pro-tts",
          audioEncoding: "MP3",
        });

        const fileName = `${v.shortName}.mp3`;
        const s3Key = `${folder}/${fileName}`;

        const uploadCmd = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: audioBuffer,
          ContentType: "audio/mpeg",
          ACL: "public-read",
        });
        await s3Client.send(uploadCmd);

        const s3Url = `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${folder}/${encodeURIComponent(fileName)}`;

        const docData: GoogleVoiceMetadata = {
          id: v.shortName,
          name: v.shortName,
          nombre: v.shortName,
          shortName: v.shortName,
          idGoogle: `es-US-Chirp3-HD-${v.shortName}`,
          gender: v.gender,
          genero: v.genero,
          languageCode: "es-MX",
          idioma: "Español (Latinoamérica / EE. UU.)",
          descripcion: v.descripcion,
          description: v.descripcion,
          mp3: s3Url,
          audioUrl: s3Url,
          preview_url: s3Url,
          textoPrueba: sampleText,
          proveedor: "Google Cloud Text-to-Speech (Gemini 2.5 Pro TTS)",
        };

        await db.collection(folder).doc(v.shortName).set(
          { ...docData, actualizadoEn: new Date().toISOString() },
          { merge: true }
        );

        console.log(`   ✅ S3: ${s3Url}`);
        console.log(`   🔥 Firestore: Documento ${v.shortName} guardado.`);

        results.push({
          id: v.shortName,
          nombre: v.shortName,
          genero: v.genero,
          mp3: s3Url,
          preview_url: s3Url,
          status: "ok",
        });

        await new Promise((r) => setTimeout(r, 250));
      } catch (err: any) {
        console.error(`   ❌ Error sincronizando voz Google ${v.shortName}:`, err?.message || err);
        results.push({
          id: v.shortName,
          nombre: v.shortName,
          genero: v.genero,
          mp3: "",
          preview_url: "",
          status: "error",
          error: err?.message || String(err),
        });
      }
    }

    const okList = results.filter((r) => r.status === "ok");

    try {
      await db.collection(folder).doc("_resumen").set({
        total: okList.length,
        actualizadoEn: new Date().toISOString(),
        voces: okList,
      }, { merge: true });
      console.log(`🔥 Firestore: Documento consolidado _resumen guardado.`);
    } catch (err) {
      console.warn("⚠️ Aviso guardando _resumen en Firestore:", err);
    }

    return results;
  }
}

export const googleTtsService = new GoogleTtsService();
