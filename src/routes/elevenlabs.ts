// elevenlabs.routes.ts
import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  generateMultiVoiceSpeech,
  generateSpeech,
  getAvailableVoices,
  getServiceStatus,
  syncVoicesController,
} from "../controllers/elevenlabs.controller.ts";

const elevenLabsRoutes = new Router();

// 1. Endpoint para comprobar si ElevenLabs está disponible y ver cuota/estado
elevenLabsRoutes.get("/elevenslab/status", getServiceStatus);

// 2. Endpoint para obtener todas las voces disponibles (femeninas, masculinas, neutrales) con URLs mp3
elevenLabsRoutes.get("/elevenslab/voices", getAvailableVoices);

// 3. Endpoint para sincronizar las voces, generar muestra y subirlas a AWS S3 y Firestore
elevenLabsRoutes.post("/elevenslab/sync-voices", syncVoicesController);

// 4. Generar audio individual (1 voz)
elevenLabsRoutes.post("/elevenslab/generate", generateSpeech);

// 5. Generar audio multivoz (múltiples personajes / narrador)
elevenLabsRoutes.post("/elevenslab/generate-multivoice", generateMultiVoiceSpeech);
elevenLabsRoutes.post("/elevenslab/multivoz", generateMultiVoiceSpeech);

export default elevenLabsRoutes;
