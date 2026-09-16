/**
 * ============================================================================
 * SERVICIO WEBSOCKET DE USUARIOS EN TIEMPO REAL (ZERO-COST / SIN FIREBASE SNAPSHOTS)
 * ============================================================================
 * Mantiene en memoria RAM las conexiones WebSocket activas por UID de usuario.
 * Permite emitir eventos en tiempo real (saldo de monedas, compras, perfil, etc.)
 */

// Mapeo: uid -> Set de WebSockets (soporta múltiples pestañas o dispositivos por usuario)
const usuariosConectados = new Map<string, Set<WebSocket>>();

// Mapeo inverso: WebSocket -> uid (para limpieza O(1) al desconectar)
const socketToUid = new Map<WebSocket, string>();

/**
 * Registra una nueva conexión WebSocket asociada a un UID
 */
export const registrarConexion = (uid: string, ws: WebSocket) => {
  if (!uid || !ws) return;

  if (!usuariosConectados.has(uid)) {
    usuariosConectados.set(uid, new Set());
  }

  usuariosConectados.get(uid)!.add(ws);
  socketToUid.set(ws, uid);

  console.log(`🔌 [WS User] Usuario conectado: ${uid} (Sockets activos: ${usuariosConectados.get(uid)!.size})`);
};

/**
 * Remueve una conexión cerrada de la memoria RAM
 */
export const removerConexion = (ws: WebSocket) => {
  const uid = socketToUid.get(ws);
  if (!uid) return;

  socketToUid.delete(ws);

  const socketsDelUsuario = usuariosConectados.get(uid);
  if (socketsDelUsuario) {
    socketsDelUsuario.delete(ws);
    if (socketsDelUsuario.size === 0) {
      usuariosConectados.delete(uid);
      console.log(`🧹 [WS User] Usuario ${uid} desconectado totalmente. Memoria liberada.`);
    } else {
      console.log(`🔌 [WS User] Socket cerrado para ${uid}. Restantes: ${socketsDelUsuario.size}`);
    }
  }
};

/**
 * Envía una actualización directa en tiempo real al usuario mediante WebSocket.
 * Si el usuario no está conectado actualmente, retorna false sin generar error.
 *
 * @param uid Identificador del usuario destinatario
 * @param tipoEvento Nombre del evento (ej: "saldo_actualizado", "perfil_actualizado", "notificacion")
 * @param datos Carga útil (payload) con los nuevos datos
 * @returns boolean si al menos un socket recibió el mensaje
 */
export const enviarActualizacion = (
  uid: string,
  tipoEvento: string,
  datos: any,
): boolean => {
  if (!uid || !usuariosConectados.has(uid)) {
    return false;
  }

  const sockets = usuariosConectados.get(uid);
  if (!sockets || sockets.size === 0) {
    return false;
  }

  const mensaje = JSON.stringify({
    tipo: tipoEvento,
    tipoEvento,
    datos,
    data: datos,
    timestamp: new Date().toISOString(),
  });

  const socketsMuertos: WebSocket[] = [];
  let enviadosExitosos = 0;

  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(mensaje);
        enviadosExitosos++;
      } catch (err) {
        console.warn(`⚠️ [WS User] Error al enviar mensaje a socket de ${uid}:`, err);
        socketsMuertos.push(ws);
      }
    } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      socketsMuertos.push(ws);
    }
  }

  // Limpiar sockets que se hayan caído silenciosamente
  for (const deadWs of socketsMuertos) {
    removerConexion(deadWs);
  }

  if (enviadosExitosos > 0) {
    console.log(`📢 [WS User] Evento "${tipoEvento}" enviado a ${uid} (${enviadosExitosos} socket/s).`);
    return true;
  }

  return false;
};

/**
 * Retorna las estadísticas de usuarios y conexiones activas en tiempo real
 */
export const getEstadisticasConexiones = () => {
  return {
    usuariosConectados: usuariosConectados.size,
    totalSocketsActivos: socketToUid.size,
    uids: Array.from(usuariosConectados.keys()),
  };
};

/**
 * Manejador del ciclo de vida de una conexión WebSocket de usuario
 */
export const handleUserWebSocket = (ws: WebSocket, uid: string) => {
  ws.onopen = () => {
    registrarConexion(uid, ws);
    // Enviar confirmación inicial de conexión
    try {
      ws.send(
        JSON.stringify({
          tipo: "conexion_establecida",
          message: "Conexión en tiempo real activa",
          uid,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (_) {}
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      // Responder a ping (Keep-Alive)
      if (data.action === "ping" || data.type === "ping") {
        ws.send(JSON.stringify({ tipo: "pong", timestamp: Date.now() }));
      }
    } catch (_) {
      // Ignorar mensajes con formato no JSON
    }
  };

  ws.onclose = () => {
    removerConexion(ws);
  };

  ws.onerror = (e) => {
    console.warn(`⚠️ [WS User] Error en socket del usuario ${uid}:`, e);
    removerConexion(ws);
  };
};
