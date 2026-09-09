import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import { BUCKET_NAME, pollyClient, s3Client } from "../config/aws.ts";
import { SynthesizeSpeechCommand, VoiceId } from "npm:@aws-sdk/client-polly";
import { uploadToS3 } from "../controllers/aws.controller.ts";

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

    const v_map: Record<string, any> = {
      "VOICE_0": { id: "Lupe", engine: "standard" },
      "VOICE_1": { id: "Mia", engine: "standard" },
      "VOICE_2": { id: "Miguel", engine: "standard" },
      "VOICE_3": { id: "Enrique", engine: "standard" },
      "VOICE_4": { id: "Conchita", engine: "standard" },
      "VOICE_5": { id: "Penelope", engine: "standard" },
      "VOICE_6": { id: "Lucia", engine: "standard" },
      "VOICE_7": { id: "Andres", engine: "neural" },
      "VOICE_8": { id: "Lucia", engine: "neural" },
      "VOICE_9": { id: "Lupe", engine: "neural" },
      "VOICE_10": { id: "Mia", engine: "neural" },
      "VOICE_11": { id: "Miguel", engine: "standard" },
      "VOICE_12": { id: "Pedro", engine: "neural" },
      "VOICE_13": { id: "Penelope", engine: "neural" },
      "VOICE_14": { id: "Sergio", engine: "neural" },

      "VOICE_15": { id: "Joanna", engine: "standard" },
      "VOICE_16": { id: "Joanna", engine: "neural" },
      "VOICE_17": { id: "Matthew", engine: "standard" },
      "VOICE_18": { id: "Matthew", engine: "neural" },
      "VOICE_19": { id: "Ivy", engine: "standard" },
      "VOICE_20": { id: "Ivy", engine: "neural" },
      "VOICE_21": { id: "Justin", engine: "standard" },
      "VOICE_22": { id: "Justin", engine: "neural" },
      "VOICE_23": { id: "Kendra", engine: "standard" },
      "VOICE_24": { id: "Kendra", engine: "neural" },
      "VOICE_25": { id: "Kimberly", engine: "standard" },
      "VOICE_26": { id: "Kimberly", engine: "neural" },
      "VOICE_27": { id: "Salli", engine: "standard" },
      "VOICE_28": { id: "Salli", engine: "neural" },
      "VOICE_29": { id: "Joey", engine: "standard" },
      "VOICE_30": { id: "Joey", engine: "neural" },
      "VOICE_31": { id: "Amy", engine: "standard" },
      "VOICE_32": { id: "Amy", engine: "neural" },
      "VOICE_33": { id: "Emma", engine: "standard" },
      "VOICE_34": { id: "Emma", engine: "neural" },
      "VOICE_35": { id: "Brian", engine: "standard" },
      "VOICE_36": { id: "Brian", engine: "neural" },
    };

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

    const longitudTotal = partesAudio.reduce(
      (acc, curr) => acc + curr.length,
      0,
    );
    const audioFinal = new Uint8Array(longitudTotal);

    let offset = 0;
    for (const parte of partesAudio) {
      audioFinal.set(parte, offset);
      offset += parte.length;
    }

    const fileName = `historia_${Date.now()}.mp3`;
    const urlS3 = await uploadToS3(audioFinal, fileName, "audio/mpeg");

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
// DETECTOR DE IDIOMA Y REDACTOR IA CON FALLBACK MULTI-MODELO
// ==========================================

const MODELOS_GROQ_FALLBACK = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "gemma2-9b-it",
  "mixtral-8x7b-32768",
];

/**
 * Llama a Groq probando múltiples modelos en cascada si alguno no está disponible
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
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
      });

      const data = await res.json();
      if (data && !data.error && data.choices?.[0]?.message?.content) {
        return JSON.parse(data.choices[0].message.content.trim());
      }
      ultimoError = data?.error || new Error(`Fallo con modelo ${model}`);
    } catch (err) {
      ultimoError = err;
    }
  }

  throw ultimoError || new Error("No se pudo obtener respuesta de ningún modelo de IA");
};

/**
 * Detector heurístico de idioma local como fallback a prueba de fallos
 */
