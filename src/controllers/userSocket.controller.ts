import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  enviarActualizacion,
  getEstadisticasConexiones,
  handleUserWebSocket,
} from "../service/userSocket.service.ts";

/**
 * Endpoint WebSocket para sincronización en tiempo real del usuario
 * Conexión: GET /ws/user?uid=:uid o GET /ws/user/:uid
 */
export const userWebSocketController = (ctx: RouterContext<string>) => {
  if (!ctx.isUpgradable) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      message: "La petición no es actualizable a WebSocket.",
    };
    return;
  }

  const uid =
    ctx.params?.uid ||
    ctx.request.url.searchParams.get("uid") ||
    "";

  if (!uid || uid.trim() === "") {
    console.warn("❌ [WS User] Intento de conexión WebSocket rechazado: UID no proporcionado.");
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      message: "Error: El parámetro UID es estrictamente obligatorio para establecer la conexión WebSocket.",
    };
    return;
  }

  const ws = ctx.upgrade();
  handleUserWebSocket(ws, uid.trim());
};

/**
 * Endpoint REST opcional para verificar conexiones activas
 * GET /api/ws/stats
 */
export const getWebSocketStatsController = (ctx: RouterContext<string>) => {
  const stats = getEstadisticasConexiones();
  ctx.response.status = 200;
  ctx.response.body = {
    success: true,
    data: stats,
  };
};

export { enviarActualizacion };
