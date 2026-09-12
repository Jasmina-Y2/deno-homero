import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import { BUCKET_NAME, pollyClient, s3Client } from "../config/aws.ts";
import { SynthesizeSpeechCommand, VoiceId } from "npm:@aws-sdk/client-polly";
import { uploadToS3 } from "../controllers/aws.controller.ts";
import { mergeAudioBuffersWithFFmpeg } from "../utils/audio.utils.ts";

const validarHistoriaCoherencia = async (
  historia: string,
  apiKey: string,
): Promise<{ valida: boolean; razon?: string }> => {
  if (historia.length < 100) {
    return { valida: false, razon: "La historia es demasiado corta." };
  }

  const vocales = historia.match(/[aeiouáéíóú]/gi)?.length || 0;
  if (vocales / historia.length < 0.2) {
    return {
      valida: false,
      razon: "El texto no parece lenguaje humano coherente.",
    };
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              `Responde SOLO con un JSON estricto: {"valida": boolean, "razon": "si es falsa decir por qué, si es verdadera dejar vacío"}. 
                        TU TAREA: Analiza si el texto es una historia, diálogo o narración con coherencia gramatical en español. 
                        REGLA DE ORO (¡CRÍTICO!): Esto es FICCIÓN. ESTÁ 100% PERMITIDO el uso de lenguaje soez, groserías, vulgaridades y tono adulto intenso. NO rechaces el texto por tener malas palabras, insultos o violencia narrativa. 
                        CUÁNDO RECHAZAR (valida: false): SOLO debes rechazar si el texto es literalmente basura de teclado (ej: "asdfgh"), spam incomprensible, palabras sueltas sin estructura (ej: "perro zapato rojo mierda"), o si carece totalmente de sentido narrativo.`,
          },
          { role: "user", content: historia },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
    });
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return { valida: false, razon: "Error en el motor de validación." };
  }
};

interface VoiceConfig {
  id: string;
  engine: "standard" | "neural";
}

/**
 * Adapta y sanitiza el SSML según el motor de voz (standard o neural) de AWS Polly
 */
const prepararSSMLParaPolly = (rawText: string, engine: string): string => {
  let content = String(rawText).trim();

  // 1. Quitar <speak> y </speak> envolventes si ya vienen en el input
  if (/^<speak\b[^>]*>/i.test(content)) {
    content = content
      .replace(/^<speak\b[^>]*>/i, "")
      .replace(/<\/speak>$/i, "")
      .trim();
  }

  // 2. Si no contiene etiquetas XML, es texto plano
  if (!/<[a-zA-Z\/][^>]*>/.test(content)) {
    content = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    content = `<prosody rate="90%">${content}</prosody>`;
  } else {
    // Si ya es SSML, solo escapamos los '&' que no formen parte de entidades válidas
    content = content.replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;");
  }

  // 3. Adaptaciones para motores Neural (AWS Polly no soporta amazon:effect ni amazon:breath en neural)
  if (engine === "neural") {
    content = content
      .replace(
        /<amazon:effect\s+name=["']whispered["']>/gi,
        '<prosody volume="x-soft" rate="90%">',
      )
      .replace(/<\/amazon:effect>/gi, "</prosody>")
      .replace(/<amazon:breath\b[^>]*\/?>/gi, '<break time="200ms"/>');
  }

  return `<speak>${content}<break time="400ms"/></speak>`;
};

export interface AwsPollyVoice {
  key: string;
  id: string;
  nombre: string;
  idioma: "Español" | "Inglés";
  codigoIdioma: "es" | "en";
  region: string;
  genero: "mujer" | "hombre";
  motor: "standard" | "neural";
}

export const CATALOGO_VOCES_AWS_POLLY: AwsPollyVoice[] = [
  // 🇪🇸 VOCES EN ESPAÑOL (VOICE_0 - VOICE_14)
  {
    key: "VOICE_0",
    id: "Lupe",
    nombre: "Lupe (Estándar US)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-US",
    genero: "mujer",
    motor: "standard",
  },
  {
    key: "VOICE_1",
    id: "Mia",
    nombre: "Mia (Estándar MX)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-MX",
    genero: "mujer",
    motor: "standard",
  },
  {
    key: "VOICE_2",
    id: "Miguel",
    nombre: "Miguel (Estándar US)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-US",
    genero: "hombre",
    motor: "standard",
  },
  {
    key: "VOICE_3",
    id: "Enrique",
    nombre: "Enrique (Estándar ES)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-ES",
    genero: "hombre",
    motor: "standard",
  },
  {
    key: "VOICE_4",
    id: "Conchita",
    nombre: "Conchita (Estándar ES)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-ES",
    genero: "mujer",
    motor: "standard",
  },
  {
    key: "VOICE_5",
    id: "Penelope",
    nombre: "Penelope (Estándar US)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-US",
    genero: "mujer",
    motor: "standard",
  },
  {
    key: "VOICE_6",
    id: "Lucia",
    nombre: "Lucia (Estándar ES)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-ES",
    genero: "mujer",
    motor: "standard",
  },
  {
    key: "VOICE_7",
    id: "Andres",
    nombre: "Andrés (Neural MX)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-MX",
    genero: "hombre",
    motor: "neural",
  },
  {
    key: "VOICE_8",
    id: "Lucia",
    nombre: "Lucia (Neural ES)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-ES",
    genero: "mujer",
    motor: "neural",
  },
  {
    key: "VOICE_9",
    id: "Lupe",
    nombre: "Lupe (Neural US)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-US",
    genero: "mujer",
    motor: "neural",
  },
  {
    key: "VOICE_10",
    id: "Mia",
    nombre: "Mia (Neural MX)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-MX",
    genero: "mujer",
    motor: "neural",
  },
  {
    key: "VOICE_11",
    id: "Miguel",
    nombre: "Miguel (Estándar US 2)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-US",
    genero: "hombre",
    motor: "standard",
  },
  {
    key: "VOICE_12",
    id: "Pedro",
    nombre: "Pedro (Neural US)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-US",
    genero: "hombre",
    motor: "neural",
  },
  {
    key: "VOICE_13",
    id: "Penelope",
    nombre: "Penelope (Neural US)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-US",
    genero: "mujer",
    motor: "neural",
  },
  {
    key: "VOICE_14",
    id: "Sergio",
    nombre: "Sergio (Neural ES)",
    idioma: "Español",
    codigoIdioma: "es",
    region: "es-ES",
    genero: "hombre",
    motor: "neural",
  },

  // 🇬🇧/🇺🇸 VOCES EN INGLÉS (VOICE_15 - VOICE_36)
  {
    key: "VOICE_15",
    id: "Joanna",
    nombre: "Joanna (Estándar US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "mujer",
    motor: "standard",
  },
  {
    key: "VOICE_16",
    id: "Joanna",
    nombre: "Joanna (Neural US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "mujer",
    motor: "neural",
  },
  {
    key: "VOICE_17",
    id: "Matthew",
    nombre: "Matthew (Estándar US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "hombre",
    motor: "standard",
  },
  {
    key: "VOICE_18",
    id: "Matthew",
    nombre: "Matthew (Neural US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "hombre",
    motor: "neural",
  },
  {
    key: "VOICE_19",
    id: "Ivy",
    nombre: "Ivy (Estándar US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "mujer",
    motor: "standard",
  },
  {
    key: "VOICE_20",
    id: "Ivy",
    nombre: "Ivy (Neural US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "mujer",
    motor: "neural",
  },
  {
    key: "VOICE_21",
    id: "Justin",
    nombre: "Justin (Estándar US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "hombre",
    motor: "standard",
  },
  {
    key: "VOICE_22",
    id: "Justin",
    nombre: "Justin (Neural US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "hombre",
    motor: "neural",
  },
  {
    key: "VOICE_23",
    id: "Kendra",
    nombre: "Kendra (Estándar US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "mujer",
    motor: "standard",
  },
  {
    key: "VOICE_24",
    id: "Kendra",
    nombre: "Kendra (Neural US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "mujer",
    motor: "neural",
  },
  {
    key: "VOICE_25",
    id: "Kimberly",
    nombre: "Kimberly (Estándar US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "mujer",
    motor: "standard",
  },
  {
    key: "VOICE_26",
    id: "Kimberly",
    nombre: "Kimberly (Neural US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "mujer",
    motor: "neural",
  },
  {
    key: "VOICE_27",
    id: "Salli",
    nombre: "Salli (Estándar US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "mujer",
    motor: "standard",
  },
  {
    key: "VOICE_28",
    id: "Salli",
    nombre: "Salli (Neural US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "mujer",
    motor: "neural",
  },
  {
    key: "VOICE_29",
    id: "Joey",
    nombre: "Joey (Estándar US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "hombre",
    motor: "standard",
  },
  {
    key: "VOICE_30",
    id: "Joey",
    nombre: "Joey (Neural US)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-US",
    genero: "hombre",
    motor: "neural",
  },
  {
    key: "VOICE_31",
    id: "Amy",
    nombre: "Amy (Estándar GB)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-GB",
    genero: "mujer",
    motor: "standard",
  },
  {
    key: "VOICE_32",
    id: "Amy",
    nombre: "Amy (Neural GB)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-GB",
    genero: "mujer",
    motor: "neural",
  },
  {
    key: "VOICE_33",
    id: "Emma",
    nombre: "Emma (Estándar GB)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-GB",
    genero: "mujer",
    motor: "standard",
  },
  {
    key: "VOICE_34",
    id: "Emma",
    nombre: "Emma (Neural GB)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-GB",
    genero: "mujer",
    motor: "neural",
  },
  {
    key: "VOICE_35",
    id: "Brian",
    nombre: "Brian (Estándar GB)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-GB",
    genero: "hombre",
    motor: "standard",
  },
  {
    key: "VOICE_36",
    id: "Brian",
    nombre: "Brian (Neural GB)",
    idioma: "Inglés",
    codigoIdioma: "en",
    region: "en-GB",
    genero: "hombre",
    motor: "neural",
  },
];

/**
 * Retorna el catálogo completo de voces de AWS Polly organizado por idioma (Español e Inglés) y motor (Standard / Neural)
 * GET /api/ia/aws-voces
 */
export const obtenerVocesAwsController = (ctx: any) => {
  const espanol = CATALOGO_VOCES_AWS_POLLY.filter((v) =>
    v.codigoIdioma === "es"
  );
  const ingles = CATALOGO_VOCES_AWS_POLLY.filter((v) =>
    v.codigoIdioma === "en"
  );

  ctx.response.status = 200;
  ctx.response.headers.set("Content-Type", "application/json");
  ctx.response.body = {
    success: true,
    total: CATALOGO_VOCES_AWS_POLLY.length,
    proveedor: "AWS Polly",
    idiomas: {
      espanol: {
        total: espanol.length,
        voces: espanol,
      },
      ingles: {
        total: ingles.length,
        voces: ingles,
      },
    },
    todas: CATALOGO_VOCES_AWS_POLLY,
  };
};

export const generateMultivoiceAudio = async (ctx: any) => {
  try {
    const body = await ctx.request.body.json();
    const dialogos = body.HISTORIA || body.historia || body.dialogos ||
      body.segments;

    if (!Array.isArray(dialogos) || dialogos.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error:
          "Debes enviar un array 'HISTORIA' o 'dialogos' válido y no vacío",
      };
      return;
    }

    const v_map: Record<string, any> = {};
    for (const v of CATALOGO_VOCES_AWS_POLLY) {
      v_map[v.key] = { id: v.id, engine: v.motor };
    }

    // 1. Función para pausar (delay)
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    // 2. Fragmentos de audio procesados
    const partesAudio: Uint8Array[] = [];

    // 3. Procesamos los fragmentos uno por uno
    for (const pje of dialogos) {
      const rawVoice = pje.personaje || pje.Personaje || pje.PERSONAJE ||
        pje.v || pje.voice || pje.voz || "VOICE_1";
      const normalizedVoiceKey = String(rawVoice).trim().toUpperCase();

      const voiceConfig = v_map[normalizedVoiceKey] ||
        (typeof rawVoice === "string" && !rawVoice.startsWith("VOICE_")
          ? { id: rawVoice, engine: "standard" }
          : { id: "Mia", engine: "standard" });

      const realVoiceId = voiceConfig.id as any;
      const engineToUse = voiceConfig.engine;

      const rawText = pje.texto || pje.Texto || pje.TEXTO || pje.t ||
        pje.text || "";

      if (!String(rawText).trim()) continue;

      // Preparamos el SSML correctamente
      const finalSSML = prepararSSMLParaPolly(String(rawText), engineToUse);

      const command = new SynthesizeSpeechCommand({
        OutputFormat: "mp3",
        Text: finalSSML,
        TextType: "ssml",
        VoiceId: realVoiceId,
        Engine: engineToUse,
        SampleRate: "24000",
      });

      const res = await pollyClient.send(command);

      if (!res.AudioStream) {
        throw new Error(
          `AWS Polly no devolvió AudioStream para el fragmento: ${rawText}`,
        );
      }

      const byteArray = await res.AudioStream.transformToByteArray();
      partesAudio.push(byteArray);

      await delay(500);
    }

    if (partesAudio.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "No se generó ningún fragmento de audio válido.",
      };
      return;
    }

    // Unir todos los fragmentos MP3 usando FFmpeg recodificando con libmp3lame
    const audioFinal = await mergeAudioBuffersWithFFmpeg(partesAudio, {
      bitrate: "128k",
      sampleRate: "24000",
    });

    const fileName = `historia_polly_${Date.now()}.mp3`;
    const urlS3 = await uploadToS3(audioFinal, fileName, "audio/mpeg", "polly");

    ctx.response.status = 200;
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = {
      success: true,
      audioUrl: urlS3,
      url: urlS3,
      mensaje: "Audio generado y guardado con éxito",
    };
  } catch (error) {
    console.error("Error crítico en secuencia Multivoz Polly:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: "Fallo en la síntesis o ensamblaje del audio",
      detalle: error instanceof Error ? error.message : String(error),
    };
  }
};