const detectarIdiomaLocal = (
  texto: string,
): { idioma: string; codigo: string; confianza: number; nombreNativo: string } => {
  const clean = texto.toLowerCase();

  // Caracteres asiáticos o cirílicos
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(clean)) {
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(clean)) {
      return { idioma: "Japonés", codigo: "ja", confianza: 0.98, nombreNativo: "日本語" };
    }
    return { idioma: "Chino", codigo: "zh", confianza: 0.95, nombreNativo: "中文" };
  }
  if (/[\uac00-\ud7af]/.test(clean)) {
    return { idioma: "Coreano", codigo: "ko", confianza: 0.98, nombreNativo: "한국어" };
  }
  if (/[\u0400-\u04ff]/.test(clean)) {
    return { idioma: "Ruso", codigo: "ru", confianza: 0.95, nombreNativo: "Русский" };
  }
  if (/[\u0600-\u06ff]/.test(clean)) {
    return { idioma: "Árabe", codigo: "ar", confianza: 0.95, nombreNativo: "العربية" };
  }

  // Stopwords representativas de idiomas latinos / europeos
  const spanishMatches = (clean.match(/\b(el|la|los|las|un|una|de|del|en|para|por|con|que|es|era|había|una vez|dijo|pero|como|más|cuando|su|sus)\b/g) || []).length;
  const englishMatches = (clean.match(/\b(the|and|is|was|in|on|at|to|for|with|that|this|it|he|she|they|were|had|said|but|from|as|when)\b/g) || []).length;
  const portugueseMatches = (clean.match(/\b(o|os|as|um|uma|do|da|dos|das|no|na|nos|nas|para|com|que|é|era|havia|disse|mas|mais|quando|sua|seu)\b/g) || []).length;
  const frenchMatches = (clean.match(/\b(le|la|les|un|une|des|du|dans|pour|avec|que|qui|est|était|avait|dit|mais|plus|quand|son|sa)\b/g) || []).length;
  const germanMatches = (clean.match(/\b(der|die|das|ein|eine|einer|und|ist|war|in|im|auf|für|mit|dass|sie|er|hatte|sagte|aber|nicht)\b/g) || []).length;
  const italianMatches = (clean.match(/\b(il|lo|la|i|gli|le|un|uno|una|di|del|in|per|con|che|è|era|aveva|disse|ma|più|quando|suo|sua)\b/g) || []).length;

  const scores = [
    { idioma: "Español", codigo: "es", score: spanishMatches, nombreNativo: "Español" },
    { idioma: "Inglés", codigo: "en", score: englishMatches, nombreNativo: "English" },
    { idioma: "Portugués", codigo: "pt", score: portugueseMatches, nombreNativo: "Português" },
    { idioma: "Francés", codigo: "fr", score: frenchMatches, nombreNativo: "Français" },
    { idioma: "Alemán", codigo: "de", score: germanMatches, nombreNativo: "Deutsch" },
    { idioma: "Italiano", codigo: "it", score: italianMatches, nombreNativo: "Italiano" },
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

  return { idioma: "Español", codigo: "es", confianza: 0.70, nombreNativo: "Español" };
};

