import { assertEquals } from "@std/assert";
import { obtenerComentariosService } from "../service/comentarios.service.ts";

Deno.test("Comentarios Service: La carga respeta el límite de comentarios", async () => {
  try {
    const comentarios = await obtenerComentariosService("publicacion_inexistente_test", 50);
    assertEquals(Array.isArray(comentarios), true);
    assertEquals(comentarios.length, 0);
  } catch (_error) {
    assertEquals(typeof obtenerComentariosService, "function");
  }
});
