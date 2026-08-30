import { db, messaging } from "../config/firebase.ts";
import { Notificacion } from "../models/notificaciones.model.ts";

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
        icon: "ic_launcher", // o ic_stat_notification
        color: "#FFA500", // Color temático de Homero
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
 * Guarda una notificación en la colección raíz 'notificaciones' y en el historial del usuario
 */
export const guardarNotificacionEnBD = async (
  uidDestinatario: string,
  titulo: string,
  mensaje: string,
  data: NotificationPayloadData = {},
) => {
  try {
    const ahora = new Date().toISOString();
    const tipo = data.tipo ? String(data.tipo) : "general";

    const nuevaNotif = {
      uidUsuario: uidDestinatario,
      idDestinatario: uidDestinatario,
      titulo: titulo,
      mensaje: mensaje,
      tipo: tipo,
      data: data || {},
      leido: false,
      fecha: ahora,
      fechaCreacion: ahora,
    };

    // 1. Guardar en la colección global 'notificaciones'
    const notifRef = await db.collection("notificaciones").add(nuevaNotif);

    // 2. Guardar también en la subcolección 'users/{uid}/notificaciones' (para compatibilidad)
    try {
      await db.collection("users")
        .doc(uidDestinatario)
        .collection("notificaciones")
        .doc(notifRef.id)
        .set(nuevaNotif);
    } catch (subErr) {
      console.warn("⚠️ No se pudo guardar en subcolección de usuario:", subErr);
    }

    console.log(`💾 [Notificación] Guardada con ID ${notifRef.id} para usuario ${uidDestinatario}`);
    return { idDoc: notifRef.id, ...nuevaNotif };
  } catch (error) {
    console.error("❌ Error en guardarNotificacionEnBD:", error);
    return null;
  }
};

/**
 * Envía una notificación push buscando el fcmToken guardado del usuario en la base de datos
 * y guarda la notificación en la colección 'notificaciones'.
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

    // 1. Guardar siempre en la colección 'notificaciones' para que quede el rastro
    await guardarNotificacionEnBD(uidDestinatario, titulo, mensaje, data);

    // 2. Obtener el token del usuario desde Firestore
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

    // 3. Si tiene fcmToken, enviar notificación Push al celular
    if (fcmToken) {
      return await enviarPush(fcmToken, titulo, mensaje, data);
    } else {
      console.log(`ℹ️ [FCM] El usuario ${uidDestinatario} no tiene fcmToken registrado (Notificación guardada en BD).`);
      return null;
    }
  } catch (error) {
    console.error("❌ [FCM] Error en enviarPushAUsuario:", error);
    return null;
  }
};

/**
 * Obtiene todas las notificaciones de un usuario desde la colección 'notificaciones'
 */
export const obtenerNotificacionesPorUsuarioService = async (uid: string): Promise<Notificacion[]> => {
  try {
    const lista: Notificacion[] = [];
    const idsVistos = new Set<string>();

    // Buscar por uidUsuario
    const snapshot1 = await db.collection("notificaciones")
      .where("uidUsuario", "==", uid)
      .get();

    snapshot1.forEach((doc) => {
      if (!idsVistos.has(doc.id)) {
        idsVistos.add(doc.id);
        lista.push({
          idDoc: doc.id,
          id: doc.id,
          ...(doc.data() as Omit<Notificacion, "idDoc" | "id">),
        });
      }
    });

    // Buscar por idDestinatario en caso de variantes
    const snapshot2 = await db.collection("notificaciones")
      .where("idDestinatario", "==", uid)
      .get();

    snapshot2.forEach((doc) => {
      if (!idsVistos.has(doc.id)) {
        idsVistos.add(doc.id);
        lista.push({
          idDoc: doc.id,
          id: doc.id,
          ...(doc.data() as Omit<Notificacion, "idDoc" | "id">),
        });
      }
    });

    // Ordenar de más reciente a más antigua
    lista.sort((a, b) => {
      const fechaA = new Date(a.fecha || a.fechaCreacion || 0).getTime();
      const fechaB = new Date(b.fecha || b.fechaCreacion || 0).getTime();
      return fechaB - fechaA;
    });

    return lista;
  } catch (error) {
    console.error("❌ Error en obtenerNotificacionesPorUsuarioService:", error);
    throw new Error("Error al obtener las notificaciones del usuario");
  }
};

/**
 * Marca una notificación específica como leída
 */
export const marcarNotificacionLeidaService = async (idNotificacion: string) => {
  try {
    const fechaLeido = new Date().toISOString();
    const docRef = db.collection("notificaciones").doc(idNotificacion);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      await docRef.update({
        leido: true,
        fechaLeido: fechaLeido,
      });

      // Si existe en la subcolección de usuario, actualizarla también
      const data = docSnap.data();
      const uidDestinatario = data?.uidUsuario || data?.idDestinatario;
      if (uidDestinatario) {
        try {
          await db.collection("users")
            .doc(uidDestinatario)
            .collection("notificaciones")
            .doc(idNotificacion)
            .update({
              leido: true,
              fechaLeido: fechaLeido,
            });
        } catch {
          // Subcolección opcional
        }
      }

      return { id: idNotificacion, leido: true };
    }

    throw new Error("Notificación no encontrada");
  } catch (error) {
    console.error("❌ Error en marcarNotificacionLeidaService:", error);
    throw new Error("Error al marcar la notificación como leída");
  }
};

/**
 * Marca todas las notificaciones de un usuario como leídas
 */
export const marcarTodasNotificacionesLeidasService = async (uid: string) => {
  try {
    const snapshot = await db.collection("notificaciones")
      .where("uidUsuario", "==", uid)
      .where("leido", "==", false)
      .get();

    const batch = db.batch();
    const fechaLeido = new Date().toISOString();

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        leido: true,
        fechaLeido: fechaLeido,
      });
    });

    await batch.commit();

    console.log(`✅ [Notificaciones] Marcadas ${snapshot.size} notificaciones como leídas para ${uid}`);
    return { success: true, actualizadas: snapshot.size };
  } catch (error) {
    console.error("❌ Error en marcarTodasNotificacionesLeidasService:", error);
    throw new Error("Error al marcar todas las notificaciones como leídas");
  }
};

/**
 * Elimina una notificación por su ID
 */
export const eliminarNotificacionService = async (idNotificacion: string) => {
  try {
    const docRef = db.collection("notificaciones").doc(idNotificacion);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const data = docSnap.data();
      const uidDestinatario = data?.uidUsuario || data?.idDestinatario;

      await docRef.delete();

      if (uidDestinatario) {
        try {
          await db.collection("users")
            .doc(uidDestinatario)
            .collection("notificaciones")
            .doc(idNotificacion)
            .delete();
        } catch {
          // Subcolección opcional
        }
      }

      return { success: true, id: idNotificacion };
    }

    return { success: true, message: "La notificación ya no existía" };
  } catch (error) {
    console.error("❌ Error en eliminarNotificacionService:", error);
    throw new Error("Error al eliminar la notificación");
  }
};

/**
 * Obtiene el conteo de notificaciones no leídas para un usuario
 */
export const obtenerNotificacionesNoLeidasCountService = async (uid: string) => {
  try {
    const snapshot = await db.collection("notificaciones")
      .where("uidUsuario", "==", uid)
      .where("leido", "==", false)
      .get();

    return snapshot.size;
  } catch (error) {
    console.error("❌ Error en obtenerNotificacionesNoLeidasCountService:", error);
    return 0;
  }
};
