// elevenlabs.service.ts
import { config, SPANISH_VOICES } from "../config/elevenlabs.ts";
import { PutObjectCommand } from "npm:@aws-sdk/client-s3";
import { BUCKET_NAME, s3Client } from "../config/aws.ts";
import { db } from "../config/firebase.ts";

export interface DialogueSegment {
  personaje?: string;
  Personaje?: string;
  PERSONAJE?: string;
  voice?: string;
  voz?: string;
  voiceId?: string;
  voice_id?: string;
  texto?: string;
  Texto?: string;
  TEXTO?: string;
  text?: string;
  Text?: string;
}

let cachedApiKey: string | null = null;
let lastFetchTime = 0;

/**
 * Busca la API Key de ElevenLabs en Firebase Firestore:
 * Colección ELEVENS -> Subcolección API -> Documento api
 */
async function fetchApiKeyFromFirestore(): Promise<string | null> {
  try {
    const possibleDocRefs = [
      db.collection("ELEVENS").doc("API").collection("api").doc("api"),
      db.collection("ELEVENS").doc("api").collection("API").doc("api"),
      db.collection("ELEVENS").doc("ELEVENS").collection("API").doc("api"),
      db.collection("ELEVENS").doc("API").collection("API").doc("api"),
      db.collection("ELEVENS").doc("API"),
      db.collection("ELEVENS").doc("api"),
      db.collection("elevens").doc("api"),
    ];

    for (const ref of possibleDocRefs) {
      try {
        const snap = await ref.get();
        if (snap.exists) {
          const data = snap.data() as Record<string, unknown>;
          const key = data?.apiKey || data?.api_key || data?.key ||
            data?.token || data?.value || data?.api ||
            data?.ELEVENLABS_API_KEY;
          if (typeof key === "string" && key.trim().length > 0) {
            console.log(`🔑 ElevenLabs API Key obtenida de Firestore en: ${ref.path}`);
            return key.trim();
          }
        }
      } catch {
        // Continuar buscando en las demás variantes
      }
    }

    // Intentar buscar a través de collectionGroup
    try {
      const groupSnap = await db.collectionGroup("API").get();
      for (const doc of groupSnap.docs) {
        if (doc.id.toLowerCase() === "api" || doc.ref.parent.parent?.id === "ELEVENS") {
          const data = doc.data() as Record<string, unknown>;
          const key = data?.apiKey || data?.api_key || data?.key ||
            data?.token || data?.value || data?.api ||
            data?.ELEVENLABS_API_KEY;
          if (typeof key === "string" && key.trim().length > 0) {
            console.log(`🔑 ElevenLabs API Key obtenida de Firestore (collectionGroup): ${doc.ref.path}`);
            return key.trim();
          }
        }
      }
    } catch {
      // Si collectionGroup requiere índice, continuar
    }
  } catch (error) {
    console.warn("⚠️ Error al buscar ElevenLabs API Key en Firestore:", error);
  }

  return null;
}

export class ElevenLabsService {
  /**
   * Obtiene la API Key de ElevenLabs exclusivamente desde Firebase Firestore.
   */
  async getApiKey(): Promise<string> {
    const now = Date.now();
    // Cache de 5 minutos para rendimiento
    if (cachedApiKey && now - lastFetchTime < 5 * 60 * 1000) {
      return cachedApiKey;
    }

    const firestoreKey = await fetchApiKeyFromFirestore();
    if (firestoreKey) {
      cachedApiKey = firestoreKey;
      lastFetchTime = now;
      return firestoreKey;
    }

    throw new Error(
      "ELEVENLABS_API_KEY no se encontró en Firebase (colección 'ELEVENS', subcolección 'API', documento 'api').",
    );
  }

  /**
   * Sube el buffer de audio a S3 en la carpeta elevenslab/ y devuelve la URL pública.
   */
  async uploadToS3(
    buffer: Uint8Array,
    fileName: string,
    folder = "elevenslab",
  ): Promise<string> {
    try {
      const uniqueId = `${Date.now()}-${
        Math.random().toString(36).substring(2, 8)
      }`;
      const key = `${folder}/${uniqueId}-${fileName}`;

      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: "audio/mpeg",
        ACL: "public-read",
      });

