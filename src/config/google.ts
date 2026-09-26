// src/config/google.ts
import textToSpeech from "npm:@google-cloud/text-to-speech";
import { BUCKET_NAME } from "./aws.ts";

export interface GoogleVoiceMetadata {
  id: string;
  name: string;
  nombre: string;
  shortName: string;
  idGoogle: string;
  gender: "female" | "male" | "neutral";
  genero: "Femenino" | "Masculino" | "Neutro";
  languageCode: string;
  idioma: string;
  descripcion: string;
  description: string;
  mp3: string;
  audioUrl: string;
  preview_url: string;
  textoPrueba: string;
  proveedor: string;
}

/**
 * Obtiene las credenciales de Google Service Account desde clave.json o variables de entorno.
 */
export async function getGoogleCredentials() {
  const possiblePaths = [
    "./clave.json",
  ];

  for (const path of possiblePaths) {
    try {
      const content = await Deno.readTextFile(path);
      const parsed = JSON.parse(content);
      if (
        parsed.type === "service_account" && parsed.client_email &&
        parsed.private_key
      ) {
        return { credentials: parsed, path };
      }
    } catch {
      // Continuar al siguiente
    }
  }

  const envCredentials = Deno.env.get("GOOGLE_CREDENTIALS");

  if (envCredentials) {
    try {
      const parsed = JSON.parse(envCredentials);
      return { credentials: parsed, path: "ENV" };
    } catch (e) {
      console.warn("⚠️ Error parseando credenciales de Google desde ENV:", e);
    }
  }

  return { credentials: null, path: null };
}

const { credentials: initialCredentials, path: foundPath } =
  await getGoogleCredentials();

if (initialCredentials) {
  console.log(
    `🤖 Google Cloud TTS configurado con credenciales de: ${foundPath} (${initialCredentials.client_email})`,
  );
} else {
  console.warn("⚠️ No se encontró clave.json para Google Cloud TTS.");
}

export const googleTtsClient = new textToSpeech.TextToSpeechClient(
  initialCredentials ? { credentials: initialCredentials } : {},
);

export const FOLDER_GOOGLE_VOCES = "VOCES_AUDIO_GOOGLE";
export const TEXTO_MUESTRA_DEFAULT = "HOLA ESTA ES UNA PRUEBA EN HOMERO";

const getS3Mp3Url = (name: string) =>
  `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${FOLDER_GOOGLE_VOCES}/${
    encodeURIComponent(name)
  }.mp3`;

/**
 * Las 30 voces oficiales de Google (Gemini / Chirp3-HD) con preview_url y mp3
 */
export const GOOGLE_OFFICIAL_VOICES = [
  {
    shortName: "Aoede",
    gender: "female",
    desc: "Voz femenina expresiva, brillante y juvenil",
  },
  {
    shortName: "Puck",
    gender: "male",
    desc: "Voz masculina conversacional, alegre y natural",
  },
  {
    shortName: "Charon",
    gender: "male",
    desc: "Voz masculina profunda, reflexiva y calmada",
  },
  {
    shortName: "Fenrir",
    gender: "male",
    desc: "Voz masculina potente, firme y elegante",
  },
  {
    shortName: "Kore",
    gender: "female",
    desc: "Voz femenina dulce, cálida y tranquilizadora",
  },
  {
    shortName: "Leda",
    gender: "female",
    desc: "Voz femenina suave, relajante y clara",
  },
  {
    shortName: "Orus",
    gender: "male",
    desc: "Voz masculina directa, dinámica y profesional",
  },
  {
    shortName: "Zephyr",
    gender: "female",
    desc: "Voz femenina moderna, fluida y amigable",
  },
  {
    shortName: "Achernar",
    gender: "female",
    desc: "Voz femenina refinada de alta definición",
  },
  {
    shortName: "Achird",
    gender: "male",
    desc: "Voz masculina clásica y articulada",
  },
  {
    shortName: "Algenib",
    gender: "male",
    desc: "Voz masculina enérgica y confiable",
  },
  {
    shortName: "Algieba",
    gender: "male",
    desc: "Voz masculina con tono cálido",
  },
  {
    shortName: "Alnilam",
    gender: "male",
    desc: "Voz masculina narrativa envolvente",
  },
  { shortName: "Autonoe", gender: "female", desc: "Voz femenina melódica" },
  {
    shortName: "Callirrhoe",
    gender: "female",
    desc: "Voz femenina serena y equilibrada",
  },
  {
    shortName: "Despina",
    gender: "female",
    desc: "Voz femenina expresiva para historias",
  },
  {
    shortName: "Enceladus",
    gender: "male",
    desc: "Voz masculina resonante para locución",
  },
  { shortName: "Erinome", gender: "female", desc: "Voz femenina cristalina" },
  { shortName: "Gacrux", gender: "female", desc: "Voz femenina sofisticada" },
  { shortName: "Iapetus", gender: "male", desc: "Voz masculina grave y seria" },
  { shortName: "Laomedeia", gender: "female", desc: "Voz femenina entusiasta" },
  {
    shortName: "Pulcherrima",
    gender: "female",
    desc: "Voz femenina inspiradora",
  },
  { shortName: "Rasalgethi", gender: "male", desc: "Voz masculina robusta" },
  { shortName: "Sadachbia", gender: "male", desc: "Voz masculina neutra" },
  { shortName: "Sadaltager", gender: "male", desc: "Voz masculina pausada" },
  { shortName: "Schedar", gender: "male", desc: "Voz masculina autoritaria" },
  { shortName: "Sulafat", gender: "female", desc: "Voz femenina persuasiva" },
  {
    shortName: "Umbriel",
    gender: "male",
    desc: "Voz masculina misteriosa y profunda",
  },
  { shortName: "Vindemiatrix", gender: "female", desc: "Voz femenina vivaz" },
  {
    shortName: "Zubenelgenubi",
    gender: "male",
    desc: "Voz masculina distintiva",
  },
] as const;