// ==========================================
// MOTOR DE IA: GOOGLE GEMINI API (STUDIO) + RESPALDO GROQ
// ==========================================

const MODELOS_GEMINI_FALLBACK = [
  "gemini-2.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
];

const MODELOS_GEMINI_TTS_FALLBACK = [
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-flash-preview-tts",
];

const MODELOS_GROQ_FALLBACK = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "gemma2-9b-it",
  "mixtral-8x7b-32768",
];

/**
 * Convierte un buffer de PCM 16-bit Mono a formato WAV estándar
 */
const pcmToWav = (
  pcmBytes: Uint8Array,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16,
): Uint8Array => {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBytes.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // "RIFF"
  view.setUint8(0, 0x52);
  view.setUint8(1, 0x49);
  view.setUint8(2, 0x46);
  view.setUint8(3, 0x46);
  view.setUint32(4, 36 + dataSize, true);
  // "WAVE"
  view.setUint8(8, 0x57);
  view.setUint8(9, 0x41);
  view.setUint8(10, 0x56);
  view.setUint8(11, 0x45);
  // "fmt "
  view.setUint8(12, 0x66);
  view.setUint8(13, 0x6d);
  view.setUint8(14, 0x74);
  view.setUint8(15, 0x20);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // "data"
  view.setUint8(36, 0x64);
  view.setUint8(37, 0x61);
  view.setUint8(38, 0x74);
  view.setUint8(39, 0x61);
  view.setUint32(40, dataSize, true);

  const result = new Uint8Array(buffer);
  result.set(pcmBytes, headerSize);
  return result;
};

/**
 * Llama a la API oficial de Google Gemini (Google AI Studio)
 */
const llamarGeminiAPI = async (
  promptSistema: string,
  promptUsuario: string,
  apiKey: string,
  temperature: number = 0.2,
  responseJson: boolean = true,
): Promise<any> => {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no configurada");
  }

  let ultimoError: any = null;

  for (const modelo of MODELOS_GEMINI_FALLBACK) {
    try {
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
      const payload: Record<string, any> = {
        contents: [
          {
            role: "user",
            parts: [{ text: promptUsuario }],
          },
        ],
        generationConfig: {
          temperature,
        },
      };

      if (promptSistema) {
        payload.systemInstruction = {
          parts: [{ text: promptSistema }],
        };
      }

      if (responseJson) {
        payload.generationConfig.responseMimeType = "application/json";
      }

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.error) {
        ultimoError = new Error(
          `Gemini (${modelo}): ${
            data.error.message || JSON.stringify(data.error)
          }`,
        );
        continue;
      }

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        ultimoError = new Error(`Respuesta vacía de Gemini con ${modelo}`);
        continue;
      }

      if (responseJson) {
        const cleanJson = rawText
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        return JSON.parse(cleanJson);
      }

      return rawText.trim();
    } catch (err) {
      ultimoError = err;
    }
  }

  throw ultimoError ||
    new Error("No se pudo obtener respuesta de Google Gemini API");
};

/**
 * Llama a Groq probando múltiples modelos en cascada como respaldo
 */
const llamarGroqConFallback = async (
  messages: Array<{ role: string; content: string }>,
  apiKey: string,
  temperature: number = 0,
): Promise<any> => {
  if (!apiKey) {
    throw new Error("IA_KEY no configurada");
  }

  let ultimoError: any = null;

  for (const model of MODELOS_GROQ_FALLBACK) {
    try {
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            response_format: { type: "json_object" },
          }),
        },
      );

      const data = await res.json();
      if (data && !data.error && data.choices?.[0]?.message?.content) {
        return JSON.parse(data.choices[0].message.content.trim());
      }
      ultimoError = data?.error || new Error(`Fallo con modelo ${model}`);
    } catch (err) {
      ultimoError = err;
    }
  }

  throw ultimoError ||
    new Error("No se pudo obtener respuesta de ningún modelo de IA");
};

/**
 * Ejecutor inteligente con prioridad Google Gemini y fallback Groq
 */
