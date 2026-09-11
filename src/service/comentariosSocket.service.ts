import { guardarComentarioService } from "./comentarios.service.ts";
import { ComentarioWebSocketMessage } from "../models/comentarios.model.ts";

/**
 * 1. SALAS (ROOMS) POR AUDIOLIBRO / HISTORIA:
 * Mapeo estricto: publicacionId -> Set<WebSocket>.
 * Los comentarios de una publicación NUNCA se emiten a otras salas ni de forma global.
 */
const rooms = new Map<string, Set<WebSocket>>();

/**
 * 4. LIMPIEZA RIGUROSA (Mapeo inverso para evitar conexiones zombies en la RAM):
 * Mapeo: WebSocket -> Set<string> (salas donde está suscrito).
 * Al desconectarse, se elimina al socket de cada sala y se borra la sala si queda vacía.
 */
const socketToRooms = new Map<WebSocket, Set<string>>();

/**
 * 3. CONTROL DE CADENCIA (RATE LIMITING):
 * Registra la última vez que un UID envió un comentario.
 * Bloquea si intenta enviar antes de 3000 ms.
 */
const RATE_LIMIT_MS = 3000;
const userLastCommentTime = new Map<string, number>();

// Limpieza periódica de registros viejos de rate-limit para mantener la RAM mínima
setInterval(() => {
  const now = Date.now();
  for (const [uid, timestamp] of userLastCommentTime.entries()) {
    if (now - timestamp > 10000) {
      userLastCommentTime.delete(uid);
    }
  }
}, 30000);

/**
 * Une un WebSocket a una sala específica
 */
export const unirSala = (ws: WebSocket, publicacionId: string) => {
  if (!publicacionId) return;

  if (!rooms.has(publicacionId)) {
    rooms.set(publicacionId, new Set());
  }
  rooms.get(publicacionId)!.add(ws);

  if (!socketToRooms.has(ws)) {
    socketToRooms.set(ws, new Set());
  }
  socketToRooms.get(ws)!.add(publicacionId);

  console.log(`🔌 [WS Comentarios] Socket unido a sala "${publicacionId}". Clientes en sala: ${rooms.get(publicacionId)!.size}`);
};

/**
 * Remueve un WebSocket de una sala específica
 */
export const salirSala = (ws: WebSocket, publicacionId: string) => {
  if (!publicacionId) return;

  const room = rooms.get(publicacionId);
  if (room) {
    room.delete(ws);
    if (room.size === 0) {
      rooms.delete(publicacionId);
      console.log(`🧹 [WS Comentarios] Sala "${publicacionId}" vacía, eliminada de memoria RAM.`);
    }
  }

  const userRooms = socketToRooms.get(ws);
  if (userRooms) {
    userRooms.delete(publicacionId);
    if (userRooms.size === 0) {
      socketToRooms.delete(ws);
    }
  }
};

/**
 * Limpieza rigurosa de una conexión (evita sockets zombis en RAM de Deno)
 */
export const limpiarConexion = (ws: WebSocket) => {
  const userRooms = socketToRooms.get(ws);
  if (userRooms) {
    for (const publicacionId of userRooms) {
      const room = rooms.get(publicacionId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          rooms.delete(publicacionId);
          console.log(`🧹 [WS Comentarios] Sala "${publicacionId}" vacía, eliminada de memoria RAM.`);
        }
      }
    }
    socketToRooms.delete(ws);
  }
  console.log("🔌 [WS Comentarios] Conexión limpiada al 100% (cero zombis en RAM).");
};

/**
 * Verifica control de cadencia: 1 comentario cada 3 segundos
 */
export const verificarRateLimit = (uid: string): { permitido: boolean; restanteMs: number } => {
  if (!uid) return { permitido: true, restanteMs: 0 };

  const now = Date.now();
  const lastTime = userLastCommentTime.get(uid) || 0;
  const elapsed = now - lastTime;

  if (elapsed < RATE_LIMIT_MS) {
    return {
      permitido: false,
      restanteMs: RATE_LIMIT_MS - elapsed,
    };
  }

  userLastCommentTime.set(uid, now);
  return { permitido: true, restanteMs: 0 };
};

/**
 * Emite un nuevo comentario ÚNICAMENTE a los clientes de la sala especificada
 */
