import { db } from "../config/firebase.ts";
import { ReporteSoporte } from "../models/soporte.model.ts";
import { enviarPushAUsuario } from "./notification.service.ts";

/**
 * Envía una notificación a un chat/canal de Telegram si las variables de entorno están configuradas
 */
export const enviarAlertaTelegram = async (mensaje: string): Promise<boolean> => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    // Si no están configuradas las variables, simplemente no se envía sin romper el flujo
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensaje,
        parse_mode: "Markdown",
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.warn("⚠️ Telegram API error:", data.description);
      return false;
    }
    console.log("📲 Alerta enviada a Telegram con éxito.");
    return true;
  } catch (error) {
    console.error("❌ Error enviando mensaje a Telegram:", error);
    return false;
  }
};

/**
 * Guarda un reporte de soporte en Firestore y envía alertas si aplica
 */
export const crearReporteService = async (datos: Partial<ReporteSoporte>) => {
  try {
    const fechaActual = new Date().toISOString();

    const nuevoReporte: ReporteSoporte = {
      uid: datos.uid || "anonimo",
      nombreUsuario: datos.nombreUsuario || "Usuario",
      email: datos.email || "",
      categoria: datos.categoria || "otro",
      asunto: datos.asunto || "Reporte de soporte",
      descripcion: datos.descripcion || "",
      userAgent: datos.userAgent || "",
      plataforma: datos.plataforma || "web",
      appVersion: datos.appVersion || "1.0.0",
      estado: datos.estado || "pendiente",
      fecha: datos.fecha || fechaActual,
      createdAt: fechaActual,
      metadata: datos.metadata || {},
    };

    // Guardar en Firestore
    const docRef = await db.collection("reportes_soporte").add(nuevoReporte);
    console.log(`📩 [NUEVO REPORTE] [${nuevoReporte.categoria}] Doc ID: ${docRef.id} de ${nuevoReporte.nombreUsuario} (${nuevoReporte.email}): ${nuevoReporte.asunto}`);

    // Construir mensaje para alerta opcional de Telegram
    const mensajeTelegram = [
      `🚨 *Nuevo Reporte de Soporte* 🚨`,
      `━━━━━━━━━━━━━━━━━━━`,
      `👤 *Usuario:* ${nuevoReporte.nombreUsuario}`,
      `📧 *Email:* ${nuevoReporte.email}`,
      `🆔 *UID:* \`${nuevoReporte.uid}\``,
      `📂 *Categoría:* #${nuevoReporte.categoria}`,
      `📌 *Asunto:* ${nuevoReporte.asunto}`,
      `📱 *Versión:* ${nuevoReporte.appVersion}`,
      `📝 *Descripción:*\n${nuevoReporte.descripcion}`,
      `🕒 *Fecha:* ${nuevoReporte.fecha}`,
      `━━━━━━━━━━━━━━━━━━━`,
    ].join("\n");

    // Intenta enviar alerta por Telegram en background sin bloquear respuesta
    enviarAlertaTelegram(mensajeTelegram).catch((err) => {
      console.warn("⚠️ No se pudo enviar notificación de Telegram:", err);
    });

    return {
      id: docRef.id,
      idDoc: docRef.id,
      ...nuevoReporte,
    };
  } catch (error) {
    console.error("❌ Error en crearReporteService:", error);
    throw new Error("Error al registrar el reporte en la base de datos");
  }
};

/**
 * Obtiene lista de reportes con filtros opcionales ordenados por fecha descendente
 */