const llamarIAConGeminiYGroq = async (
  promptSistema: string,
  promptUsuario: string,
  temperature: number = 0.2,
): Promise<any> => {
  const geminiKey = Deno.env.get("GEMINI_API_KEY") ||
    Deno.env.get("GEMINI_KEY") ||
    Deno.env.get("GOOGLE_API_KEY") ||
    "";

  const groqKey = Deno.env.get("IA_KEY") ||
    Deno.env.get("GROQ_API_KEY") ||
    "";

  // 1. Prioridad: Google Gemini API (Google AI Studio)
  if (geminiKey) {
    try {
      const resultado = await llamarGeminiAPI(
        promptSistema,
        promptUsuario,
        geminiKey,
        temperature,
        true,
      );
      if (resultado) {
        return resultado;
      }
    } catch (geminiErr) {
      console.warn(
        "⚠️ Google Gemini API falló, intentando con respaldo Groq:",
        geminiErr,
      );
    }
  }

  // 2. Respaldo secundario: Groq LLaMA
  if (groqKey) {
    try {
      const messages = [
        { role: "system", content: promptSistema },
        { role: "user", content: promptUsuario },
      ];
      const resultado = await llamarGroqConFallback(
        messages,
        groqKey,
        temperature,
      );
      if (resultado) {
        return resultado;
      }
    } catch (groqErr) {
      console.warn("⚠️ Groq IA de respaldo también falló:", groqErr);
    }
  }

  throw new Error("No hay proveedores de IA disponibles o ambos fallaron.");
};

/**
 * Detector heurístico de idioma local como fallback a prueba de fallos
 */
const detectarIdiomaLocal = (
  texto: string,
): {
  idioma: string;
  codigo: string;
  confianza: number;
  nombreNativo: string;
} => {
  const clean = texto.toLowerCase();

  // Caracteres asiáticos o cirílicos
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(clean)) {
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(clean)) {
      return {
        idioma: "Japonés",
        codigo: "ja",
        confianza: 0.98,
        nombreNativo: "日本語",
      };
    }
    return {
      idioma: "Chino",
      codigo: "zh",
      confianza: 0.95,
      nombreNativo: "中文",
    };
  }
  if (/[\uac00-\ud7af]/.test(clean)) {
    return {
      idioma: "Coreano",
      codigo: "ko",
      confianza: 0.98,
      nombreNativo: "한국어",
    };
  }
  if (/[\u0400-\u04ff]/.test(clean)) {
    return {
      idioma: "Ruso",
      codigo: "ru",
      confianza: 0.95,
      nombreNativo: "Русский",
    };
  }
  if (/[\u0600-\u06ff]/.test(clean)) {
    return {
      idioma: "Árabe",
      codigo: "ar",
      confianza: 0.95,
      nombreNativo: "العربية",
    };
  }

  // Stopwords representativas de idiomas latinos / europeos
  const spanishMatches = (clean.match(
    /\b(el|la|los|las|un|una|de|del|en|para|por|con|que|es|era|había|una vez|dijo|pero|como|más|cuando|su|sus)\b/g,
  ) || []).length;
  const englishMatches = (clean.match(
    /\b(the|and|is|was|in|on|at|to|for|with|that|this|it|he|she|they|were|had|said|but|from|as|when)\b/g,
  ) || []).length;
  const portugueseMatches = (clean.match(
    /\b(o|os|as|um|uma|do|da|dos|das|no|na|nos|nas|para|com|que|é|era|havia|disse|mas|mais|quando|sua|seu)\b/g,
  ) || []).length;
  const frenchMatches = (clean.match(
    /\b(le|la|les|un|une|des|du|dans|pour|avec|que|qui|est|était|avait|dit|mais|plus|quand|son|sa)\b/g,
  ) || []).length;
  const germanMatches = (clean.match(
    /\b(der|die|das|ein|eine|einer|und|ist|war|in|im|auf|für|mit|dass|sie|er|hatte|sagte|aber|nicht)\b/g,
  ) || []).length;
  const italianMatches = (clean.match(
    /\b(il|lo|la|i|gli|le|un|uno|una|di|del|in|per|con|che|è|era|aveva|disse|ma|più|quando|suo|sua)\b/g,
  ) || []).length;

  const scores = [
    {
      idioma: "Español",
      codigo: "es",
      score: spanishMatches,
      nombreNativo: "Español",
    },
    {
      idioma: "Inglés",
      codigo: "en",
      score: englishMatches,
      nombreNativo: "English",
    },
    {
      idioma: "Portugués",
      codigo: "pt",
      score: portugueseMatches,
      nombreNativo: "Português",
    },
    {
      idioma: "Francés",
      codigo: "fr",
      score: frenchMatches,
      nombreNativo: "Français",
    },
    {
      idioma: "Alemán",
      codigo: "de",
      score: germanMatches,
      nombreNativo: "Deutsch",
    },
    {
      idioma: "Italiano",
      codigo: "it",
      score: italianMatches,
      nombreNativo: "Italiano",
    },
  ];

  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score > 0) {
    return {
      idioma: scores[0].idioma,
      codigo: scores[0].codigo,
      confianza: 0.90,
      nombreNativo: scores[0].nombreNativo,
    };
  }

  return {
    idioma: "Español",
    codigo: "es",
    confianza: 0.70,
    nombreNativo: "Español",
  };
};

// ==========================================
// DETECTAR IDIOMA CON IA (GEMINI FIRST)
// ==========================================
/**
 * Detecta el idioma de un fragmento de texto usando Google Gemini API (o fallback)
 */
export const detectarIdiomaIA = async (ctx: any) => {
  try {
    let body: any = {};
    try {
      if (typeof ctx.request.body?.json === "function") {
        body = await ctx.request.body.json();
      } else if (typeof ctx.request.body === "function") {
        const result = ctx.request.body({ type: "json" });
        body = await result.value;
      }
    } catch {
      body = {};
    }

    const texto = body.texto || body.text || body.fragmento || body.content ||
      "";

    if (!texto || typeof texto !== "string" || texto.trim().length === 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error:
          "Debes proporcionar un texto o fragmento para detectar el idioma.",
      };
      return;
    }

    const promptSistema =
      `Eres un detector lingüístico de alta precisión. Tu tarea es identificar el idioma principal del texto proporcionado.
Responde ÚNICAMENTE un objeto JSON válido con la siguiente estructura:
{
  "idioma": "Nombre del idioma en español (ej: Español, Inglés, Portugués, Francés, Alemán, Italiano, Japonés, etc.)",
  "codigo": "Código ISO 639-1 en minúsculas (ej: es, en, pt, fr, de, it, ja, etc.)",
  "confianza": 0.99,
  "nombreNativo": "Nombre del idioma en su propia lengua (ej: Español, English, Português, Français, Deutsch, etc.)"
}`;

    const promptUsuario =
      `Analiza este texto y detecta su idioma principal:\n"""\n${
        texto.slice(0, 4000)
      }\n"""`;

    let resultado: any = null;

    try {
      resultado = await llamarIAConGeminiYGroq(promptSistema, promptUsuario, 0);
    } catch (iaErr) {
      console.warn(
        "⚠️ IA falló en detección de idioma, utilizando fallback local:",
        iaErr,
      );
    }

    if (!resultado || !resultado.idioma || !resultado.codigo) {
      resultado = detectarIdiomaLocal(texto);
    }

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: {
        idioma: resultado.idioma,
        codigo: resultado.codigo,
        confianza: resultado.confianza ?? 0.98,
        nombreNativo: resultado.nombreNativo || resultado.idioma,
        longitudTexto: texto.length,
      },
    };
  } catch (error) {
    console.error("❌ Error en detectarIdiomaIA:", error);
    const fallback = detectarIdiomaLocal(
      String(ctx?.request?.body?.texto || ""),
    );
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: {
        idioma: fallback.idioma,
        codigo: fallback.codigo,
        confianza: 0.70,
        nombreNativo: fallback.nombreNativo,
        longitudTexto: 0,
      },
    };
  }
};

export const detectarIdiomaController = detectarIdiomaIA;

// ==========================================
// GENERAR DESCRIPCIÓN CON IA (GEMINI FIRST)
// ==========================================
/**
 * Genera una descripción/sinopsis atractiva de máximo N caracteres usando Google Gemini API
 */
