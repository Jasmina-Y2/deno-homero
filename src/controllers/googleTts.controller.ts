// src/controllers/googleTts.controller.ts
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { googleTtsService, DialogueSegmentGoogle } from "../service/googleTts.service.ts";

/**
 * GET /google/status o GET /api/google/status
 * Verifica el estado y conectividad de Google Cloud Text-to-Speech con clave.json y AWS S3
 */
export const getServiceStatus = async (ctx: RouterContext<string>) => {
  const statusInfo = await googleTtsService.checkStatus();
  ctx.response.status = statusInfo.available ? 200 : 503;
  ctx.response.body = {
    success: statusInfo.available,
    ...statusInfo,
  };
};

/**
 * GET /google/voices o GET /api/google/voices
 * Retorna las voces ultra-realistas y los personajes preconfigurados
 */
export const getAvailableVoices = async (ctx: RouterContext<string>) => {
  try {
    const lang = ctx.request.url.searchParams.get("languageCode") ||
      ctx.request.url.searchParams.get("lang") ||
      ctx.request.url.searchParams.get("idioma") ||
      undefined;

    const voicesData = await googleTtsService.getVoices(lang);
    ctx.response.status = 200;
    ctx.response.body = voicesData;
  } catch (error) {
    console.error("❌ Error obteniendo voces de Google:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : "Error interno obteniendo voces",
    };
  }
};

/**
 * POST /api/google/tts o POST /api/google/generate o POST /api/google/multivoz
 * Procesa tanto historias multivoz { "HISTORIA": [...] } como textos individuales y sube el MP3 a AWS S3.
 */
export const generateSpeech = async (ctx: RouterContext<string>) => {
  try {
    let body: any = {};
    try {
      body = await ctx.request.body.json();
    } catch {
      // Si es GET
    }

    const query = ctx.request.url.searchParams;

    // 1. Verificar si viene como HISTORIA / Multivoz
    const rawHistoria: DialogueSegmentGoogle[] =
      body.HISTORIA ||
      body.historia ||
      body.dialogue ||
      body.dialogos ||
      body.conversaciones ||
      body.segments ||
      body.segmentos;

    if (rawHistoria && Array.isArray(rawHistoria) && rawHistoria.length > 0) {
      const folder = body.folder || body.carpeta || query.get("folder") || "HISTORIA";
      const customName = body.fileName || body.nombreArchivo || body.customName;

      const result = await googleTtsService.generateMultiVoiceAndUpload(
        rawHistoria,
        folder,
        customName
      );

      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        mensaje: `Audio multivoz de ${rawHistoria.length} segmentos generado y subido a AWS S3.`,
        ...result,
      };
      return;
    }

    // 2. Si viene como texto individual
    const rawText = body.text || body.texto || query.get("text") || query.get("texto");
    const ssml = body.ssml || query.get("ssml");

    if (!rawText && !ssml) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "Debes enviar el arreglo 'HISTORIA' para multivoz o el campo 'texto' para voz individual.",
      };
      return;
    }

    const selectedPersonaje = body.personaje || body.Personaje || body.voice || body.voz ||
      body.voiceName || body.voice_name || body.voiceId || query.get("voice") || query.get("personaje") || "Dalia";

    const selectedLang = body.languageCode || body.language_code || body.idioma ||
      query.get("languageCode") || query.get("lang");

    const selectedRate = Number(body.speakingRate || body.rate || body.velocidad || query.get("rate")) || undefined;
    const selectedPitch = Number(body.pitch || body.tono || query.get("pitch")) || undefined;
    const folder = body.folder || body.carpeta || query.get("folder") || "HISTORIA";
    const fileName = body.fileName || body.nombreArchivo || query.get("fileName");

    const result = await googleTtsService.synthesizeAndUpload({
      text: rawText,
      ssml,
      voiceName: selectedPersonaje,
      languageCode: selectedLang,
      speakingRate: selectedRate,
      pitch: selectedPitch,
      audioEncoding: "MP3",
      folder,
      fileName,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      mensaje: "Audio individual generado y subido a AWS S3.",
      ...result,
    };
  } catch (error) {
    console.error("❌ Error generando audio con Google Cloud TTS:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : "Error interno al generar audio",
    };
  }
};

/**
 * POST /api/google/multivoz o POST /api/google/generate-multivoice
 */
export const generateMultiVoiceSpeech = generateSpeech;

/**
 * POST /api/google/sync-voices
 * Genera la muestra "HOLA ESTA ES UNA PRUEBA EN HOMERO" para cada voz de Google,
 * las sube a AWS S3 (VOCES_AUDIO_GOOGLE) y las guarda en Firestore con su preview_url.
 */
export const syncVoicesController = async (ctx: RouterContext<string>) => {
  try {
    let sampleText = "HOLA ESTA ES UNA PRUEBA EN HOMERO";
    let folder = "VOCES_AUDIO_GOOGLE";

    try {
      const body = await ctx.request.body.json();
      if (body.text || body.texto || body.sampleText) {
        sampleText = body.text || body.texto || body.sampleText;
      }
      if (body.folder || body.carpeta) {
        folder = body.folder || body.carpeta;
      }
    } catch {
      // Body opcional
    }

    const results = await googleTtsService.syncVoicesWithS3AndFirebase(sampleText, folder);
    const okCount = results.filter((r) => r.status === "ok").length;

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      total: results.length,
      sincronizadas: okCount,
      folder,
      sampleText,
      data: results,
      message: `Se sincronizaron ${okCount} de ${results.length} voces de Google en AWS S3 y Firebase Firestore.`,
    };
  } catch (error) {
    console.error("❌ Error en sincronización de voces Google:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : "Error interno en sincronización",
    };
  }
};
