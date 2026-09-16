import { assertEquals } from "@std/assert";
import {
  enviarActualizacion,
  getEstadisticasConexiones,
  handleUserWebSocket,
  registrarConexion,
  removerConexion,
} from "../service/userSocket.service.ts";

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

Deno.test("User WebSocket: Conecta usuario y envía actualizaciones en tiempo real", () => {
  const ws1 = new MockWebSocket() as unknown as WebSocket;
  const uidTest = "test_user_socket_123";

  registrarConexion(uidTest, ws1);

  const stats = getEstadisticasConexiones();
  assertEquals(stats.usuariosConectados >= 1, true);

  // Enviar actualización de saldo
  const enviado = enviarActualizacion(uidTest, "saldo_actualizado", {
    monedas: 250,
    motivo: "compra_exitosa",
  });

  assertEquals(enviado, true);
  assertEquals((ws1 as any).sentMessages.length, 1);

  const msg = JSON.parse((ws1 as any).sentMessages[0]);
  assertEquals(msg.tipo, "saldo_actualizado");
  assertEquals(msg.datos.monedas, 250);

  // Desconectar y verificar limpieza
  removerConexion(ws1);
  const statsDespues = getEstadisticasConexiones();
  assertEquals(statsDespues.uids.includes(uidTest), false);
});