export const generarDescripcionIA = async (ctx: any) => {
  try {
    let body: any = {};
    try {
      if (typeof ctx.request.body?.json === "function") {
        body = await ctx.request.body.json();
      } else if (typeof ctx.request.body === "function") {
        const result = ctx.request.body({ type: "json" });
        body = await result.value;
      }
    } catch {
      body = {};
    }

    const texto = body.texto || body.historia || body.text || body.content ||
      "";
    const limiteCaracteres = Math.min(
      Math.max(Number(body.maxCaracteres || body.limite || 300), 50),
      600,
    );

    if (!texto || typeof texto !== "string" || texto.trim().length === 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error:
          "Debes proporcionar el texto o historia para generar la descripción.",
      };
      return;
    }

    const promptSistema =
      `Eres un redactor editorial experto en sintetizar historias en micro-sinopsis y ganchos fascinantes para lectores.
Tu objetivo es crear una descripción atractiva, intrigante y concisa que resuma la esencia del texto.

REGLAS OBLIGATORIAS:
1. LONGITUD: La descripción debe tener como MÁXIMO ${limiteCaracteres} caracteres (incluyendo espacios y signos de puntuación). No te pases jamás de ${limiteCaracteres} caracteres.
2. IDIOMA: Escribe la descripción en el MISMO IDIOMA en el que está escrito el texto original.
3. TONO: Intrigante, profesional y cautivador (ideal para la portada/tarjeta de una historia o artículo).
4. FORMATO: Responde ÚNICAMENTE un objeto JSON válido:
{
  "descripcion": "Texto de la sinopsis generado aquí..."
}`;

    const promptUsuario =
      `Genera la sinopsis corta (máx ${limiteCaracteres} caracteres) para este texto:\n"""\n${
        texto.slice(0, 8000)
      }\n"""`;

    let descripcionFinal = "";

    try {
      const resultado = await llamarIAConGeminiYGroq(
        promptSistema,
        promptUsuario,
        0.4,
      );
      descripcionFinal = String(resultado?.descripcion || "").trim();
    } catch (iaErr) {
      console.warn(
        "⚠️ IA falló en generación de descripción, usando fallback:",
        iaErr,
      );
    }

    if (!descripcionFinal) {
      const cleaned = texto.replace(/\s+/g, " ").trim();
      descripcionFinal = cleaned.length <= limiteCaracteres
        ? cleaned
        : cleaned.slice(0, limiteCaracteres - 3).trim() + "...";
    }

    if (descripcionFinal.length > limiteCaracteres) {
      descripcionFinal =
        descripcionFinal.slice(0, limiteCaracteres - 3).trim() + "...";
    }

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: {
        descripcion: descripcionFinal,
        caracteres: descripcionFinal.length,
        limiteMaximo: limiteCaracteres,
      },
    };
  } catch (error) {
    console.error("❌ Error en generarDescripcionIA:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Error al generar la descripción con IA",
    };
  }
};

export const generarDescripcionController = generarDescripcionIA;

// ==========================================
// GENERADOR DE VOZ CON GOOGLE GEMINI (TTS AUDIO & MULTIVOZ)
// ==========================================

const VOCES_GEMINI_MAP: Record<string, string> = {
  // Voces estándar de Gemini Audio
  "PUCK": "Puck",
  "CHARON": "Charon",
  "KORE": "Kore",
  "FENRIR": "Fenrir",
  "AOEDE": "Aoede",

  // Personajes y arquetipos frecuentes
  "ADAM": "Fenrir",
  "BELLA": "Aoede",
  "GEORGE": "Charon",
  "NARRADOR": "Charon",
  "NARRADORA": "Aoede",
  "HOMBRE": "Fenrir",
  "MUJER": "Kore",
  "JOVEN": "Puck",
  "EPICO": "Fenrir",
  "MISTERIO": "Charon",
  "DULCE": "Kore",
  "EXPRESIVA": "Aoede",

  // Mapeos para compatibilidad con voces existentes
  "VOICE_0": "Aoede",
  "VOICE_1": "Kore",
  "VOICE_2": "Fenrir",
  "VOICE_3": "Charon",
  "VOICE_4": "Aoede",
  "VOICE_5": "Kore",
  "VOICE_6": "Aoede",
  "VOICE_7": "Fenrir",
  "VOICE_8": "Aoede",
  "VOICE_9": "Kore",
  "VOICE_10": "Aoede",
  "VOICE_11": "Fenrir",
  "VOICE_12": "Charon",
  "VOICE_13": "Kore",
  "VOICE_14": "Fenrir",
};

/**
 * Sintetiza un fragmento de texto con Google Gemini TTS devolviendo el buffer PCM (24kHz 16-bit Mono)
 */
