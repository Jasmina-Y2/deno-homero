import { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { BUCKET_NAME, pollyClient, s3Client } from "../config/aws.ts";
import { Context } from "node:vm";
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

export const transformarHistoriaSSML = async (ctx: any) => {
  try {
    const body = await ctx.request.body.json();
    const personajesOriginales = body.personajes;
    const textoOriginal = body.historia;

    const apiKey = Deno.env.get("IA_KEY") || "";

    if (!personajesOriginales || !textoOriginal) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "Faltan personajes o historia",
      };
      return;
    }

    // PROMPT MEJORADO Y DICTATORIAL
    const promptSistema =
      `Eres un procesador de texto estricto para un motor Text-to-Speech.
Tu ÚNICA tarea es dividir la historia en fragmentos secuenciales y asignar el "voice_id" correcto.

REGLAS ABSOLUTAS E INQUEBRANTABLES:
1. PROHIBIDO ELIMINAR TEXTO: Debes procesar el 100% de las palabras y signos de puntuación originales. No resumas, no omitas, ni modifiques una sola letra. Si juntas todos los fragmentos generados, el texto debe ser idéntico al original.
2. ORDEN CRONOLÓGICO ESTRICTO: El arreglo debe seguir el orden exacto del texto de principio a fin. NUNCA pongas un diálogo antes de la narración que lo precede en el texto original.
3. IDENTIFICACIÓN DE VOCES: Usa estrictamente los "voice_id" enviados por el usuario. La narración SIEMPRE lleva la voz del "Narrador". El diálogo entre comillas o comillas simples lleva la voz del personaje que habla.
4. PUNTUACIÓN INTACTA: Si hay signos de puntuación (comas, puntos, guiones) después de un diálogo, pertenecen al narrador. 
Ejemplo de corte perfecto para: "'Hola', dijo ella en voz baja."
- Fragmento 1 (Personaje): "Hola"
- Fragmento 2 (Narrador): ", dijo ella en voz baja."
5. AUDITORÍA DE TEXTO (OBLIGATORIA): Antes de generar el JSON, compara tu resultado con el texto original. Presta especial atención a las palabras que conectan los diálogos (ej: "remató ella", "preguntó con tono robótico") y a los signos de puntuación. Está ESTRICTAMENTE PROHIBIDO que el texto resultante tenga una sola palabra menos o una coma menos que el texto original.

FORMATO DE SALIDA (JSON PURO OBLIGATORIO):
{
  "dialogos": [
    { "t": "fragmento exacto", "v": "VOICE_ID" }
  ]
}`;

    const mensajeUsuario = `
PERSONAJES DISPONIBLES:
${
      JSON.stringify(
        personajesOriginales.map((p: any) => ({
          personaje: p.nombre,
          voice_id: p.voice_id,
        })),
      )
    }

HISTORIA A SEGMENTAR (Procesa el 100% de este texto de principio a fin sin saltarte nada):
"""
${textoOriginal}
"""
`;

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: promptSistema },
            { role: "user", content: mensajeUsuario },
          ],
          temperature: 0, // Temperatura 0 es perfecta para esto
          response_format: { type: "json_object" },
        }),
      },
    );

    const data = await response.json();

    if (data.error) {
      console.error("❌ Detalle del error de Groq:", data.error);
      throw new Error(`Groq falló: ${data.error.message}`);
    }

    if (!data.choices || !data.choices[0]) {
      console.error("❌ Respuesta extraña completa:", data);
      throw new Error("Groq no devolvió el array 'choices'");
    }

    const resultadoEstructurado = JSON.parse(
      data.choices[0].message.content.trim(),
    );

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      personajes: personajesOriginales,
      dialogos: resultadoEstructurado.dialogos,
    };
  } catch (error) {
    console.error("❌ Error con Groq/IA:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : "Error fatal",
    };
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
    const dialogos = body.HISTORIA || body.historia || body.dialogos || body.segments;

    if (!Array.isArray(dialogos) || dialogos.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "Debes enviar un array 'HISTORIA' o 'dialogos' válido y no vacío",
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
