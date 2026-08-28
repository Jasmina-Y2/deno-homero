// elevenlabs.routes.ts
import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  generateMultiVoiceSpeech,
  generateSpeech,
  getAvailableVoices,
  getServiceStatus,
} from "../controllers/elevenlabs.controller.ts";

const elevenLabsRoutes = new Router();

// 1. Endpoint para comprobar si ElevenLabs está disponible y ver cuota/estado
elevenLabsRoutes.get("/elevenslab/status", getServiceStatus);

// 2. Endpoint para obtener todas las voces disponibles (femeninas, masculinas, neutrales)
elevenLabsRoutes.get("/elevenslab/voices", getAvailableVoices);

// 3. Generar audio individual (1 voz)
elevenLabsRoutes.post("/elevenslab/generate", generateSpeech);

// 4. Generar audio multivoz (múltiples personajes / narrador)
elevenLabsRoutes.post("/elevenslab/generate-multivoice", generateMultiVoiceSpeech);
elevenLabsRoutes.post("/elevenslab/multivoz", generateMultiVoiceSpeech);

export default elevenLabsRoutes;
