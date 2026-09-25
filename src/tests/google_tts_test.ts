// src/tests/google_tts_test.ts
import { assertEquals, assertExists } from "jsr:@std/assert@1";
import { googleTtsService } from "../service/googleTts.service.ts";

Deno.test("Google Cloud TTS - Check Status", async () => {
  const status = await googleTtsService.checkStatus();
  assertEquals(status.available, true);
  assertEquals(status.status, "online");
});

Deno.test("Google Cloud TTS - Get Voices List", async () => {
  const voicesData = await googleTtsService.getVoices("es");
  assertExists(voicesData.vocesOficialesGoogle);
  assertEquals(voicesData.vocesOficialesGoogle.length > 0, true);
  assertEquals(voicesData.vocesFemeninas.length > 0, true);
  assertEquals(voicesData.vocesMasculinas.length > 0, true);
});

Deno.test("Google Cloud TTS - Synthesize Simple Speech with Emotion", async () => {
  const buffer = await googleTtsService.synthesizeSpeech({
    text: "(susurrando) Hola, prueba de síntesis con emoción.",
    voiceName: "Aoede",
    audioEncoding: "MP3",
  });

  assertExists(buffer);
  assertEquals(buffer.length > 1000, true);
});