// ==========================================
// DETECTAR IDIOMA CON IA
// ==========================================
/**
 * Detecta el idioma de un fragmento de texto usando IA (con fallback heurístico garantizado)
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

    const texto = body.texto || body.text || body.fragmento || body.content || "";

    if (!texto || typeof texto !== "string" || texto.trim().length === 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "Debes proporcionar un texto o fragmento para detectar el idioma.",
      };
      return;
    }

    const apiKey = Deno.env.get("IA_KEY") || "";

    const promptSistema = `Eres un detector lingüístico de alta precisión. Tu tarea es identificar el idioma principal del texto proporcionado.
Responde ÚNICAMENTE un objeto JSON válido con la siguiente estructura:
{
  "idioma": "Nombre del idioma en español (ej: Español, Inglés, Portugués, Francés, Alemán, Italiano, Japonés, etc.)",
  "codigo": "Código ISO 639-1 en minúsculas (ej: es, en, pt, fr, de, it, ja, etc.)",
  "confianza": 0.99,
  "nombreNativo": "Nombre del idioma en su propia lengua (ej: Español, English, Português, Français, Deutsch, etc.)"
}`;

    let resultado: any = null;

    if (apiKey) {
      try {
        resultado = await llamarGroqConFallback(
          [
            { role: "system", content: promptSistema },
            { role: "user", content: `Analiza este texto y detecta su idioma:\n"""\n${texto.slice(0, 3000)}\n"""` },
          ],
          apiKey,
          0,
        );
      } catch (iaErr) {
        console.warn("⚠️ Groq IA falló en detección de idioma, utilizando fallback local:", iaErr);
      }
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
        confianza: resultado.confianza ?? 0.95,
        nombreNativo: resultado.nombreNativo || resultado.idioma,
        longitudTexto: texto.length,
      },
    };
  } catch (error) {
    console.error("❌ Error en detectarIdiomaIA:", error);
    // Fallback de emergencia
    const fallback = detectarIdiomaLocal(String(ctx?.request?.body?.texto || ""));
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
// GENERAR DESCRIPCIÓN CON IA (200 CARACTERES)
// ==========================================
/**
 * Genera una descripción/sinopsis atractiva de máximo 200 caracteres para un texto/historia
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

    const texto = body.texto || body.historia || body.text || body.content || "";
    const limiteCaracteres = Math.min(Math.max(Number(body.maxCaracteres || body.limite || 200), 50), 500);

    if (!texto || typeof texto !== "string" || texto.trim().length === 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "Debes proporcionar el texto o historia para generar la descripción.",
      };
      return;
    }

    const apiKey = Deno.env.get("IA_KEY") || "";

    const promptSistema = `Eres un redactor editorial experto en sintetizar historias en micro-sinopsis y ganchos fascinantes para lectores.
Tu objetivo es crear una descripción atractiva, intrigante y concisa que resuma la esencia del texto.

REGLAS OBLIGATORIAS:
1. LONGITUD: La descripción debe tener como MÁXIMO ${limiteCaracteres} caracteres (incluyendo espacios y signos de puntuación). No te pases jamás de ${limiteCaracteres} caracteres.
2. IDIOMA: Escribe la descripción en el MISMO IDIOMA en el que está escrito el texto original.
3. TONO: Intrigante, profesional y cautivador (ideal para la portada/tarjeta de una historia o artículo).
4. FORMATO: Responde ÚNICAMENTE un objeto JSON válido:
{
  "descripcion": "Texto de la sinopsis generado aquí..."
}`;

    let descripcionFinal = "";

    if (apiKey) {
      try {
        const resultado = await llamarGroqConFallback(
          [
            { role: "system", content: promptSistema },
            { role: "user", content: `Genera la sinopsis corta (máx ${limiteCaracteres} caracteres) para este texto:\n"""\n${texto.slice(0, 6000)}\n"""` },
          ],
          apiKey,
          0.6,
        );
        descripcionFinal = String(resultado?.descripcion || "").trim();
      } catch (iaErr) {
        console.warn("⚠️ Groq IA falló en generación de descripción, usando fallback:", iaErr);
      }
    }

    if (!descripcionFinal) {
      // Fallback: recortar texto limpio hasta el límite
      const cleaned = texto.replace(/\s+/g, " ").trim();
      descripcionFinal = cleaned.length <= limiteCaracteres
        ? cleaned
        : cleaned.slice(0, limiteCaracteres - 3).trim() + "...";
    }

    if (descripcionFinal.length > limiteCaracteres) {
      descripcionFinal = descripcionFinal.slice(0, limiteCaracteres - 3).trim() + "...";
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
      error: error instanceof Error ? error.message : "Error al generar la descripción con IA",
    };
  }
};

export const generarDescripcionController = generarDescripcionIA;


