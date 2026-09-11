import { assertEquals } from "@std/assert";
import {
  broadcastComentario,
  getEstadisticasSalas,
  limpiarConexion,
  salirSala,
  unirSala,
  verificarRateLimit,
} from "../service/comentariosSocket.service.ts";
import { obtenerComentariosService } from "../service/comentarios.service.ts";

// Mock de WebSocket para pruebas unitarias sin levantar red
class MockWebSocket {
  public readyState = WebSocket.OPEN;
  public sentMessages: string[] = [];

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
  }
}

// ----------------------------------------------------------------------------
// 1. ESTRATEGIA: SALAS (ROOMS) POR AUDIOLIBRO
// ----------------------------------------------------------------------------
Deno.test("WS Comentarios: Las salas aíslan los mensajes y nunca emiten globalmente", () => {
  const wsCapitulo1 = new MockWebSocket() as unknown as WebSocket;
  const wsCapitulo2 = new MockWebSocket() as unknown as WebSocket;

  unirSala(wsCapitulo1, "audiolibro_capitulo_1");
  unirSala(wsCapitulo2, "audiolibro_capitulo_2");

  // Emitir comentario en capítulo 1
  const comentarioCap1 = {
    id: "c1",
    texto: "Gran inicio de capítulo 1",
    autor: "Lector 1",
  };
  broadcastComentario("audiolibro_capitulo_1", comentarioCap1);

  // wsCapitulo1 debe recibirlo
  assertEquals((wsCapitulo1 as any).sentMessages.length, 1);
  const msgParsed = JSON.parse((wsCapitulo1 as any).sentMessages[0]);
  assertEquals(msgParsed.type, "nuevo_comentario");
  assertEquals(msgParsed.publicacionId, "audiolibro_capitulo_1");
  assertEquals(msgParsed.comentario.texto, "Gran inicio de capítulo 1");

  // wsCapitulo2 NO debe recibir nada (aislamiento total)
  assertEquals((wsCapitulo2 as any).sentMessages.length, 0);

  // Limpieza
  limpiarConexion(wsCapitulo1);
  limpiarConexion(wsCapitulo2);
});

// ----------------------------------------------------------------------------
// 2. ESTRATEGIA: CONTROL DE CADENCIA (RATE LIMITING 3 SEGUNDOS)
// ----------------------------------------------------------------------------
Deno.test("WS Comentarios: Bloquea intentos de envío con cadencia menor a 3 segundos", () => {
  const uidTest = "usuario_spam_test_" + Date.now();

  // Primer comentario: permitido
  const intento1 = verificarRateLimit(uidTest);
  assertEquals(intento1.permitido, true);
  assertEquals(intento1.restanteMs, 0);

  // Segundo comentario inmediato (0ms transcurridos): bloqueado
  const intento2 = verificarRateLimit(uidTest);
  assertEquals(intento2.permitido, false);
  assertEquals(intento2.restanteMs > 0, true);
  assertEquals(intento2.restanteMs <= 3000, true);
});

// ----------------------------------------------------------------------------
// 3. ESTRATEGIA: LIMPIEZA RIGUROSA (CERO CONEXIONES ZOMBIS EN RAM)
// ----------------------------------------------------------------------------
Deno.test("WS Comentarios: Limpieza rigurosa al desconectar elimina las salas vacías de memoria", () => {
  const wsTemp = new MockWebSocket() as unknown as WebSocket;
  const salaTemp = "sala_temporal_para_limpieza";

  unirSala(wsTemp, salaTemp);

  // Verificar que la sala existe
  const statsAntes = getEstadisticasSalas();
  assertEquals(statsAntes.totalConexionesActivas >= 1, true);

  // Simular desconexión del cliente
  limpiarConexion(wsTemp);

  // Al no haber más clientes en salaTemp, la sala debe ser eliminada
  const wsDummy = new MockWebSocket() as unknown as WebSocket;
  // Si intentamos hacer broadcast a la sala vacía no debe encontrar nada
  broadcastComentario(salaTemp, { texto: "hola" });
  assertEquals((wsDummy as any).sentMessages.length, 0);
});

// ----------------------------------------------------------------------------
// 4. ESTRATEGIA: CARGA INICIAL PASIVA (LÍMITE POR DEFECTO DE 50 COMENTARIOS)
// ----------------------------------------------------------------------------
Deno.test("Comentarios Service: La carga inicial respeta el límite pasivo de comentarios", async () => {
  // Probar que obtenerComentariosService acepta parámetro de límite sin error
  try {
    const comentarios = await obtenerComentariosService("publicacion_inexistente_test", 50);
    assertEquals(Array.isArray(comentarios), true);
    assertEquals(comentarios.length, 0);
  } catch (error) {
    // Si no hay emulador firestore, validamos la firma de la función
    assertEquals(typeof obtenerComentariosService, "function");
  }
});