      await s3Client.send(command);
      return `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${key}`;
    } catch (error) {
      console.error("❌ Error subiendo audio de ElevenLabs a S3:", error);
      throw error;
    }
  }

  /**
   * Resuelve el voice_id a partir del nombre del personaje/voz o de un ID directo (sin importar mayúsculas/minúsculas).
   */
  resolveVoiceId(voiceInput?: string): string {
    if (!voiceInput) {
      return config.elevenLabs.defaultVoiceId;
    }

    const cleanInput = voiceInput.trim().toLowerCase();

    const found = SPANISH_VOICES.find(
      (v) =>
        v.id.toLowerCase() === cleanInput ||
        v.name.toLowerCase() === cleanInput,
    );

    return found ? found.id : voiceInput;
  }

  /**
   * Verifica el estado y conexión con la API de ElevenLabs, así como los caracteres disponibles.
   */
  async checkStatus() {
    let apiKey = "";
    try {
      apiKey = await this.getApiKey();
    } catch (err) {
      return {
        available: false,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      };
    }

    try {
      const response = await fetch(
        "https://api.elevenlabs.io/v1/user/subscription",
        {
          headers: {
            "xi-api-key": apiKey,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          available: false,
          status: "unauthorized_or_error",
          httpStatus: response.status,
          message: "No se pudo autenticar con ElevenLabs. Verifica tu API Key en Firebase.",
          error: errorData,
        };
      }

      const data = await response.json();
      const characterCount = data.character_count ?? 0;
      const characterLimit = data.character_limit ?? 0;
      const remainingCharacters = Math.max(0, characterLimit - characterCount);

      return {
        available: true,
        status: "online",
        tier: data.tier || "free",
        subscriptionStatus: data.status || "active",
        quota: {
          characterCount,
          characterLimit,
          remainingCharacters,
          percentUsed: characterLimit > 0
            ? Number(((characterCount / characterLimit) * 100).toFixed(2))
            : 0,
        },
        message: "ElevenLabs está disponible y conectado correctamente desde Firebase.",
      };
    } catch (error) {
      return {
        available: false,
        status: "offline",
        message: "Error al intentar conectar con los servidores de ElevenLabs.",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Devuelve las voces configuradas organizadas por categorías y lista general.
   */
  getVoices() {
    return {
      total: SPANISH_VOICES.length,
      femaleVoices: SPANISH_VOICES.filter((v) => v.gender === "female"),
      maleVoices: SPANISH_VOICES.filter((v) => v.gender === "male"),
      neutralVoices: SPANISH_VOICES.filter((v) => v.gender === "neutral"),
      all: SPANISH_VOICES,
    };
  }

  /**
   * Genera audio para un solo texto con la voz seleccionada.
   */
  async generateAudio(text: string, voice?: string): Promise<Uint8Array> {
    const apiKey = await this.getApiKey();
    const { modelId } = config.elevenLabs;
    const voiceId = this.resolveVoiceId(voice);

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ElevenLabs API Error: ${response.status} - ${errorText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  /**
   * Genera audio multivoz a partir de HISTORIA / segmentos y los une en un solo archivo MP3.
   */
  async generateMultiVoiceAudio(
    segments: DialogueSegment[],
  ): Promise<Uint8Array> {
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      throw new Error(
        "El arreglo de HISTORIA no puede estar vacío.",
      );
    }

    const audioParts: Uint8Array[] = [];

    for (const segment of segments) {
      const rawText = segment.texto || segment.Texto || segment.TEXTO ||
        segment.text || segment.Text;
      const text = rawText ? String(rawText).trim() : "";

      if (!text) continue;

      const rawVoice = segment.personaje || segment.Personaje ||
        segment.PERSONAJE || segment.voice || segment.voz ||
        segment.voiceId || segment.voice_id;

      const voice = rawVoice ? String(rawVoice).trim() : undefined;

      const part = await this.generateAudio(text, voice);
      audioParts.push(part);
    }

    if (audioParts.length === 0) {
      throw new Error("No se pudo generar ningún fragmento de audio válido.");
    }

    // Unir todos los buffers MP3 en un solo Uint8Array
    const totalLength = audioParts.reduce((acc, part) => acc + part.length, 0);
    const mergedAudio = new Uint8Array(totalLength);

    let offset = 0;
    for (const part of audioParts) {
      mergedAudio.set(part, offset);
      offset += part.length;
    }

    return mergedAudio;
  }
}
