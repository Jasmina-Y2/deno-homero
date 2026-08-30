import { db, messaging } from "../config/firebase.ts";

/**
 * Interfaz para la función de envío de notificaciones push.
 */
export interface NotificationPayloadData {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Función para enviar una notificación push a un celular usando su FCM Token
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
 * Envía una notificación push buscando el fcmToken guardado del usuario en la base de datos
 * y guarda la notificación en su historial.
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

    // 1. Obtener el token del usuario desde Firestore
    let fcmToken: string | null = null;

    // Buscar primero por doc(uid)
    const userDocDirect = await db.collection("users").doc(uidDestinatario).get();
    if (userDocDirect.exists) {
      fcmToken = userDocDirect.data()?.fcmToken || null;
    }

    // Si no está por ID directo, buscar por campo "uid"
    if (!fcmToken) {
      const snapshot = await db.collection("users")
        .where("uid", "==", uidDestinatario)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        fcmToken = snapshot.docs[0].data()?.fcmToken || null;
      }
    }

    // 2. Guardar en el historial de notificaciones del usuario (subcolección notificaciones)
    try {
      await db.collection("users")
        .doc(uidDestinatario)
        .collection("notificaciones")
        .add({
          titulo,
          mensaje,
          data: data || {},
          fecha: new Date().toISOString(),
          leido: false,
        });
    } catch (histError) {
      console.warn("⚠️ No se pudo guardar historial de notificación:", histError);
    }

    // 3. Si tiene fcmToken, enviar notificación Push
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
