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
