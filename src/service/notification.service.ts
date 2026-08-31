import { db, messaging } from "../config/firebase.ts";
import { Notificacion } from "../models/notificaciones.model.ts";

/**
 * Interfaz para la función de envío de notificaciones push.
 */
export interface NotificationPayloadData {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Nombres de colecciones para sincronización y compatibilidad en Firestore
 */
const COLECCIONES_NOTIFICACIONES = ["notificaciones", "notificacion", "Notificacion"];

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
 * Guarda una notificación en la colección 'notificaciones', 'notificacion', 'Notificacion'
 * y en el historial del usuario ('users/{uid}/notificaciones').
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

    // 1. Guardar en la colección global 'notificaciones' (plural)
    const notifRef = await db.collection("notificaciones").add(nuevaNotif);

    // 2. Guardar en 'notificacion' (singular) y 'Notificacion' (capitalizada) para asegurar compatibilidad total
    for (const colName of ["notificacion", "Notificacion"]) {
      try {
        await db.collection(colName).doc(notifRef.id).set(nuevaNotif);
      } catch (colErr) {
        console.warn(`⚠️ No se pudo guardar en colección '${colName}':`, colErr);
      }
    }

    // 3. Guardar también en la subcolección 'users/{uid}/notificaciones'
    try {
      await db.collection("users")
        .doc(uidDestinatario)
        .collection("notificaciones")
        .doc(notifRef.id)
        .set(nuevaNotif);
    } catch (subErr) {
      console.warn("⚠️ No se pudo guardar en subcolección de usuario:", subErr);
    }

    console.log(`💾 [Notificación] Guardada con ID ${notifRef.id} en Firestore para usuario ${uidDestinatario}`);
    return { idDoc: notifRef.id, ...nuevaNotif };
  } catch (error) {
    console.error("❌ Error en guardarNotificacionEnBD:", error);
    return null;
  }
};

/**
 * Envía una notificación push buscando el fcmToken guardado del usuario en la base de datos
 * y guarda la notificación en Firestore en 'notificaciones' / 'notificacion'.
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

    // 1. Guardar siempre en la colección 'notificaciones' y 'notificacion' para que quede el rastro
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
 * Obtiene todas las notificaciones de un usuario desde Firestore ('notificaciones' / 'notificacion')
 */
export const obtenerNotificacionesPorUsuarioService = async (uid: string): Promise<Notificacion[]> => {
  try {
    const lista: Notificacion[] = [];
    const idsVistos = new Set<string>();

    for (const colName of COLECCIONES_NOTIFICACIONES) {
      try {
        const snap1 = await db.collection(colName).where("uidUsuario", "==", uid).get();
        snap1.forEach((doc) => {
          if (!idsVistos.has(doc.id)) {
            idsVistos.add(doc.id);
            lista.push({
              idDoc: doc.id,
              id: doc.id,
              ...(doc.data() as Omit<Notificacion, "idDoc" | "id">),
            });
          }
        });

        const snap2 = await db.collection(colName).where("idDestinatario", "==", uid).get();
        snap2.forEach((doc) => {
          if (!idsVistos.has(doc.id)) {
            idsVistos.add(doc.id);
            lista.push({
              idDoc: doc.id,
              id: doc.id,
              ...(doc.data() as Omit<Notificacion, "idDoc" | "id">),
            });
          }
        });
      } catch {
        // Continuar si una colección particular falla o está vacía
      }
    }

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
 * Marca una notificación específica como leída en todas las colecciones
 */
export const marcarNotificacionLeidaService = async (idNotificacion: string) => {
  try {
    const fechaLeido = new Date().toISOString();
    let encontrada = false;
    let uidDestinatario: string | null = null;

    for (const colName of COLECCIONES_NOTIFICACIONES) {
      try {
        const docRef = db.collection(colName).doc(idNotificacion);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          encontrada = true;
          const data = docSnap.data();
          uidDestinatario = data?.uidUsuario || data?.idDestinatario;

          await docRef.update({
            leido: true,
            fechaLeido: fechaLeido,
          });
        }
      } catch {
        // Continuar
      }
    }

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
        // Opcional
      }
    }

    if (encontrada) {
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
    let totalActualizadas = 0;
    const fechaLeido = new Date().toISOString();

    for (const colName of COLECCIONES_NOTIFICACIONES) {
      try {
        const snapshot = await db.collection(colName)
          .where("uidUsuario", "==", uid)
          .where("leido", "==", false)
          .get();

        if (!snapshot.empty) {
          const batch = db.batch();
          snapshot.docs.forEach((doc) => {
            batch.update(doc.ref, {
              leido: true,
              fechaLeido: fechaLeido,
            });
          });
          await batch.commit();
          totalActualizadas += snapshot.size;
        }
      } catch {
        // Continuar
      }
    }

    console.log(`✅ [Notificaciones] Marcadas ${totalActualizadas} notificaciones como leídas para ${uid}`);
    return { success: true, actualizadas: totalActualizadas };
  } catch (error) {
    console.error("❌ Error en marcarTodasNotificacionesLeidasService:", error);
    throw new Error("Error al marcar todas las notificaciones como leídas");
  }
};

/**
 * Elimina una notificación por su ID de todas las colecciones
 */
export const eliminarNotificacionService = async (idNotificacion: string) => {
  try {
    let uidDestinatario: string | null = null;

    for (const colName of COLECCIONES_NOTIFICACIONES) {
      try {
        const docRef = db.collection(colName).doc(idNotificacion);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
          const data = docSnap.data();
          uidDestinatario = data?.uidUsuario || data?.idDestinatario;
          await docRef.delete();
        }
      } catch {
        // Continuar
      }
    }

    if (uidDestinatario) {
      try {
        await db.collection("users")
          .doc(uidDestinatario)
          .collection("notificaciones")
          .doc(idNotificacion)
          .delete();
      } catch {
        // Opcional
      }
    }

    return { success: true, id: idNotificacion };
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
    const idsVistos = new Set<string>();

    for (const colName of COLECCIONES_NOTIFICACIONES) {
      try {
        const snapshot = await db.collection(colName)
          .where("uidUsuario", "==", uid)
          .where("leido", "==", false)
          .get();

        snapshot.docs.forEach((doc) => idsVistos.add(doc.id));
      } catch {
        // Continuar
      }
    }

    return idsVistos.size;
  } catch (error) {
    console.error("❌ Error en obtenerNotificacionesNoLeidasCountService:", error);
    return 0;
  }
};