const sintetizarAudioGeminiPCM = async (
  texto: string,
  voz: string,
  apiKey: string,
  estilo: string = "",
): Promise<{ pcmBytes: Uint8Array; modelo: string }> => {
  const promptTexto = estilo
    ? `Instrucción de locución y emoción: ${estilo}\n\nLee el siguiente texto o diálogo:\n\n${texto}`
    : `Lee el siguiente texto o diálogo con entonación natural, expresiva y cinematográfica:\n\n${texto}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: promptTexto }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voz,
          },
        },
      },
    },
  };

  let ultimoError: any = null;

  for (let ronda = 1; ronda <= 3; ronda++) {
    for (const modelo of MODELOS_GEMINI_TTS_FALLBACK) {
      try {
        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (data.error) {
          const errMsg = data.error.message || JSON.stringify(data.error);
          ultimoError = data.error;

          // Si es límite temporal de peticiones, probamos de inmediato con el otro modelo Flash
          if (
            data.error.code === 429 ||
            data.error.status === "RESOURCE_EXHAUSTED" ||
            /quota|retry/i.test(errMsg)
          ) {
            console.warn(
              `⚠️ Rate limit temporal en ${modelo}. Probando con modelo alternativo...`,
            );
            continue;
          }
          continue;
        }

        const candidateData = data?.candidates?.[0]?.content?.parts?.[0]
          ?.inlineData;
        if (candidateData && candidateData.data) {
          const binaryString = atob(candidateData.data);
          const pcmBytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            pcmBytes[i] = binaryString.charCodeAt(i);
          }
          return { pcmBytes, modelo };
        }
      } catch (err) {
        ultimoError = err;
      }
    }

    // Si ambos modelos dieron 429 en esta ronda, esperar brevemente antes de la siguiente ronda
    if (ronda < 3) {
      console.warn(
        `⏳ Esperando 3s antes de reintentar generación TTS (Ronda ${ronda}/3)...`,
      );
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error(
    `Google Gemini Error: ${
      ultimoError?.message || JSON.stringify(ultimoError) ||
      "No se pudo sintetizar el audio con los modelos disponibles."
    }`,
  );
};

/**
 * Resuelve la voz de Gemini correspondiente para un personaje dado
 */
const resolverVozGemini = (
  personajeRaw: string,
  asignaciones: Map<string, string>,
): string => {
  const norm = String(personajeRaw || "").trim().toUpperCase();
  if (!norm) return "Aoede";

  if (VOCES_GEMINI_MAP[norm]) {
    return VOCES_GEMINI_MAP[norm];
  }

  if (asignaciones.has(norm)) {
    return asignaciones.get(norm)!;
  }

  const poolVoces = ["Fenrir", "Aoede", "Charon", "Kore", "Puck"];
  const nuevaVoz = poolVoces[asignaciones.size % poolVoces.length];
  asignaciones.set(norm, nuevaVoz);
  return nuevaVoz;
};

/**
 * Genera audio/voz real de una historia o texto utilizando la API de Google Gemini (Google AI Studio)
 * y lo sube automáticamente a AWS S3 en formato WAV (24kHz, 16-bit).
 * Soporta tanto texto individual como historias multivoz (array de diálogos con diferentes personajes).
 */
export const generarVozGeminiController = async (ctx: any) => {
  try {
    let body: any = {};
    try {
      if (typeof ctx.request.body?.json === "function") {
        body = await ctx.request.body.json();
      } else if (typeof ctx.request.body === "function") {
        const result = ctx.request.body({ type: "json" });
        body = await result.value;
      }
    } catch {
      body = {};
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("GEMINI_KEY") ||
      Deno.env.get("GOOGLE_API_KEY") ||
      "";

    if (!geminiKey) {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        error:
          "No se encontró GEMINI_API_KEY en las variables de entorno del servidor.",
      };
      return;
    }

    const dialogos = Array.isArray(body.HISTORIA)
      ? body.HISTORIA
      : Array.isArray(body.historia)
      ? body.historia
      : Array.isArray(body.dialogos)
      ? body.dialogos
      : Array.isArray(body.segments)
      ? body.segments
      : null;

    // ========================================================
    // CASO 1: HISTORIA MULTIVOZ (UNIFICADA EN 1 SOLA PETICIÓN A GEMINI)
    // ========================================================
    if (dialogos && dialogos.length > 0) {
      console.log(
        `🎙️ Unificando ${dialogos.length} fragmentos en 1 SOLA petición a Gemini (Ahorro de cuota gratis)...`,
      );

      const listaPersonajes: string[] = [];
      const lineasGuion: string[] = [];

      for (const item of dialogos) {
        if (typeof item === "string" && item.trim()) {
          lineasGuion.push(item.trim());
          continue;
        }

        const rawPersonaje = String(
          item.personaje || item.Personaje || item.PERSONAJE || item.name ||
            item.v || item.voice || item.voz || "NARRADOR",
        ).trim();

        const rawTexto = String(
          item.texto || item.Texto || item.TEXTO || item.text || item.t || "",
        ).trim();

        if (!rawTexto) continue;

        const estilo = item.estilo || item.emocion
          ? ` (${item.estilo || item.emocion})`
          : "";
        lineasGuion.push(
          `${rawPersonaje.toUpperCase()}${estilo}: "${rawTexto}"`,
        );

        if (!listaPersonajes.includes(rawPersonaje)) {
          listaPersonajes.push(rawPersonaje);
        }
      }

      if (lineasGuion.length === 0) {
        ctx.response.status = 400;
        ctx.response.body = {
          success: false,
          error:
            "No se encontró ningún texto válido en los fragmentos de la historia.",
        };
        return;
      }

      // Guion completo unificado con instrucciones de actuación y cambio de voces
      const guionUnificado = lineasGuion.join("\n\n");
      const vozPrincipal = VOCES_GEMINI_MAP[
        String(body.voz || body.voice || listaPersonajes[0] || "Aoede")
          .toUpperCase()
      ] || "Aoede";

      const promptInstruccion =
        `Actúa y narra el siguiente guion dramatizado con locución cinematográfica profesional. 
Modula y adapta la entonación, ritmo y emoción para que cada personaje se distinga claramente:

${guionUnificado}`;

      console.log(
        `  -> Enviando guion completo (${lineasGuion.length} diálogos) en 1 sola llamada a Gemini (Voz base: ${vozPrincipal})...`,
      );

      const { pcmBytes, modelo } = await sintetizarAudioGeminiPCM(
        promptInstruccion,
        vozPrincipal,
        geminiKey,
        body.estilo || body.instrucciones ||
          "actuación dramática con cambios de emoción según el personaje",
      );

      // Empaquetar a WAV estándar 24kHz 16-bit
      const wavBytes = pcmToWav(pcmBytes, 24000, 1, 16);
      const fileName = `historia_gemini_${Date.now()}.wav`;
      const s3Url = await uploadToS3(wavBytes, fileName, "audio/wav", "google");

      console.log(
        `✅ Audio de historia completa generado con 1 sola llamada y subido a S3: ${s3Url}`,
      );

      ctx.response.status = 200;
      ctx.response.headers.set("Content-Type", "application/json");
      ctx.response.body = {
        success: true,
        audioUrl: s3Url,
        url: s3Url,
        tipo: "HISTORIA_COMPLETA_1_PETICION",
        segmentosProcesados: lineasGuion.length,
        personajes: listaPersonajes,
        modelo: modelo,
        mensaje:
          "Audio completo de la historia generado con éxito en 1 sola petición a Google Gemini",
      };
      return;
    }

    // ========================================================
    // CASO 2: TEXTO INDIVIDUAL O HISTORIA EN STRING
    // ========================================================
    let textoANarrar = "";
    if (typeof body.texto === "string" && body.texto.trim()) {
      textoANarrar = body.texto.trim();
    } else if (typeof body.text === "string" && body.text.trim()) {
      textoANarrar = body.text.trim();
    } else if (typeof body.historia === "string" && body.historia.trim()) {
      textoANarrar = body.historia.trim();
    }

    if (!textoANarrar || textoANarrar.trim().length === 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error:
          "Debes proporcionar el campo 'HISTORIA' (array de diálogos) o el campo 'texto'/'historia' (string).",
      };
      return;
    }

    const rawVoice = String(body.voz || body.voice || body.personaje || "Aoede")
      .trim();
    const normalizedKey = rawVoice.toUpperCase();
    const vozSeleccionada = VOCES_GEMINI_MAP[normalizedKey] || rawVoice ||
      "Aoede";
    const estilo = body.estilo || body.instrucciones || body.prompt || "";

    console.log(
      `🎙️ Solicitando audio a Google Gemini (Voz: ${vozSeleccionada})...`,
    );

    const { pcmBytes, modelo } = await sintetizarAudioGeminiPCM(
      textoANarrar,
      vozSeleccionada,
      geminiKey,
      estilo,
    );

    // Empaquetar a WAV estándar 24kHz 16-bit
    const wavBytes = pcmToWav(pcmBytes, 24000, 1, 16);
    const fileName = `historia_gemini_${Date.now()}.wav`;
    const s3Url = await uploadToS3(wavBytes, fileName, "audio/wav", "google");

    console.log(`✅ Audio Gemini generado y subido a S3: ${s3Url}`);

    ctx.response.status = 200;
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = {
      success: true,
      audioUrl: s3Url,
      url: s3Url,
      voz: vozSeleccionada,
      modelo: modelo,
      mimeType: "audio/wav",
      caracteresTexto: textoANarrar.length,
      mensaje:
        "Audio generado con Google Gemini y guardado exitosamente en AWS S3",
    };
  } catch (error) {
    console.error("❌ Error crítico en generarVozGeminiController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Error al sintetizar voz con Google Gemini",
    };
  }
};

export const generarAudioGeminiController = generarVozGeminiController;

// ==========================================
// CATÁLOGO DE VOCES GRATUITAS DE GOOGLE GEMINI
// ==========================================

export const LISTA_VOCES_GEMINI = [
  {
    id: "Aoede",
    nombre: "Aoede",
    genero: "Femenino",
    multilingue: true,
    deteccionAutomaticaIdioma: true,
    idiomasPrincipales: [
      "Español",
      "English",
      "Português",
      "Français",
      "Deutsch",
      "Italiano",
      "日本語",
    ],
    codigosIdioma: ["es", "en", "pt", "fr", "de", "it", "ja"],
    descripcion:
      "Voz expresiva, teatral y dramática. Ideal para protagonistas, diálogos emotivos y narraciones dinámicas.",
    tono: "Expresiva / Actriz",
    gratis: true,
    proveedor: "Google Gemini",
    ejemploPersonaje: "BELLA, NARRADORA, MUJER, PROTAGONISTA",
  },
  {
    id: "Charon",
    nombre: "Charon",
    genero: "Masculino",
    multilingue: true,
    deteccionAutomaticaIdioma: true,
    idiomasPrincipales: [
      "Español",
      "English",
      "Português",
      "Français",
      "Deutsch",
      "Italiano",
      "日本語",
    ],
    codigosIdioma: ["es", "en", "pt", "fr", "de", "it", "ja"],
    descripcion:
      "Voz profunda, sobria y misteriosa. Perfecta para suspenso, terror, documentales y narrador principal.",
    tono: "Grave / Suspenso / Narrador",
    gratis: true,
    proveedor: "Google Gemini",
    ejemploPersonaje: "NARRADOR, GEORGE, MONSTRUO, MISTERIO",
  },
  {
    id: "Fenrir",
    nombre: "Fenrir",
    genero: "Masculino",
    multilingue: true,
    deteccionAutomaticaIdioma: true,
    idiomasPrincipales: [
      "Español",
      "English",
      "Português",
      "Français",
      "Deutsch",
      "Italiano",
      "日本語",
    ],
    codigosIdioma: ["es", "en", "pt", "fr", "de", "it", "ja"],
    descripcion:
      "Voz potente, autoritaria y firme. Excelente para acción, héroes, villanos y momentos de alta tensión.",
    tono: "Fuerte / Épico / Autoritario",
    gratis: true,
    proveedor: "Google Gemini",
    ejemploPersonaje: "ADAM, HOMBRE, GUERRERO, VILLANO",
  },
  {
    id: "Kore",
    nombre: "Kore",
    genero: "Femenino",
    multilingue: true,
    deteccionAutomaticaIdioma: true,
    idiomasPrincipales: [
      "Español",
      "English",
      "Português",
      "Français",
      "Deutsch",
      "Italiano",
      "日本語",
    ],
    codigosIdioma: ["es", "en", "pt", "fr", "de", "it", "ja"],
    descripcion:
      "Voz suave, cálida, dulce y relajante. Ideal para historias reflexivas, romance y personajes amables.",
    tono: "Dulce / Cálida / Serena",
    gratis: true,
    proveedor: "Google Gemini",
    ejemploPersonaje: "DULCE, SERENA, AMIGA, MADRE",
  },
  {
    id: "Puck",
    nombre: "Puck",
    genero: "Masculino",
    multilingue: true,
    deteccionAutomaticaIdioma: true,
    idiomasPrincipales: [
      "Español",
      "English",
      "Português",
      "Français",
      "Deutsch",
      "Italiano",
      "日本語",
    ],
    codigosIdioma: ["es", "en", "pt", "fr", "de", "it", "ja"],
    descripcion:
      "Voz juvenil, fresca, animada y conversacional. Perfecta para comedia, personajes jóvenes y dinámicos.",
    tono: "Joven / Alegre / Enérgica",
    gratis: true,
    proveedor: "Google Gemini",
    ejemploPersonaje: "JOVEN, ADOLESCENTE, AVENTURERO, COMEDIA",
  },
];

/**
 * Retorna el catálogo completo de voces neuronales gratuitas disponibles en Google Gemini
 */
export const obtenerVocesGeminiController = (ctx: any) => {
  ctx.response.status = 200;
  ctx.response.headers.set("Content-Type", "application/json");
  ctx.response.body = {
    success: true,
    total: LISTA_VOCES_GEMINI.length,
    proveedor: "Google Gemini API (AI Studio)",
    gratis: true,
    soporteMultilingue:
      "Todas las voces detectan automáticamente el idioma del texto (Español, Inglés, Portugués, Francés, Alemán, Italiano, Japonés, etc.) sin necesidad de configuración adicional.",
    voces: LISTA_VOCES_GEMINI,
  };
};

/**
 * Endpoint de monitoreo / Health-Check:
 * Verifica la conexión en tiempo real con Google Gemini API, mide la latencia y detalla los límites de la capa gratuita.
 */
export const verificarEstadoGeminiController = async (ctx: any) => {
  const inicio = Date.now();
  const apiKey = Deno.env.get("GEMINI_API_KEY") ||
    Deno.env.get("GEMINI_KEY") ||
    Deno.env.get("GOOGLE_API_KEY") ||
    "";

  if (!apiKey) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      estado: "ERROR_CONFIGURACION",
      mensaje: "No se ha configurado GEMINI_API_KEY en el servidor",
    };
    return;
  }

  try {
    // Ping ultra ligero a Gemini para validar conectividad y credenciales
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=1`;
    const res = await fetch(url);
    const data = await res.json();
    const latencia = Date.now() - inicio;

    if (data.error) {
      ctx.response.status = 502;
      ctx.response.body = {
        success: false,
        estado: "ERROR_API",
        latenciaMs: latencia,
        error: data.error.message || "Error al conectar con Google Gemini",
      };
      return;
    }

    ctx.response.status = 200;
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = {
      success: true,
      estado: "ONLINE",
      proveedor: "Google Gemini API (Google AI Studio)",
      latenciaMs: latencia,
      limitesGoogle: {
        textoEIdioma: "1,500 peticiones/día (RPD) y 1,000,000 tokens/minuto",
        audioTTSPreviewGratis:
          "10 peticiones/día (en cuentas nuevas sin facturación vinculada)",
        audioTTSConFacturacion:
          "1,500 peticiones/día (activando Pay-As-You-Go con créditos de Google)",
      },
      vocesActivas: LISTA_VOCES_GEMINI.map((v) => v.nombre),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      estado: "OFFLINE",
      latenciaMs: Date.now() - inicio,
      error: error instanceof Error ? error.message : "Error de red o conexión",
    };
  }
}; // ==========================================
// MOTOR DE IA: MICROSOFT AZURE COGNITIVE SERVICES SPEECH (NEURAL TTS)
// ==========================================

