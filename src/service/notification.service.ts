import { db, messaging } from "../config/firebase.ts";
import { Notificacion } from "../models/notificaciones.model.ts";

/**
 * Interfaz para la función de envío de notificaciones push.
 */
export interface NotificationPayloadData {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Función para enviar una notificación push a un celular usando su FCM Token puro.
 * No crea ni escribe nada en la base de datos Firestore.
 * @param tokenDestinatario - El FCM Token del usuario que recibe la alerta
 * @param titulo - Título de la notificación
 * @param mensaje - Cuerpo del mensaje
 * @param data - Datos extras (opcional, ej: { historiaId: "123", tipo: "like" })
 */
export const enviarPush = async (
  tokenDestinatario: string,
  titulo: string,
  mensaje: string,
  data: NotificationPayloadData = {},
) => {
  if (!tokenDestinatario || tokenDestinatario.trim() === "") {
    console.warn("⚠️ [FCM] No se proporcionó un token destinatario válido.");
    return null;
  }

  // FCM data solo acepta pares clave-valor tipo string
  const formattedData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      formattedData[key] = String(value);
    }
  }

  const payload = {
    token: tokenDestinatario,
    notification: {
      title: titulo,
      body: mensaje,
    },
    data: formattedData,
    android: {
      priority: "high" as const,
      notification: {
        channelId: "default",
        sound: "default",
        icon: "ic_launcher",
        color: "#FFA500",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
  };

  try {
    const res = await messaging.send(payload);
    console.log("🔔 [FCM] Notificación enviada con éxito:", res);
    return res;
  } catch (err) {
    console.error("❌ [FCM] Error enviando push:", err);
    return null;
  }
};

/**
 * Función auxiliar para compatibilidad de interfaces (NO guarda nada en Firestore).
 */
export const guardarNotificacionEnBD = async (
  _uidDestinatario: string,
  _titulo: string,
  _mensaje: string,
  _data: NotificationPayloadData = {},
) => {
  // No-op: No se escribe nada en Firestore
  return null;
};

/**
 * Envía una notificación push buscando el fcmToken del usuario en la colección 'users'.
 * NO crea ni escribe ninguna colección en Firestore.
 * @param uidDestinatario - UID del usuario destinatario
 * @param titulo - Título de la notificación
 * @param mensaje - Cuerpo de la notificación
 * @param data - Datos adicionales
 */
export const enviarPushAUsuario = async (
  uidDestinatario: string,
  titulo: string,
  mensaje: string,
  data: NotificationPayloadData = {},
) => {
  try {
    if (!uidDestinatario) return null;

    // Obtener el token del usuario desde Firestore
    let fcmToken: string | null = null;

    const userDocDirect = await db.collection("users").doc(uidDestinatario).get();
    if (userDocDirect.exists) {
      fcmToken = userDocDirect.data()?.fcmToken || null;
    }

    if (!fcmToken) {
      const snapshot = await db.collection("users")
        .where("uid", "==", uidDestinatario)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        fcmToken = snapshot.docs[0].data()?.fcmToken || null;
      }
    }

    // Si tiene fcmToken, enviar notificación Push al celular
    if (fcmToken) {
      return await enviarPush(fcmToken, titulo, mensaje, data);
    } else {
      console.log(`ℹ️ [FCM] El usuario ${uidDestinatario} no tiene fcmToken registrado.`);
      return null;
    }
  } catch (error) {
    console.error("❌ [FCM] Error en enviarPushAUsuario:", error);
    return null;
  }
};

/**
 * Métodos de consulta y compatibilidad que retornan vacío sin crear colecciones
 */
export const obtenerNotificacionesPorUsuarioService = async (_uid: string): Promise<Notificacion[]> => {
  return [];
};

export const marcarNotificacionLeidaService = async (idNotificacion: string) => {
  return { id: idNotificacion, leido: true };
};

export const marcarTodasNotificacionesLeidasService = async (_uid: string) => {
  return { totalActualizadas: 0 };
};

export const eliminarNotificacionService = async (idNotificacion: string) => {
  return { success: true, id: idNotificacion };
};

export const obtenerNotificacionesNoLeidasCountService = async (_uid: string) => {
  return 0;
};
