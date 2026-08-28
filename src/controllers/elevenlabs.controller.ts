// elevenlabs.controller.ts
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { ElevenLabsService } from "../service/elevenlabs.service.ts";

const elevenLabsService = new ElevenLabsService();

/**
 * Endpoint para verificar el status de conexión, cuota y disponibilidad de ElevenLabs
 * GET /elevenslab/status
 */
export const getServiceStatus = async (ctx: RouterContext<string>) => {
  const statusInfo = await elevenLabsService.checkStatus();
  ctx.response.status = statusInfo.available ? 200 : 503;
  ctx.response.body = {
    success: statusInfo.available,
    ...statusInfo,
  };
};

/**
 * Endpoint para obtener todas las voces disponibles (femeninas, masculinas, neutrales)
 * GET /elevenslab/voices
 */
export const getAvailableVoices = (ctx: RouterContext<string>) => {
  const voicesData = elevenLabsService.getVoices();
  ctx.response.status = 200;
  ctx.response.body = {
    success: true,
    ...voicesData,
  };
};

/**
 * Endpoint para generar audio individual, subir a AWS S3 (carpeta 'elevenslab') y retornar el enlace
 * POST /elevenslab/generate
 */
export const generateSpeech = async (ctx: RouterContext<string>) => {
  try {
    const body = await ctx.request.body.json();
    const { text, texto, voice, voz, personaje, voiceId, voice_id } = body;
    const rawText = text || texto;

    if (!rawText || typeof rawText !== "string") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "El campo 'texto' o 'text' es obligatorio y debe ser válido.",
      };
      return;
    }

    const selectedVoice = voice || voz || personaje || voiceId || voice_id;
    const audioBuffer = await elevenLabsService.generateAudio(
      rawText,
      selectedVoice,
    );

    // Subir a AWS S3 en la carpeta 'elevenslab'
    const fileName = `audio_${Date.now()}.mp3`;
    const audioUrl = await elevenLabsService.uploadToS3(
      audioBuffer,
      fileName,
      "elevenslab",
    );

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      audioUrl: audioUrl,
      url: audioUrl,
      message: "Audio generado y subido a AWS S3 con éxito en la carpeta elevenslab",
    };
  } catch (error) {
    console.error("[ElevenLabs Controller Error]:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : "Error interno",
    };
  }
};

/**
 * Endpoint para generar audio multivoz, subir a AWS S3 (carpeta 'elevenslab') y retornar el enlace
 * Acepta tu formato JSON:
 * {
 *   "TIPO": "ELEVENSLAB",
 *   "HISTORIA": [
 *     { "personaje": "ADAM", "texto": "El diamante grande." },
 *     { "personaje": "BELLA", "texto": "Tal vez deberíamos esconderlo." },
 *     { "personaje": "ADAM", "texto": "Tienes razón, vamos." }
 *   ]
 * }
 * POST /elevenslab/multivoz o POST /elevenslab/generate-multivoice
 */
export const generateMultiVoiceSpeech = async (ctx: RouterContext<string>) => {
  try {
    const body = await ctx.request.body.json();
    const segments = body.HISTORIA || body.historia || body.segments ||
      body.dialogos || body.dialogues;

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        error: "Debes enviar un arreglo 'HISTORIA' con 'personaje' y 'texto'.",
      };
      return;
    }

    const audioBuffer = await elevenLabsService.generateMultiVoiceAudio(segments);

    // Subir a AWS S3 en la carpeta 'elevenslab'
    const fileName = `historia_${Date.now()}.mp3`;
    const audioUrl = await elevenLabsService.uploadToS3(
      audioBuffer,
      fileName,
      "elevenslab",
    );

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      audioUrl: audioUrl,
      url: audioUrl,
      message: "Audio multivoz generado y subido a AWS S3 con éxito en la carpeta elevenslab",
    };
  } catch (error) {
    console.error("[ElevenLabs Multivoz Error]:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : "Error interno al generar multivoz",
    };
  }
};
