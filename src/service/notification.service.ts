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
 * @param tokenDestinatario - El FCM Token del usuario que recibe la alerta
 * @param titulo - Título de la notificación
 * @param mensaje - Cuerpo del mensaje
 * @param data - Datos extras (ej: { idHistoria: "123", tipo: "like" })
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
    token: tokenDestinatario.trim(),
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
          badge: 1,
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
 * Guarda la notificación en la base de datos Firestore (colección 'notificaciones').
 * Permite que el usuario la vea en su bandeja/centro de notificaciones en la app.
 */
export const guardarNotificacionEnBD = async (
  uidDestinatario: string,
  titulo: string,
  mensaje: string,
  data: NotificationPayloadData = {},
): Promise<string | null> => {
  if (!uidDestinatario) return null;

  try {
    const fecha = new Date().toISOString();
    const docData: any = {
      uidDestinatario,
      idDestinatario: uidDestinatario,
      uidUsuario: uidDestinatario,
      titulo,
      mensaje,
      tipo: data.tipo || "general",
      data: { ...data },
      leido: false,
      fecha,
      fechaCreacion: fecha,
      createdAt: fecha,
    };

    const docRef = await db.collection("notificaciones").add(docData);
    console.log(`📥 [Notificación DB] Guardada en 'notificaciones' para usuario: ${uidDestinatario} (ID: ${docRef.id})`);
    return docRef.id;
  } catch (error) {
    console.error("❌ [Notificación DB] Error guardando notificación en Firestore:", error);
    return null;
  }
};

/**
 * Envía una notificación completa a un usuario:
 * 1. Guarda la notificación en Firestore (colección 'notificaciones') para la bandeja in-app.
 * 2. Busca el fcmToken del usuario en 'users' (compatible con sistema.fcmToken, fcmToken, etc.)
 *    y envía la alerta Push al dispositivo móvil mediante FCM.
 *
 * @param uidDestinatario - UID del usuario destinatario
 * @param titulo - Título de la notificación
 * @param mensaje - Cuerpo de la notificación
 * @param data - Datos adicionales
 * @param omitirGuardadoBD - Opcional, si es true no guarda en Firestore
 */
export const enviarPushAUsuario = async (
  uidDestinatario: string,
  titulo: string,
  mensaje: string,
  data: NotificationPayloadData = {},
  omitirGuardadoBD = false,
) => {
  try {
    if (!uidDestinatario) return null;

    // 1. Guardar en Firestore para que aparezca en la lista de notificaciones de la app
    if (!omitirGuardadoBD) {
      await guardarNotificacionEnBD(uidDestinatario, titulo, mensaje, data);
    }

    // 2. Extraer el token FCM del usuario desde Firestore
    let fcmToken: string | null = null;

    // Intento 1: Buscar por ID directo de documento
    const userDocDirect = await db.collection("users").doc(uidDestinatario).get();
    if (userDocDirect.exists) {
      const uData = userDocDirect.data();
      fcmToken =
        uData?.sistema?.fcmToken ||
        uData?.sistema?.fcm_token ||
        uData?.fcmToken ||
        uData?.fcm_token ||
        uData?.token ||
        null;
    }

    // Intento 2: Buscar por query where("uid", "==", uidDestinatario)
    if (!fcmToken) {
      const snapshot = await db.collection("users")
        .where("uid", "==", uidDestinatario)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const uData = snapshot.docs[0].data();
        fcmToken =
          uData?.sistema?.fcmToken ||
          uData?.sistema?.fcm_token ||
          uData?.fcmToken ||
          uData?.fcm_token ||
          uData?.token ||
          null;
      }
    }

    // Intento 3: Buscar por query where("id", "==", uidDestinatario)
    if (!fcmToken) {
      const snapId = await db.collection("users")
        .where("id", "==", uidDestinatario)
        .limit(1)
        .get();

      if (!snapId.empty) {
        const uData = snapId.docs[0].data();
        fcmToken =
          uData?.sistema?.fcmToken ||
          uData?.sistema?.fcm_token ||
          uData?.fcmToken ||
          uData?.fcm_token ||
          null;
      }
    }

    // 3. Si tiene fcmToken, enviar notificación Push al celular
    if (fcmToken && fcmToken.trim().length > 0) {
      return await enviarPush(fcmToken, titulo, mensaje, data);
    } else {
      console.log(`ℹ️ [FCM] El usuario ${uidDestinatario} no tiene fcmToken registrado. Notificación guardada solo en base de datos.`);
      return null;
    }
  } catch (error) {
    console.error("❌ [FCM] Error en enviarPushAUsuario:", error);
    return null;
  }
};

/**
 * Envía un mensaje Push data-only (sin bloque notification: { title, body })
 * para indicarle al frontend o app móvil que actualice el perfil del usuario inmediatamente.
 */
export const enviarPushActualizarPerfil = async (
  fcmToken: string,
  extraData: Record<string, string> = {},
) => {
  if (!fcmToken || fcmToken.trim() === "") {
    console.warn("⚠️ [FCM] No se proporcionó un fcm_token válido para ACTUALIZAR_PERFIL.");
    return null;
  }

  const payload = {
    token: fcmToken.trim(),
    data: {
      tipo: "ACTUALIZAR_PERFIL",
      ...extraData,
    },
    android: {
      priority: "high" as const,
    },
    apns: {
      headers: {
        "apns-priority": "5",
        "apns-push-type": "background",
      },
      payload: {
        aps: {
          contentAvailable: true,
        },
      },
    },
  };

  try {
    const res = await messaging.send(payload);
    console.log("🔔 [FCM] Mensaje data-only ACTUALIZAR_PERFIL enviado con éxito:", res);
    return res;
  } catch (err) {
    console.error("❌ [FCM] Error enviando mensaje data-only ACTUALIZAR_PERFIL:", err);
    return null;
  }
};