export interface AzureVoice {
  key: string;
  id: string;
  nombre: string;
  alias: string;
  idioma: "Español" | "Inglés";
  codigoIdioma: string;
  region: string;
  genero: "mujer" | "hombre";
  motor: "neural";
  estilos?: string[];
  descripcion: string;
}

export const CATALOGO_VOCES_AZURE: AzureVoice[] = [
  // 🇲🇽 Voces en Español (México)
  {
    key: "VOICE_0",
    id: "es-MX-DaliaNeural",
    nombre: "Dalia (México - Neural)",
    alias: "Dalia",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "mujer",
    motor: "neural",
    estilos: ["chat", "cheerful", "sad", "whispering"],
    descripcion:
      "Voz femenina principal, dulce, expresiva y muy versátil para historias y diálogos.",
  },
  {
    key: "VOICE_1",
    id: "es-MX-JorgeNeural",
    nombre: "Jorge (México - Neural)",
    alias: "Jorge",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "hombre",
    motor: "neural",
    estilos: ["cheerful", "chat", "sad", "whispering"],
    descripcion:
      "Voz masculina principal, cálida, natural y excelente para narraciones.",
  },
  {
    key: "VOICE_2",
    id: "es-MX-BeatrizNeural",
    nombre: "Beatriz (México - Neural)",
    alias: "Beatriz",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina madura, formal y clara.",
  },
  {
    key: "VOICE_3",
    id: "es-MX-CandelaNeural",
    nombre: "Candela (México - Neural)",
    alias: "Candela",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina joven, alegre y dinámica.",
  },
  {
    key: "VOICE_4",
    id: "es-MX-CarlotaNeural",
    nombre: "Carlota (México - Neural)",
    alias: "Carlota",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina conversacional y suave.",
  },
  {
    key: "VOICE_5",
    id: "es-MX-CecilioNeural",
    nombre: "Cecilio (México - Neural)",
    alias: "Cecilio",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina profunda y autoritaria.",
  },
  {
    key: "VOICE_6",
    id: "es-MX-GerardoNeural",
    nombre: "Gerardo (México - Neural)",
    alias: "Gerardo",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina madura y confiable.",
  },
  {
    key: "VOICE_7",
    id: "es-MX-LarissaNeural",
    nombre: "Larissa (México - Neural)",
    alias: "Larissa",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina juvenil y vivaz.",
  },
  {
    key: "VOICE_8",
    id: "es-MX-LibertoNeural",
    nombre: "Liberto (México - Neural)",
    alias: "Liberto",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina enérgica y moderna.",
  },
  {
    key: "VOICE_9",
    id: "es-MX-LucianoNeural",
    nombre: "Luciano (México - Neural)",
    alias: "Luciano",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina suave y reflexiva.",
  },
  {
    key: "VOICE_10",
    id: "es-MX-MarinaNeural",
    nombre: "Marina (México - Neural)",
    alias: "Marina",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina amena y melodiosa.",
  },
  {
    key: "VOICE_11",
    id: "es-MX-NuriaNeural",
    nombre: "Nuria (México - Neural)",
    alias: "Nuria",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina entusiasta y brillante.",
  },
  {
    key: "VOICE_12",
    id: "es-MX-PelayoNeural",
    nombre: "Pelayo (México - Neural)",
    alias: "Pelayo",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina grave y dramática.",
  },
  {
    key: "VOICE_13",
    id: "es-MX-RenataNeural",
    nombre: "Renata (México - Neural)",
    alias: "Renata",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina dulce y empática.",
  },
  {
    key: "VOICE_14",
    id: "es-MX-YagoNeural",
    nombre: "Yago (México - Neural)",
    alias: "Yago",
    idioma: "Español",
    codigoIdioma: "es-MX",
    region: "México",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina joven y fresca.",
  },

  // 🇪🇸 Voces en Español (España)
  {
    key: "VOICE_15",
    id: "es-ES-AlvaroNeural",
    nombre: "Álvaro (España - Neural)",
    alias: "Alvaro",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz narrativa masculina por excelencia en castellano.",
  },
  {
    key: "VOICE_16",
    id: "es-ES-ElviraNeural",
    nombre: "Elvira (España - Neural)",
    alias: "Elvira",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz narrativa femenina clásica y novelesca.",
  },
  {
    key: "VOICE_17",
    id: "es-ES-AbrilNeural",
    nombre: "Abril (España - Neural)",
    alias: "Abril",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina joven de España.",
  },
  {
    key: "VOICE_18",
    id: "es-ES-ArnauNeural",
    nombre: "Arnau (España - Neural)",
    alias: "Arnau",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina contemporánea de España.",
  },
  {
    key: "VOICE_19",
    id: "es-ES-DarioNeural",
    nombre: "Darío (España - Neural)",
    alias: "Dario",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina clara y articulada.",
  },
  {
    key: "VOICE_20",
    id: "es-ES-EliasNeural",
    nombre: "Elías (España - Neural)",
    alias: "Elias",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina sobria y elegante.",
  },
  {
    key: "VOICE_21",
    id: "es-ES-EstrellaNeural",
    nombre: "Estrella (España - Neural)",
    alias: "Estrella",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina brillante y animada.",
  },
  {
    key: "VOICE_22",
    id: "es-ES-IreneNeural",
    nombre: "Irene (España - Neural)",
    alias: "Irene",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina calmada y reflexiva.",
  },
  {
    key: "VOICE_23",
    id: "es-ES-LaiaNeural",
    nombre: "Laia (España - Neural)",
    alias: "Laia",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina moderna y cercana.",
  },
  {
    key: "VOICE_24",
    id: "es-ES-LiaNeural",
    nombre: "Lía (España - Neural)",
    alias: "Lia",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina juvenil y expresiva.",
  },
  {
    key: "VOICE_25",
    id: "es-ES-NilNeural",
    nombre: "Nil (España - Neural)",
    alias: "Nil",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina jovial y espontánea.",
  },
  {
    key: "VOICE_26",
    id: "es-ES-SaulNeural",
    nombre: "Saúl (España - Neural)",
    alias: "Saul",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina enérgica.",
  },
  {
    key: "VOICE_27",
    id: "es-ES-TeoNeural",
    nombre: "Teo (España - Neural)",
    alias: "Teo",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina cálida y amigable.",
  },
  {
    key: "VOICE_28",
    id: "es-ES-TrianaNeural",
    nombre: "Triana (España - Neural)",
    alias: "Triana",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina con acento marcado andaluz.",
  },
  {
    key: "VOICE_29",
    id: "es-ES-VeraNeural",
    nombre: "Vera (España - Neural)",
    alias: "Vera",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina íntima y emotiva.",
  },
  {
    key: "VOICE_30",
    id: "es-ES-XimenaNeural",
    nombre: "Ximena (España - Neural)",
    alias: "Ximena",
    idioma: "Español",
    codigoIdioma: "es-ES",
    region: "España",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina firme y ejecutiva.",
  },

  // 🇺🇸 Voces en Español (Estados Unidos)
  {
    key: "VOICE_31",
    id: "es-US-PalomaNeural",
    nombre: "Paloma (EE.UU. - Neural)",
    alias: "Paloma",
    idioma: "Español",
    codigoIdioma: "es-US",
    region: "Estados Unidos",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina latina de Estados Unidos.",
  },
  {
    key: "VOICE_32",
    id: "es-US-AlonsoNeural",
    nombre: "Alonso (EE.UU. - Neural)",
    alias: "Alonso",
    idioma: "Español",
    codigoIdioma: "es-US",
    region: "Estados Unidos",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina latina de Estados Unidos.",
  },

  // 🇨🇴 Voces en Español (Colombia)
  {
    key: "VOICE_33",
    id: "es-CO-SalomeNeural",
    nombre: "Salomé (Colombia - Neural)",
    alias: "Salome",
    idioma: "Español",
    codigoIdioma: "es-CO",
    region: "Colombia",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina colombiana, melodiosa y cálida.",
  },
  {
    key: "VOICE_34",
    id: "es-CO-GonzaloNeural",
    nombre: "Gonzalo (Colombia - Neural)",
    alias: "Gonzalo",
    idioma: "Español",
    codigoIdioma: "es-CO",
    region: "Colombia",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina colombiana, neutra y agradable.",
  },

  // 🇦🇷 Voces en Español (Argentina)
  {
    key: "VOICE_35",
    id: "es-AR-ElenaNeural",
    nombre: "Elena (Argentina - Neural)",
    alias: "Elena",
    idioma: "Español",
    codigoIdioma: "es-AR",
    region: "Argentina",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina rioplatense natural.",
  },
  {
    key: "VOICE_36",
    id: "es-AR-TomasNeural",
    nombre: "Tomás (Argentina - Neural)",
    alias: "Tomas",
    idioma: "Español",
    codigoIdioma: "es-AR",
    region: "Argentina",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina rioplatense expresiva.",
  },

  // 🇨🇱 Voces en Español (Chile)
  {
    key: "VOICE_37",
    id: "es-CL-CatalinaNeural",
    nombre: "Catalina (Chile - Neural)",
    alias: "Catalina",
    idioma: "Español",
    codigoIdioma: "es-CL",
    region: "Chile",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina chilena suave.",
  },
  {
    key: "VOICE_38",
    id: "es-CL-LorenzoNeural",
    nombre: "Lorenzo (Chile - Neural)",
    alias: "Lorenzo",
    idioma: "Español",
    codigoIdioma: "es-CL",
    region: "Chile",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina chilena formal.",
  },

  // 🇵🇪 Voces en Español (Perú)
  {
    key: "VOICE_39",
    id: "es-PE-CamilaNeural",
    nombre: "Camila (Perú - Neural)",
    alias: "Camila",
    idioma: "Español",
    codigoIdioma: "es-PE",
    region: "Perú",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina peruana clara y amable.",
  },
  {
    key: "VOICE_40",
    id: "es-PE-AlexNeural",
    nombre: "Alex (Perú - Neural)",
    alias: "Alex",
    idioma: "Español",
    codigoIdioma: "es-PE",
    region: "Perú",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina peruana neutra y fluida.",
  },

  // 🇺🇸 Voces en Inglés (Estados Unidos)
  {
    key: "VOICE_41",
    id: "en-US-JennyNeural",
    nombre: "Jenny (US - Neural)",
    alias: "Jenny",
    idioma: "Inglés",
    codigoIdioma: "en-US",
    region: "Estados Unidos",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina en inglés más popular y expresiva.",
  },
  {
    key: "VOICE_42",
    id: "en-US-GuyNeural",
    nombre: "Guy (US - Neural)",
    alias: "Guy",
    idioma: "Inglés",
    codigoIdioma: "en-US",
    region: "Estados Unidos",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina en inglés estándar y cinematográfica.",
  },
  {
    key: "VOICE_43",
    id: "en-US-AriaNeural",
    nombre: "Aria (US - Neural)",
    alias: "Aria",
    idioma: "Inglés",
    codigoIdioma: "en-US",
    region: "Estados Unidos",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina versátil, dramática y periodística.",
  },
  {
    key: "VOICE_44",
    id: "en-US-DavisNeural",
    nombre: "Davis (US - Neural)",
    alias: "Davis",
    idioma: "Inglés",
    codigoIdioma: "en-US",
    region: "Estados Unidos",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina profunda y calmada.",
  },
  {
    key: "VOICE_45",
    id: "en-US-AmberNeural",
    nombre: "Amber (US - Neural)",
    alias: "Amber",
    idioma: "Inglés",
    codigoIdioma: "en-US",
    region: "Estados Unidos",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina cálida y juvenil.",
  },
  {
    key: "VOICE_46",
    id: "en-US-AndrewNeural",
    nombre: "Andrew (US - Neural)",
    alias: "Andrew",
    idioma: "Inglés",
    codigoIdioma: "en-US",
    region: "Estados Unidos",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina amigable y confiable.",
  },

  // 🇬🇧 Voces en Inglés (Reino Unido)
  {
    key: "VOICE_47",
    id: "en-GB-SoniaNeural",
    nombre: "Sonia (UK - Neural)",
    alias: "Sonia",
    idioma: "Inglés",
    codigoIdioma: "en-GB",
    region: "Reino Unido",
    genero: "mujer",
    motor: "neural",
    descripcion: "Voz femenina británica elegante y clara.",
  },
  {
    key: "VOICE_48",
    id: "en-GB-RyanNeural",
    nombre: "Ryan (UK - Neural)",
    alias: "Ryan",
    idioma: "Inglés",
    codigoIdioma: "en-GB",
    region: "Reino Unido",
    genero: "hombre",
    motor: "neural",
    descripcion: "Voz masculina británica conversacional.",
  },
];

