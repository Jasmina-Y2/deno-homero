// src/routes/google.ts
import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  generateMultiVoiceSpeech,
  generateSpeech,
  getAvailableVoices,
  getServiceStatus,
  syncVoicesController,
} from "../controllers/googleTts.controller.ts";

const googleRoutes = new Router();

// 1. Estado y conectividad de Google Cloud Text-to-Speech con clave.json
googleRoutes.get("/google/status", getServiceStatus);
googleRoutes.get("/api/google/status", getServiceStatus);

// 2. Voces disponibles de Google Cloud TTS (Ultra Realistas: Journey, Chirp3-HD, Studio, Neural2)
googleRoutes.get("/google/voices", getAvailableVoices);
googleRoutes.get("/api/google/voices", getAvailableVoices);

// 3. Generar audio para un solo texto (retorna Base64/JSON o stream binario)
googleRoutes.get("/google/speak", generateSpeech);
googleRoutes.get("/api/google/speak", generateSpeech);
googleRoutes.get("/google/audio", generateSpeech);
googleRoutes.get("/api/google/audio", generateSpeech);

googleRoutes.post("/google/generate", generateSpeech);
googleRoutes.post("/api/google/generate", generateSpeech);
googleRoutes.post("/google/tts", generateSpeech);
googleRoutes.post("/api/google/tts", generateSpeech);

// 4. Generar audio multivoz / historia con múltiples personajes de Google
googleRoutes.post("/google/generate-multivoice", generateMultiVoiceSpeech);
googleRoutes.post("/api/google/generate-multivoice", generateMultiVoiceSpeech);
googleRoutes.post("/google/multivoz", generateMultiVoiceSpeech);
googleRoutes.post("/api/google/multivoz", generateMultiVoiceSpeech);

// 5. Sincronizar catálogo de voces
googleRoutes.post("/google/sync-voices", syncVoicesController);
googleRoutes.post("/api/google/sync-voices", syncVoicesController);

export default googleRoutes;