/**
 * Busca el token FCM del usuario y le envía el mensaje data-only ACTUALIZAR_PERFIL
 */
export const notificarActualizacionPerfilUsuario = async (
  uid: string,
  extraData: Record<string, string> = {},
) => {
  if (!uid) return null;
  try {
    let fcmToken: string | null = null;
    const userDocDirect = await db.collection("users").doc(uid).get();
    if (userDocDirect.exists) {
      const uData = userDocDirect.data();
      fcmToken =
        uData?.sistema?.fcmToken ||
        uData?.sistema?.fcm_token ||
        uData?.fcmToken ||
        uData?.fcm_token ||
        null;
    }

    if (!fcmToken) {
      const snapshot = await db.collection("users")
        .where("uid", "==", uid)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const uData = snapshot.docs[0].data();
        fcmToken =
          uData?.sistema?.fcmToken ||
          uData?.sistema?.fcm_token ||
          uData?.fcmToken ||
          uData?.fcm_token ||
          null;
      }
    }

    if (fcmToken) {
      return await enviarPushActualizarPerfil(fcmToken, extraData);
    } else {
      console.log(`ℹ️ [FCM] El usuario ${uid} no tiene fcm_token registrado para ACTUALIZAR_PERFIL.`);
      return null;
    }
  } catch (error) {
    console.error("❌ [FCM] Error en notificarActualizacionPerfilUsuario:", error);
    return null;
  }
};

/**
 * Obtiene todas las notificaciones de un usuario ordenadas de más reciente a más antigua.
 */
export const obtenerNotificacionesPorUsuarioService = async (uid: string): Promise<Notificacion[]> => {
  if (!uid) return [];

  try {
    const notificacionesMap = new Map<string, Notificacion>();

    // Consultar por uidDestinatario
    const snap1 = await db.collection("notificaciones")
      .where("uidDestinatario", "==", uid)
      .get();

    snap1.docs.forEach((doc: any) => {
      const data = doc.data();
      notificacionesMap.set(doc.id, {
        id: doc.id,
        idDoc: doc.id,
        ...data,
      });
    });

    // Consultar por idDestinatario como respaldo
    const snap2 = await db.collection("notificaciones")
      .where("idDestinatario", "==", uid)
      .get();

    snap2.docs.forEach((doc: any) => {
      const data = doc.data();
      notificacionesMap.set(doc.id, {
        id: doc.id,
        idDoc: doc.id,
        ...data,
      });
    });

    // Convertir a array y ordenar cronológicamente descendente
    const lista = Array.from(notificacionesMap.values());
    lista.sort((a, b) => {
      const timeA = new Date(a.fechaCreacion || a.fecha || (a as any).createdAt || 0).getTime();
      const timeB = new Date(b.fechaCreacion || b.fecha || (b as any).createdAt || 0).getTime();
      return timeB - timeA;
    });

    return lista;
  } catch (error) {
    console.error("❌ Error en obtenerNotificacionesPorUsuarioService:", error);
    return [];
  }
};

/**
 * Marca una sola notificación como leída.
 */
export const marcarNotificacionLeidaService = async (idNotificacion: string) => {
  if (!idNotificacion) throw new Error("ID de notificación requerido");

  try {
    const docRef = db.collection("notificaciones").doc(idNotificacion);
    await docRef.set({
      leido: true,
      actualizadoEn: new Date().toISOString(),
    }, { merge: true });

    return { id: idNotificacion, leido: true };
  } catch (error) {
    console.error("❌ Error en marcarNotificacionLeidaService:", error);
    throw new Error("No se pudo marcar la notificación como leída");
  }
};

/**
 * Marca todas las notificaciones no leídas de un usuario como leídas.
 */
export const marcarTodasNotificacionesLeidasService = async (uid: string) => {
  if (!uid) throw new Error("UID de usuario requerido");

  try {
    const snapshot = await db.collection("notificaciones")
      .where("uidDestinatario", "==", uid)
      .where("leido", "==", false)
      .get();

    if (snapshot.empty) {
      return { totalActualizadas: 0 };
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.update(doc.ref, {
        leido: true,
        actualizadoEn: new Date().toISOString(),
      });
    });

    await batch.commit();
    return { totalActualizadas: snapshot.size };
  } catch (error) {
    console.error("❌ Error en marcarTodasNotificacionesLeidasService:", error);
    throw new Error("No se pudieron marcar todas las notificaciones como leídas");
  }
};

/**
 * Elimina una notificación por su ID.
 */
export const eliminarNotificacionService = async (idNotificacion: string) => {
  if (!idNotificacion) throw new Error("ID de notificación requerido");

  try {
    const docRef = db.collection("notificaciones").doc(idNotificacion);
    await docRef.delete();
    return { success: true, id: idNotificacion };
  } catch (error) {
    console.error("❌ Error en eliminarNotificacionService:", error);
    throw new Error("No se pudo eliminar la notificación");
  }
};

/**
 * Obtiene el conteo total de notificaciones no leídas para el badge de la campana.
 */
export const obtenerNotificacionesNoLeidasCountService = async (uid: string): Promise<number> => {
  if (!uid) return 0;

  try {
    const snapshot = await db.collection("notificaciones")
      .where("uidDestinatario", "==", uid)
      .where("leido", "==", false)
      .get();

    return snapshot.size;
  } catch (error) {
    console.error("❌ Error en obtenerNotificacionesNoLeidasCountService:", error);
    return 0;
  }
};