export const broadcastComentario = (
  publicacionId: string,
  comentario: any,
  senderWs?: WebSocket,
) => {
  const room = rooms.get(publicacionId);
  if (!room || room.size === 0) {
    return;
  }

  const payload = JSON.stringify({
    type: "nuevo_comentario",
    publicacionId,
    comentario,
  });

  const socketsMuertos: WebSocket[] = [];

  for (const client of room) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.warn("⚠️ Error enviando a cliente WebSocket:", err);
        socketsMuertos.push(client);
      }
    } else if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
      socketsMuertos.push(client);
    }
  }

  // Eliminar inmediatamente sockets caídos detectados
  for (const deadWs of socketsMuertos) {
    limpiarConexion(deadWs);
  }

  console.log(`📢 [WS Comentarios] Comentario emitido en sala "${publicacionId}" a ${room.size} clientes.`);
};

/**
 * Manejador principal para sockets de comentarios
 */
export const handleComentariosWebSocket = (
  ws: WebSocket,
  initialPublicacionId?: string | null,
  initialUid?: string | null,
) => {
  let currentUid = initialUid || "";

  ws.onopen = () => {
    console.log("⚡ [WS Comentarios] Cliente conectado.");
    if (initialPublicacionId) {
      unirSala(ws, initialPublicacionId);
      ws.send(JSON.stringify({
        type: "sala_unida",
        publicacionId: initialPublicacionId,
        mensaje: `Te uniste a la sala ${initialPublicacionId}`,
      }));
    }
  };

  ws.onmessage = async (event) => {
    try {
      const data: ComentarioWebSocketMessage = JSON.parse(event.data);
      const action = data.action;

      if (data.uid) {
        currentUid = data.uid;
      }

      switch (action) {
        case "join": {
          if (data.publicacionId) {
            unirSala(ws, data.publicacionId);
            ws.send(JSON.stringify({
              type: "sala_unida",
              publicacionId: data.publicacionId,
              mensaje: `Unido a la sala ${data.publicacionId}`,
            }));
          }
          break;
        }

        case "leave": {
          if (data.publicacionId) {
            salirSala(ws, data.publicacionId);
            ws.send(JSON.stringify({
              type: "sala_abandonada",
              publicacionId: data.publicacionId,
            }));
          }
          break;
        }

        case "new_comment": {
          const { publicacionId, comentario, uid } = data;
          const autorUid = uid || currentUid || comentario?.idAutor || comentario?.uid;

          if (!publicacionId || !comentario) {
            ws.send(JSON.stringify({
              error: "bad_request",
              message: "Faltan publicacionId o comentario",
            }));
            return;
          }

          // Control de cadencia: 3 segundos
          const rateCheck = verificarRateLimit(autorUid);
          if (!rateCheck.permitido) {
            const segundos = (rateCheck.restanteMs / 1000).toFixed(1);
            ws.send(JSON.stringify({
              error: "rate_limit",
              message: `Control de cadencia: Espera ${segundos}s antes de enviar otro comentario.`,
              restanteMs: rateCheck.restanteMs,
            }));
            return;
          }

          // Guardar comentario en Firestore pasivamente
          try {
            const resGuardar = await guardarComentarioService(publicacionId, comentario);
            const comentarioCompleto = {
              idDoc: resGuardar.idDoc,
              id: resGuardar.idDoc,
              publicacionId,
              ...(typeof comentario === "object" ? comentario : { comentario }),
              createdAt: new Date().toISOString(),
            };

            // Emitir ÚNICAMENTE a la sala del audiolibro
            broadcastComentario(publicacionId, comentarioCompleto);

            // Confirmar al autor
            ws.send(JSON.stringify({
              type: "comentario_guardado",
              idDoc: resGuardar.idDoc,
              publicacionId,
            }));
          } catch (err) {
            console.error("❌ Error guardando comentario via WS:", err);
            ws.send(JSON.stringify({
              error: "server_error",
              message: "Error al guardar el comentario",
            }));
          }
          break;
        }

        case "ping": {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          break;
        }

        default: {
          ws.send(JSON.stringify({ error: "unknown_action", action }));
        }
      }
    } catch (err) {
      console.warn("⚠️ [WS Comentarios] Mensaje no válido:", err);
      ws.send(JSON.stringify({ error: "invalid_json" }));
    }
  };

  ws.onclose = () => {
    limpiarConexion(ws);
  };

  ws.onerror = (e) => {
    console.warn("⚠️ [WS Comentarios] Error de socket:", e);
    limpiarConexion(ws);
  };
};

/**
 * Utilidades para pruebas y monitoreo de memoria
 */
export const getEstadisticasSalas = () => {
  return {
    totalSalas: rooms.size,
    totalConexionesActivas: socketToRooms.size,
  };
};
