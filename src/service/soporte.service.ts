import { db } from "../config/firebase.ts";
import { ReporteSoporte } from "../models/soporte.model.ts";

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
      nombreUsuario: datos.nombreUsuario || "Usuario no identificado",
      email: datos.email || "Sin email",
      categoria: datos.categoria || "general",
      asunto: datos.asunto || "Sin asunto",
      descripcion: datos.descripcion || "",
      fecha: datos.fecha || fechaActual,
      estado: datos.estado || "pendiente",
      appVersion: datos.appVersion || "1.0.0",
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
      idDoc: docRef.id,
      ...nuevoReporte,
    };
  } catch (error) {
    console.error("❌ Error en crearReporteService:", error);
    throw new Error("Error al registrar el reporte en la base de datos");
  }
};

/**
 * Obtiene lista de reportes con filtros opcionales
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
    return snapshot.docs.map((doc: any) => ({
      idDoc: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("❌ Error en obtenerReportesService:", error);
    throw new Error("Error al obtener los reportes");
  }
};

/**
 * Actualiza el estado de un reporte existente
 */
export const actualizarEstadoReporteService = async (
  idDoc: string,
  estado: "pendiente" | "en_revision" | "resuelto" | "rechazado",
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
      idDoc,
      estado,
      updatedAt,
    };
  } catch (error) {
    console.error("❌ Error en actualizarEstadoReporteService:", error);
    throw new Error("Error al actualizar el estado del reporte");
  }
};
