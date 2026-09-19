import { assertEquals, assertExists } from "@std/assert";
import { Image } from "npm:imagescript@^1.3.0";
import {
  esUrlVideo,
  esUrlImagen,
  redimensionarImagenOG,
  subirThumbnailS3,
} from "../service/multimedia.service.ts";

Deno.test("Multimedia: Detección de URLs de Video", () => {
  assertEquals(esUrlVideo("https://example.com/video.mp4"), true);
  assertEquals(esUrlVideo("https://example.com/video.webm?token=123"), true);
  assertEquals(esUrlVideo("https://example.com/video.mov"), true);
  assertEquals(esUrlVideo("https://example.com/file", "video/mp4"), true);
  assertEquals(esUrlVideo("https://example.com/image.jpg"), false);
  assertEquals(esUrlVideo("https://example.com/file", "image/png"), false);
});

Deno.test("Multimedia: Detección de URLs de Imagen", () => {
  assertEquals(esUrlImagen("https://example.com/photo.jpg"), true);
  assertEquals(esUrlImagen("https://example.com/photo.jpeg?v=1"), true);
  assertEquals(esUrlImagen("https://example.com/photo.png"), true);
  assertEquals(esUrlImagen("https://example.com/photo.webp"), true);
  assertEquals(esUrlImagen("https://example.com/file", "image/jpeg"), true);
  assertEquals(esUrlImagen("https://example.com/video.mp4"), false);
  assertEquals(esUrlImagen("https://example.com/file", "video/webm"), false);
});

Deno.test("Multimedia: Redimensionar imagen a 1200x630 Open Graph con ImageScript", async () => {
  // Crear una imagen de prueba de 800x600
  const testImg = new Image(800, 600);
  testImg.fill(0x3498dbff); // Azul
  const originalBytes = await testImg.encodeJPEG(90);

  // Redimensionar a 1200x630
  const resizedBytes = await redimensionarImagenOG(originalBytes, 1200, 630);
  assertExists(resizedBytes);
  assertEquals(resizedBytes.length > 0, true);

  // Verificar decodificación de la imagen resultante
  const decoded = await Image.decode(resizedBytes);
  assertEquals(decoded.width, 1200);
  assertEquals(decoded.height, 630);
});

Deno.test("Multimedia: Extraer URLs de audios (audioES, audioEN, .mp3, .wav) y escenas para eliminar de S3", async () => {
  const { extraerUrlsS3DeObjeto } = await import("../service/cardhistoria.service.ts");

  const testPayload = {
    titulo: "prueba",
    id: "971112780393356",
    idAutor: "7cBW5g7xYGbh7Fh2zTCHvNBdGHx1",
    portada: "https://mybuckethomero3.s3.us-east-1.amazonaws.com/portada/1788940591691-3hpj5v-homero_1788940591652_ra9m2g2.mp4",
    poster: "https://mybuckethomero3.s3.us-east-1.amazonaws.com/poster/1788940591691-poster_test.webp",
    historia: [
      {
        idEscena: 1,
        textoES: "Bajo una tormenta...",
        media: "https://mybuckethomero3.s3.us-east-1.amazonaws.com/historia/1788940602577-s2emuh-homero_1788940602579_ywy4gpo.mp4",
      },
      {
        idEscena: 2,
        textoES: "Un trueno...",
        media: "https://mybuckethomero3.s3.us-east-1.amazonaws.com/historia/1788940606469-mkij32-homero_1788940606463_wshf3vk.webp",
      },
    ],
    audioES: {
      success: true,
      audioUrl: "https://mybuckethomero3.s3.us-east-1.amazonaws.com/google/1788940644613-bj82ds-historia_gemini_1788940644613.wav",
      url: "https://mybuckethomero3.s3.us-east-1.amazonaws.com/google/1788940644613-bj82ds-historia_gemini_1788940644613.wav",
    },
    audioEN: {
      audioUrl: "https://mybuckethomero3.s3.us-east-1.amazonaws.com/google/audio_en_123.mp3",
    },
    autor: {
      uid: "7cBW5g7xYGbh7Fh2zTCHvNBdGHx1",
      photoURL: "https://mybuckethomero3.s3.us-east-1.amazonaws.com/profile/1789603214765-3s4quf-profile_7cBW5g7xYGbh7Fh2zTCHvNBdGHx1.jpg",
    },
  };

  const urls = extraerUrlsS3DeObjeto(testPayload);

  // Deben estar el poster (.webp), audios wav/mp3, videos y portadas
  assertEquals(urls.includes("https://mybuckethomero3.s3.us-east-1.amazonaws.com/poster/1788940591691-poster_test.webp"), true);
  assertEquals(urls.includes("https://mybuckethomero3.s3.us-east-1.amazonaws.com/google/1788940644613-bj82ds-historia_gemini_1788940644613.wav"), true);
  assertEquals(urls.includes("https://mybuckethomero3.s3.us-east-1.amazonaws.com/google/audio_en_123.mp3"), true);
  assertEquals(urls.includes("https://mybuckethomero3.s3.us-east-1.amazonaws.com/portada/1788940591691-3hpj5v-homero_1788940591652_ra9m2g2.mp4"), true);
  assertEquals(urls.includes("https://mybuckethomero3.s3.us-east-1.amazonaws.com/historia/1788940602577-s2emuh-homero_1788940602579_ywy4gpo.mp4"), true);
  assertEquals(urls.includes("https://mybuckethomero3.s3.us-east-1.amazonaws.com/historia/1788940606469-mkij32-homero_1788940606463_wshf3vk.webp"), true);

  // NO debe incluir la foto de perfil del usuario
  assertEquals(urls.includes("https://mybuckethomero3.s3.us-east-1.amazonaws.com/profile/1789603214765-3s4quf-profile_7cBW5g7xYGbh7Fh2zTCHvNBdGHx1.jpg"), false);
});

Deno.test("Multimedia: Concatenación binaria nativa de fragmentos MP3 (mergeMp3BuffersPureTS)", async () => {
  const { mergeMp3BuffersPureTS, mergeAudioBuffersWithFFmpeg } = await import("../utils/audio.utils.ts");

  // Crear fragmentos simulados de MP3 con cabecera ID3 y frames
  const fakeId3Header = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a, ...new Uint8Array(10)]);
  const fakeFrame1 = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x01, 0x02, 0x03, 0x04]);
  const fakeFrame2 = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x05, 0x06, 0x07, 0x08]);

  const part1 = new Uint8Array([...fakeId3Header, ...fakeFrame1]);
  const part2 = new Uint8Array([...fakeId3Header, ...fakeFrame2]);

  // Test concatenación pura en TS
  const mergedPure = mergeMp3BuffersPureTS([part1, part2]);
  assertExists(mergedPure);
  assertEquals(mergedPure.length > 0, true);

  // Test función principal con fallback
  const mergedMain = await mergeAudioBuffersWithFFmpeg([part1, part2]);
  assertExists(mergedMain);
  assertEquals(mergedMain.length > 0, true);
});