export const GOOGLE_VOICES_CATALOG: GoogleVoiceMetadata[] =
  GOOGLE_OFFICIAL_VOICES.map((v) => {
    const s3Url = getS3Mp3Url(v.shortName);
    return {
      id: v.shortName,
      name: v.shortName,
      nombre: v.shortName,
      shortName: v.shortName,
      idGoogle: `es-US-Chirp3-HD-${v.shortName}`,
      gender: v.gender as "female" | "male",
      genero: v.gender === "female" ? "Femenino" : "Masculino",
      languageCode: "es-US",
      idioma: "Español (Latinoamérica / EE. UU.)",
      descripcion: v.desc,
      description: v.desc,
      mp3: s3Url,
      audioUrl: s3Url,
      preview_url: s3Url,
      textoPrueba: TEXTO_MUESTRA_DEFAULT,
      proveedor: "Google Cloud Text-to-Speech",
    };
  });

/**
 * Mapeo inteligente para reconocer cualquier nombre de voz de Google
 */
export const GOOGLE_VOICES_SHORT_MAP: Record<
  string,
  {
    fullName: string;
    languageCode: string;
    gender: "female" | "male";
    shortName: string;
  }
> = {};

for (const item of GOOGLE_OFFICIAL_VOICES) {
  const fullName = `es-US-Chirp3-HD-${item.shortName}`;
  const lower = item.shortName.toLowerCase();
  GOOGLE_VOICES_SHORT_MAP[lower] = {
    fullName,
    languageCode: "es-US",
    gender: item.gender as "female" | "male",
    shortName: item.shortName,
  };
}

// Alias ortográficos
GOOGLE_VOICES_SHORT_MAP["aoide"] = GOOGLE_VOICES_SHORT_MAP["aoede"];
GOOGLE_VOICES_SHORT_MAP["aoid"] = GOOGLE_VOICES_SHORT_MAP["aoede"];
GOOGLE_VOICES_SHORT_MAP["dalia"] = GOOGLE_VOICES_SHORT_MAP["aoede"];
GOOGLE_VOICES_SHORT_MAP["jorge"] = GOOGLE_VOICES_SHORT_MAP["puck"];
GOOGLE_VOICES_SHORT_MAP["mateo"] = GOOGLE_VOICES_SHORT_MAP["fenrir"];
GOOGLE_VOICES_SHORT_MAP["sofia"] = GOOGLE_VOICES_SHORT_MAP["kore"];
GOOGLE_VOICES_SHORT_MAP["sofía"] = GOOGLE_VOICES_SHORT_MAP["kore"];
GOOGLE_VOICES_SHORT_MAP["camila"] = GOOGLE_VOICES_SHORT_MAP["leda"];
GOOGLE_VOICES_SHORT_MAP["carlos"] = GOOGLE_VOICES_SHORT_MAP["charon"];

/**
 * Deduce el código de idioma a partir del nombre de la voz.
 */
export function extractLanguageCode(
  voiceName: string,
  fallback = "es-US",
): string {
  if (!voiceName) return fallback;
  const parts = voiceName.split("-");
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1]}`;
  }
  return fallback;
}