export const obtenerReportesService = async (filtros?: {
  uid?: string;
  categoria?: string;
  estado?: string;
  limit?: number;
}) => {
  try {
    let query: any = db.collection("reportes_soporte");

    if (filtros?.uid) {
      query = query.where("uid", "==", filtros.uid);
    }

    if (filtros?.categoria) {
      query = query.where("categoria", "==", filtros.categoria);
    }

    if (filtros?.estado) {
      query = query.where("estado", "==", filtros.estado);
    }

    if (filtros?.limit) {
      query = query.limit(filtros.limit);
    }

    const snapshot = await query.get();
    const reportes = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      idDoc: doc.id,
      ...doc.data(),
    }));

    // Ordenar por fecha descendente
    reportes.sort((a: any, b: any) => {
      const timeA = new Date(a.fecha || a.createdAt || 0).getTime();
      const timeB = new Date(b.fecha || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return reportes;
  } catch (error) {
    console.error("❌ Error en obtenerReportesService:", error);
    throw new Error("Error al obtener los reportes");
  }
};

/**
 * Obtiene los reportes de un usuario específico ordenados por fecha descendente
 */
export const obtenerReportesUsuarioService = async (uid: string) => {
  try {
    const snapshot = await db
      .collection("reportes_soporte")
      .where("uid", "==", uid)
      .get();

    const reportes = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      idDoc: doc.id,
      ...doc.data(),
    }));

    // Ordenar de más reciente a más antiguo
    reportes.sort((a: any, b: any) => {
      const timeA = new Date(a.fecha || a.createdAt || 0).getTime();
      const timeB = new Date(b.fecha || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return reportes;
  } catch (error) {
    console.error("❌ Error en obtenerReportesUsuarioService:", error);
    throw new Error("Error al obtener los reportes del usuario");
  }
};

/**
 * Responde a un reporte y genera la notificación en Firestore para el usuario
 */
export const responderReporteService = async (
  idDoc: string,
  respuesta: string,
  estado: string = "resuelto",
  respondidoPor: string = "Equipo de Homero",
) => {
  try {
    const reporteRef = db.collection("reportes_soporte").doc(idDoc);
    const reporteDoc = await reporteRef.get();

    if (!reporteDoc.exists) {
      return null;
    }

    const reporteData = reporteDoc.data() || {};
    const fechaRespuesta = new Date().toISOString();

    // 1. Actualizar el reporte con la respuesta
    await reporteRef.update({
      respuesta,
      estado,
      fechaRespuesta,
      respondidoPor,
      updatedAt: fechaRespuesta,
    });

    // 2. Enviar Push Notification si el usuario cuenta con token FCM
    if (reporteData.uid) {
      const tituloNotif = "Respuesta de Soporte 🛠️";
      const asuntoTexto = reporteData.asunto || "Reporte de soporte";
      const mensajeNotif = `Hemos respondido a tu reporte "${asuntoTexto}": ${respuesta}`;

      try {
        await enviarPushAUsuario(reporteData.uid, tituloNotif, mensajeNotif, {
          tipo: "soporte",
          idReporte: idDoc,
          asunto: asuntoTexto,
        });
      } catch (pushErr) {
        console.warn("⚠️ [Soporte] No se pudo enviar notificación push:", pushErr);
      }
    }

    return {
      id: idDoc,
      idDoc,
      ...reporteData,
      respuesta,
      estado,
      fechaRespuesta,
      respondidoPor,
      updatedAt: fechaRespuesta,
    };
  } catch (error) {
    console.error("❌ Error en responderReporteService:", error);
    throw new Error("Error al responder el reporte de soporte");
  }
};

/**
 * Actualiza el estado de un reporte existente
 */
export const actualizarEstadoReporteService = async (
  idDoc: string,
  estado: "pendiente" | "en_revision" | "resuelto" | "rechazado" | string,
) => {
  try {
    const docRef = db.collection("reportes_soporte").doc(idDoc);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const updatedAt = new Date().toISOString();
    await docRef.update({
      estado,
      updatedAt,
    });

    return {
      id: idDoc,
      idDoc,
      estado,
      updatedAt,
    };
  } catch (error) {
    console.error("❌ Error en actualizarEstadoReporteService:", error);
    throw new Error("Error al actualizar el estado del reporte");
  }
};