const VOCES_AZURE_ALIAS_MAP: Record<string, string> = {
  // Alias de personajes comunes
  "DALIA": "es-MX-DaliaNeural",
  "JORGE": "es-MX-JorgeNeural",
  "ALVARO": "es-ES-AlvaroNeural",
  "ELVIRA": "es-ES-ElviraNeural",
  "NARRADOR": "es-ES-AlvaroNeural",
  "NARRADORA": "es-MX-DaliaNeural",
  "HOMBRE": "es-MX-JorgeNeural",
  "MUJER": "es-MX-DaliaNeural",
  "ADAM": "es-MX-JorgeNeural",
  "BELLA": "es-MX-DaliaNeural",
  "GEORGE": "es-ES-AlvaroNeural",
  "JENNY": "en-US-JennyNeural",
  "GUY": "en-US-GuyNeural",
  "ARIA": "en-US-AriaNeural",
  "SALOME": "es-CO-SalomeNeural",
  "GONZALO": "es-CO-GonzaloNeural",
  "CAMILA": "es-PE-CamilaNeural",
  "ALEX": "es-PE-AlexNeural",
  "ELENA": "es-AR-ElenaNeural",
  "TOMAS": "es-AR-TomasNeural",
  "PALOMA": "es-US-PalomaNeural",
  "ALONSO": "es-US-AlonsoNeural",
};

// Indexar todas las voces del catálogo por Key y por Alias
for (const v of CATALOGO_VOCES_AZURE) {
  VOCES_AZURE_ALIAS_MAP[v.key.toUpperCase()] = v.id;
  VOCES_AZURE_ALIAS_MAP[v.alias.toUpperCase()] = v.id;
  VOCES_AZURE_ALIAS_MAP[v.id.toUpperCase()] = v.id;
}

/**
 * Resuelve el identificador de voz oficial de Azure Neural
 */
const resolverVozAzure = (rawVoice: string): string => {
  if (!rawVoice) return "es-MX-DaliaNeural";
  const trimmed = String(rawVoice).trim();
  const upper = trimmed.toUpperCase();

  if (VOCES_AZURE_ALIAS_MAP[upper]) {
    return VOCES_AZURE_ALIAS_MAP[upper];
  }

  // Si ya es un ID de Azure (ej: "es-MX-DaliaNeural" o contiene "Neural")
  if (trimmed.includes("Neural") || /^[a-z]{2}-[A-Z]{2}-/i.test(trimmed)) {
    return trimmed;
  }

  return "es-MX-DaliaNeural";
};

/**
 * Escapa caracteres especiales para SSML seguro
 */
const escaparSSML = (str: string): string => {
  return str
    .replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

/**
 * GET /api/ia/azure-estado
 * Health-Check en tiempo real de Microsoft Azure Speech
 */
export const verificarEstadoAzureController = async (ctx: any) => {
  const inicio = Date.now();
  const apiKey = Deno.env.get("AZURE_SPEECH_KEY") ||
    Deno.env.get("AZURE_API_KEY");
  const region = Deno.env.get("AZURE_SPEECH_REGION");

  if (!apiKey) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      estado: "ERROR_CONFIGURACION",
      mensaje:
        "No se ha configurado AZURE_SPEECH_KEY en las variables de entorno",
    };
    return;
  }

  try {
    const res = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
      {
        headers: {
          "Ocp-Apim-Subscription-Key": apiKey,
        },
      },
    );

    const latencia = Date.now() - inicio;

    if (!res.ok) {
      const errTxt = await res.text();
      ctx.response.status = 502;
      ctx.response.body = {
        success: false,
        estado: "ERROR_API",
        latenciaMs: latencia,
        error: errTxt || "No se pudo autenticar con Azure Speech API",
      };
      return;
    }

    const voices = await res.json();
    const vocesEspanol = voices.filter((v: any) => v.Locale?.startsWith("es-"));
    const vocesIngles = voices.filter((v: any) => v.Locale?.startsWith("en-"));

    ctx.response.status = 200;
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = {
      success: true,
      estado: "ONLINE",
      proveedor: "Microsoft Azure Cognitive Services Speech",
      region: region,
      latenciaMs: latencia,
      estadisticas: {
        totalVocesDisponibles: voices.length,
        vocesEspanol: vocesEspanol.length,
        vocesIngles: vocesIngles.length,
        vocesCatalogoHomero: CATALOGO_VOCES_AZURE.length,
      },
      ventajas: [
        "Soporte de múltiples voces en una sola petición SSML",
        "Calidad Neural de estudio con pronunciación nativa",
        "Salida directa en formato MP3 24kHz",
      ],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      estado: "OFFLINE",
      latenciaMs: Date.now() - inicio,
      error: error instanceof Error
        ? error.message
        : "Error de red al conectar con Azure",
    };
  }
};

/**
 * GET /api/ia/azure-voces
 * Retorna el catálogo curado de voces neuronales de Azure organizado por idioma y país
 */
export const obtenerVocesAzureController = (ctx: any) => {
  const espanol = CATALOGO_VOCES_AZURE.filter((v) =>
    v.codigoIdioma.startsWith("es-")
  );
  const ingles = CATALOGO_VOCES_AZURE.filter((v) =>
    v.codigoIdioma.startsWith("en-")
  );

  ctx.response.status = 200;
  ctx.response.headers.set("Content-Type", "application/json");
  ctx.response.body = {
    success: true,
    total: CATALOGO_VOCES_AZURE.length,
    proveedor: "Microsoft Azure Cognitive Services Speech (Neural)",
    region: Deno.env.get("AZURE_SPEECH_REGION") || "canadacentral",
    idiomas: {
      espanol: {
        total: espanol.length,
        voces: espanol,
      },
      ingles: {
        total: ingles.length,
        voces: ingles,
      },
    },
    todas: CATALOGO_VOCES_AZURE,
  };
};

/**
 * POST /api/ia/azure-voz
 * Genera el audio de una historia completa (multivoz con diálogos) o de un texto individual
 * usando Microsoft Azure Neural TTS y sube el MP3 final a AWS S3.
 */
export const generarVozAzureController = async (ctx: any) => {
  const inicio = Date.now();
  try {
    let body: any = {};
    try {
      if (typeof ctx.request.body?.json === "function") {
        body = await ctx.request.body.json();
      } else if (typeof ctx.request.body === "function") {
        const result = ctx.request.body({ type: "json" });
        body = await result.value;
      }
    } catch {
      body = {};
    }

    const apiKey = Deno.env.get("AZURE_SPEECH_KEY") ||
      Deno.env.get("AZURE_API_KEY");
    const region = Deno.env.get("AZURE_SPEECH_REGION");

    if (!apiKey) {
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        error: "No se ha configurado AZURE_SPEECH_KEY en el servidor",
      };
      return;
    }

    const dialogos = Array.isArray(body.HISTORIA)
      ? body.HISTORIA
      : Array.isArray(body.historia)
      ? body.historia
      : Array.isArray(body.dialogos)
      ? body.dialogos
      : Array.isArray(body.segments)
      ? body.segments
      : null;

    let ssmlContent = "";
    let personajesUsados: string[] = [];
    let totalSegmentos = 0;

    // ========================================================
    // CASO 1: HISTORIA MULTIVOZ (ARRAY DE DIÁLOGOS O PERSONAJES)
    // ========================================================
    if (dialogos && dialogos.length > 0) {
      const voiceBlocks: string[] = [];

      for (const item of dialogos) {
        if (typeof item === "string" && item.trim()) {
          const vozDefault = resolverVozAzure(
            body.voz || body.voice || "VOICE_0",
          );
          const safeText = escaparSSML(item.trim());
          voiceBlocks.push(
            `  <voice name="${vozDefault}">\n    ${safeText}\n    <break time="300ms"/>\n  </voice>`,
          );
          totalSegmentos++;
          continue;
        }

        const rawPersonaje = item.personaje || item.Personaje ||
          item.PERSONAJE ||
          item.v || item.voice || item.voz || item.name || "VOICE_0";

        const rawTexto = item.texto || item.Texto || item.TEXTO ||
          item.text || item.t || "";

        if (!String(rawTexto).trim()) continue;

        const resolvedVoice = resolverVozAzure(rawPersonaje);
        const safeText = escaparSSML(String(rawTexto).trim());

        voiceBlocks.push(
          `  <voice name="${resolvedVoice}">\n    ${safeText}\n    <break time="350ms"/>\n  </voice>`,
        );
        totalSegmentos++;

        if (!personajesUsados.includes(resolvedVoice)) {
          personajesUsados.push(resolvedVoice);
        }
      }

      if (voiceBlocks.length === 0) {
        ctx.response.status = 400;
        ctx.response.body = {
          success: false,
          error:
            "No se encontró ningún texto válido en los fragmentos de la historia.",
        };
        return;
      }

      ssmlContent =
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-MX">\n${
          voiceBlocks.join("\n")
        }\n</speak>`;
    } else {
      // ========================================================
      // CASO 2: TEXTO INDIVIDUAL O HISTORIA EN STRING
      // ========================================================
      let textoANarrar = "";
      if (typeof body.texto === "string" && body.texto.trim()) {
        textoANarrar = body.texto.trim();
      } else if (typeof body.text === "string" && body.text.trim()) {
        textoANarrar = body.text.trim();
      } else if (typeof body.historia === "string" && body.historia.trim()) {
        textoANarrar = body.historia.trim();
      }

      if (!textoANarrar) {
        ctx.response.status = 400;
        ctx.response.body = {
          success: false,
          error:
            "Debes enviar un array 'HISTORIA'/'dialogos' o un campo 'texto'/'historia'.",
        };
        return;
      }

      const rawVoice = body.voz || body.voice || body.personaje || "VOICE_0";
      const resolvedVoice = resolverVozAzure(rawVoice);
      const safeText = escaparSSML(textoANarrar);

      personajesUsados.push(resolvedVoice);
      totalSegmentos = 1;

      ssmlContent =
        `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-MX">\n  <voice name="${resolvedVoice}">\n    ${safeText}\n  </voice>\n</speak>`;
    }

    console.log(
      `🎙️ Enviando ${totalSegmentos} fragmentos a Microsoft Azure Neural TTS (${region})...`,
    );

    // Llamada directa a Azure Speech REST API
    const azureUrl =
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const res = await fetch(azureUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "HomeroDenoApp",
      },
      body: ssmlContent,
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`❌ Error en Azure TTS [${res.status}]:`, errBody);
      ctx.response.status = res.status;
      ctx.response.body = {
        success: false,
        error: `Error de Azure Speech (${res.status}): ${errBody}`,
      };
      return;
    }

    const audioBytes = new Uint8Array(await res.arrayBuffer());
    console.log(
      `✅ Audio recibido de Azure (${audioBytes.length} bytes). Subiendo a AWS S3...`,
    );

    // Subir a AWS S3 en la carpeta 'azure/'
    const fileName = `historia_azure_${Date.now()}.mp3`;
    const s3Url = await uploadToS3(audioBytes, fileName, "audio/mpeg", "azure");

    const tiempoTotal = Date.now() - inicio;
    console.log(
      `🚀 Audio Azure procesado y subido en ${tiempoTotal}ms -> ${s3Url}`,
    );

    ctx.response.status = 200;
    ctx.response.headers.set("Content-Type", "application/json");
    ctx.response.body = {
      success: true,
      audioUrl: s3Url,
      url: s3Url,
      proveedor: "Microsoft Azure Neural Speech",
      region: region,
      formato: "audio/mpeg (MP3)",
      segmentosProcesados: totalSegmentos,
      vocesUsadas: personajesUsados,
      tiempoProcesamientoMs: tiempoTotal,
      mensaje:
        "Audio generado con éxito mediante Azure Neural TTS y guardado en AWS S3",
    };
  } catch (error) {
    console.error("❌ Error crítico en generarVozAzureController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Error al sintetizar voz con Microsoft Azure",
    };
  }
};
