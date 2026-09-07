import { db } from "../config/firebase.ts";
import {
  MensajeTicket,
  MetadataSoporte,
  ReporteSoporte,
} from "../models/soporte.model.ts";
import { enviarPushAUsuario } from "./notification.service.ts";

/**
 * Envía una notificación a un chat/canal de Telegram si las variables de entorno están configuradas
 */
export const enviarAlertaTelegram = async (mensaje: string): Promise<boolean> => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
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
 * Normaliza cualquier documento de reporte para garantizar que 'metadata.mensajes' contenga
 * el hilo completo de mensajes, compatible tanto con reportes nuevos como antiguos.
 */
export const normalizarReporteSoporte = (idDoc: string, data: any): ReporteSoporte => {
  const metadata: MetadataSoporte = data.metadata || {};
  let mensajes: MensajeTicket[] = Array.isArray(metadata.mensajes) ? [...metadata.mensajes] : [];

  if (mensajes.length === 0) {
    if (data.descripcion) {
      mensajes.push({
        id: `msg_init_${idDoc}`,
        remitente: "usuario",
        autorId: data.uid || "anonimo",
        autorNombre: data.nombreUsuario || "Usuario",
        texto: data.descripcion,
        fecha: data.fecha || data.createdAt || new Date().toISOString(),
        ...(data.comprobanteUrl ? { comprobanteUrl: data.comprobanteUrl } : {}),
      });
    }
    if (data.respuesta) {
      mensajes.push({
        id: `msg_resp_${idDoc}`,
        remitente: "soporte",
        autorNombre: data.respondidoPor || "Soporte Homero",
        texto: data.respuesta,
        fecha: data.fechaRespuesta || data.updatedAt || data.fecha || new Date().toISOString(),
        ...(data.comprobanteUrl ? { comprobanteUrl: data.comprobanteUrl } : {}),
      });
    }
  }

  const ultimoMensaje =
    metadata.ultimoMensaje ||
    (mensajes.length > 0 ? mensajes[mensajes.length - 1].texto : data.respuesta || data.descripcion || "");
  const ultimoRemitente =
    metadata.ultimoRemitente ||
    (mensajes.length > 0 ? mensajes[mensajes.length - 1].remitente : data.respuesta ? "soporte" : "usuario");
  const ultimaFecha =
    metadata.ultimaFecha ||
    (mensajes.length > 0 ? mensajes[mensajes.length - 1].fecha : data.fechaRespuesta || data.updatedAt || data.fecha || data.createdAt || "");

  return {
    id: idDoc,
    idDoc,
    uid: data.uid || "anonimo",
    nombreUsuario: data.nombreUsuario || "Usuario",
    email: data.email || "",
    categoria: data.categoria || "otro",
    asunto: data.asunto || "Reporte de soporte",
    descripcion: data.descripcion || "",
    userAgent: data.userAgent || "",
    plataforma: data.plataforma || "web",
    appVersion: data.appVersion || "1.0.0",
    estado: data.estado || "pendiente",
    fecha: data.fecha || data.createdAt || new Date().toISOString(),
    respuesta: data.respuesta || "",
    fechaRespuesta: data.fechaRespuesta || "",
    respondidoPor: data.respondidoPor || "",
    comprobanteUrl: data.comprobanteUrl || metadata.comprobanteUrl || "",
    createdAt: data.createdAt || data.fecha || new Date().toISOString(),
    updatedAt: data.updatedAt || data.fechaRespuesta || data.createdAt || new Date().toISOString(),
    metadata: {
      ...metadata,
      mensajes,
      ultimoMensaje,
      ultimoRemitente,
      ultimaFecha,
      ...(data.comprobanteUrl ? { comprobanteUrl: data.comprobanteUrl } : {}),
    },
  };
};

/**
 * Guarda un reporte de soporte en Firestore asegurando la estructura de metadata.mensajes y envía alertas
 */
export const crearReporteService = async (datos: Partial<ReporteSoporte>) => {
  try {
    const fechaActual = new Date().toISOString();
    const nombreUsuario = datos.nombreUsuario || "Usuario";
    const uid = datos.uid || "anonimo";
    const descripcion = datos.descripcion || datos.asunto || "";
    const categoria = datos.categoria || "otro";
    const asunto = datos.asunto || "Reporte de soporte";

    // Mensaje inicial del hilo
    const mensajeInicial: MensajeTicket = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      remitente: "usuario",
      autorId: uid,
      autorNombre: nombreUsuario,
      texto: descripcion,
      fecha: datos.fecha || fechaActual,
      ...(datos.comprobanteUrl ? { comprobanteUrl: datos.comprobanteUrl } : {}),
      ...(datos.metadata?.comprobanteUrl ? { comprobanteUrl: datos.metadata.comprobanteUrl } : {}),
    };

    const mensajes =
      datos.metadata?.mensajes && Array.isArray(datos.metadata.mensajes) && datos.metadata.mensajes.length > 0
        ? datos.metadata.mensajes
        : [mensajeInicial];

    const metadataFinal: MetadataSoporte = {
      ...(datos.metadata || {}),
      mensajes,
      ultimoMensaje: datos.metadata?.ultimoMensaje || descripcion,
      ultimoRemitente: datos.metadata?.ultimoRemitente || "usuario",
      ultimaFecha: datos.metadata?.ultimaFecha || datos.fecha || fechaActual,
      ...(datos.comprobanteUrl ? { comprobanteUrl: datos.comprobanteUrl } : {}),
    };

    const nuevoReporte: ReporteSoporte = {
      uid,
      nombreUsuario,
      email: datos.email || "",
      categoria,
      asunto,
      descripcion,
      userAgent: datos.userAgent || "",
      plataforma: datos.plataforma || "web",
      appVersion: datos.appVersion || "1.0.0",
      estado: datos.estado || "pendiente",
      fecha: datos.fecha || fechaActual,
      createdAt: fechaActual,
      updatedAt: fechaActual,
      metadata: metadataFinal,
      ...(datos.comprobanteUrl ? { comprobanteUrl: datos.comprobanteUrl } : {}),
    };

    // Guardar en Firestore
    const docRef = await db.collection("reportes_soporte").add(nuevoReporte);
    console.log(`📩 [NUEVO REPORTE] [${nuevoReporte.categoria}] Doc ID: ${docRef.id} de ${nuevoReporte.nombreUsuario} (${nuevoReporte.email}): ${nuevoReporte.asunto}`);

    // Construir alerta para Telegram
    const esRetiro = categoria === "solicitud_retiro";
    const cabeceraAlerta = esRetiro
      ? `💰 *¡NUEVA SOLICITUD DE RETIRO DE FONDOS!* 💰`
      : `🚨 *Nuevo Reporte de Soporte* 🚨`;

    const mensajeTelegram = [
      cabeceraAlerta,
      `━━━━━━━━━━━━━━━━━━━`,
      `🆔 *Ticket ID:* \`${docRef.id}\``,
      `👤 *Usuario:* ${nuevoReporte.nombreUsuario}`,
      `📧 *Email:* ${nuevoReporte.email}`,
      `🆔 *UID:* \`${nuevoReporte.uid}\``,
      `📂 *Categoría:* #${nuevoReporte.categoria}`,
      `📌 *Asunto:* ${nuevoReporte.asunto}`,
      `📱 *Versión:* ${nuevoReporte.appVersion}`,
      `📝 *Mensaje:*\n${nuevoReporte.descripcion}`,
      nuevoReporte.comprobanteUrl ? `📎 *Comprobante:* ${nuevoReporte.comprobanteUrl}` : ``,
      `🕒 *Fecha:* ${nuevoReporte.fecha}`,
      `━━━━━━━━━━━━━━━━━━━`,
    ].filter(Boolean).join("\n");

    enviarAlertaTelegram(mensajeTelegram).catch((err) => {
      console.warn("⚠️ No se pudo enviar notificación de Telegram:", err);
    });

    return normalizarReporteSoporte(docRef.id, nuevoReporte);
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
    const reportes: ReporteSoporte[] = snapshot.docs.map((doc: any) =>
      normalizarReporteSoporte(doc.id, doc.data())
    );

    // Ordenar por fecha descendente
    reportes.sort((a, b) => {
      const timeA = new Date(a.metadata?.ultimaFecha || a.fecha || a.createdAt || 0).getTime();
      const timeB = new Date(b.metadata?.ultimaFecha || b.fecha || b.createdAt || 0).getTime();
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

    const reportes: ReporteSoporte[] = snapshot.docs.map((doc: any) =>
      normalizarReporteSoporte(doc.id, doc.data())
    );

    // Ordenar de más reciente a más antiguo
    reportes.sort((a, b) => {
      const timeA = new Date(a.metadata?.ultimaFecha || a.fecha || a.createdAt || 0).getTime();
      const timeB = new Date(b.metadata?.ultimaFecha || b.fecha || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return reportes;
  } catch (error) {
    console.error("❌ Error en obtenerReportesUsuarioService:", error);
    throw new Error("Error al obtener los reportes del usuario");
  }
};

/**
 * Obtiene un único reporte por su ID con metadata normalizada
 */
export const obtenerReportePorIdService = async (idDoc: string) => {
  try {
    const docRef = db.collection("reportes_soporte").doc(idDoc);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    return normalizarReporteSoporte(idDoc, doc.data());
  } catch (error) {
    console.error("❌ Error en obtenerReportePorIdService:", error);
    throw new Error("Error al obtener el reporte por ID");
  }
};

export interface ResponderReporteParams {
  idDoc: string;
  respuesta: string;
  estado?: string;
  respondidoPor?: string;
  metadata?: any;
  remitente?: "usuario" | "soporte" | "admin" | string;
  autorId?: string;
  autorNombre?: string;
  comprobanteUrl?: string;
  imagenUrl?: string;
}

/**
 * Responde a un reporte, guarda el mensaje en el hilo metadata.mensajes y envía
 * notificación Push al usuario o alerta por Telegram al administrador
 */
export const responderReporteService = async (params: ResponderReporteParams | string, ...legacyArgs: any[]) => {
  try {
    let idDoc: string;
    let respuesta: string;
    let estado: string = "respondido";
    let respondidoPor: string = "Equipo de Homero";
    let metadataParam: any = undefined;
    let remitenteParam: string | undefined = undefined;
    let autorIdParam: string | undefined = undefined;
    let autorNombreParam: string | undefined = undefined;
    let comprobanteUrlParam: string | undefined = undefined;
    let imagenUrlParam: string | undefined = undefined;

    if (typeof params === "object" && params !== null) {
      idDoc = params.idDoc;
      respuesta = params.respuesta;
      estado = params.estado || "respondido";
      respondidoPor = params.respondidoPor || "Equipo de Homero";
      metadataParam = params.metadata;
      remitenteParam = params.remitente;
      autorIdParam = params.autorId;
      autorNombreParam = params.autorNombre;
      comprobanteUrlParam = params.comprobanteUrl;
      imagenUrlParam = params.imagenUrl;
    } else {
      idDoc = params;
      respuesta = legacyArgs[0] || "";
      estado = legacyArgs[1] || "respondido";
      respondidoPor = legacyArgs[2] || "Equipo de Homero";
      metadataParam = legacyArgs[3];
    }

    const reporteRef = db.collection("reportes_soporte").doc(idDoc);
    const reporteDoc = await reporteRef.get();

    if (!reporteDoc.exists) {
      return null;
    }

    const reporteData = reporteDoc.data() || {};
    const fechaRespuesta = new Date().toISOString();

    // Determinar remitente efectivo: 'usuario' o 'soporte'
    const remitenteFinal: "usuario" | "soporte" | string =
      remitenteParam ||
      (respondidoPor?.toLowerCase().includes("usuario") || respondidoPor === reporteData.nombreUsuario
        ? "usuario"
        : "soporte");

    const autorNombreFinal =
      autorNombreParam ||
      respondidoPor ||
      (remitenteFinal === "usuario" ? reporteData.nombreUsuario || "Usuario" : "Soporte Homero");

    // Construir el nuevo mensaje
    const nuevoMensaje: MensajeTicket = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      remitente: remitenteFinal,
      autorId: autorIdParam || (remitenteFinal === "usuario" ? reporteData.uid || "anonimo" : "soporte"),
      autorNombre: autorNombreFinal,
      texto: respuesta,
      fecha: fechaRespuesta,
      ...(comprobanteUrlParam ? { comprobanteUrl: comprobanteUrlParam } : {}),
      ...(imagenUrlParam ? { imagenUrl: imagenUrlParam } : {}),
    };

    // Obtener los mensajes previos existentes
    const reporteNormalizado = normalizarReporteSoporte(idDoc, reporteData);
    let mensajesBase: MensajeTicket[] = reporteNormalizado.metadata?.mensajes || [];

    // Si viene una lista completa en metadata.mensajes pasada por el cliente
    if (metadataParam?.mensajes && Array.isArray(metadataParam.mensajes) && metadataParam.mensajes.length > 0) {
      const contieneNuevo = metadataParam.mensajes.some(
        (m: MensajeTicket) => m.texto === respuesta && m.remitente === remitenteFinal
      );
      mensajesBase = contieneNuevo ? metadataParam.mensajes : [...metadataParam.mensajes, nuevoMensaje];
    } else {
      mensajesBase = [...mensajesBase, nuevoMensaje];
    }

    const metadataActualizado: MetadataSoporte = {
      ...(reporteData.metadata || {}),
      ...(metadataParam || {}),
      mensajes: mensajesBase,
      ultimoMensaje: respuesta,
      ultimoRemitente: remitenteFinal,
      ultimaFecha: fechaRespuesta,
      ...(comprobanteUrlParam ? { comprobanteUrl: comprobanteUrlParam } : {}),
    };

    const docUpdatePayload: Record<string, any> = {
      respuesta,
      estado,
      fechaRespuesta,
      respondidoPor: autorNombreFinal,
      metadata: metadataActualizado,
      updatedAt: fechaRespuesta,
    };

    if (comprobanteUrlParam) {
      docUpdatePayload.comprobanteUrl = comprobanteUrlParam;
    }

    // 1. Actualizar en Firestore
    await reporteRef.update(docUpdatePayload);

    // 2. Lógica de NOTIFICACIONES
    if (remitenteFinal !== "usuario") {
      // Mensaje de SOPORTE / ADMIN -> Enviar Push al Celular del Usuario
      if (reporteData.uid && reporteData.uid !== "anonimo") {
        const esRetiro = reporteData.categoria === "solicitud_retiro";
        let tituloNotif = "Respuesta de Soporte 🛠️";
        let mensajeNotif = `Hemos respondido a tu reporte "${reporteData.asunto || 'soporte'}": ${respuesta}`;

        if (esRetiro) {
          if (
            comprobanteUrlParam ||
            respuesta.toLowerCase().includes("comprobante") ||
            respuesta.toLowerCase().includes("pago") ||
            respuesta.toLowerCase().includes("transferido") ||
            respuesta.toLowerCase().includes("depósito") ||
            respuesta.toLowerCase().includes("deposito")
          ) {
            tituloNotif = "💳 ¡Comprobante de Pago Emitido! 💸";
            mensajeNotif = `Tu retiro de fondos ha sido procesado. Revisa tu comprobante: ${respuesta}`;
          } else {
            tituloNotif = "💰 Solicitud de Retiro de Fondos";
            mensajeNotif = `Equipo de Homero: ${respuesta}`;
          }
        }

        if (mensajeNotif.length > 150) {
          mensajeNotif = mensajeNotif.substring(0, 147) + "...";
        }

        try {
          await enviarPushAUsuario(reporteData.uid, tituloNotif, mensajeNotif, {
            tipo: "soporte",
            categoria: reporteData.categoria || "soporte",
            idReporte: idDoc,
            idTicket: idDoc,
            asunto: reporteData.asunto || "Soporte",
            comprobanteUrl: comprobanteUrlParam || "",
            accion: "abrir_soporte",
          });
        } catch (pushErr) {
          console.warn("⚠️ [Soporte] No se pudo enviar notificación push:", pushErr);
        }
      }
    } else {
      // Mensaje del USUARIO -> Enviar Alerta por Telegram a los Administradores
      const mensajeTelegram = [
        `💬 *Nuevo Mensaje de Usuario en Ticket*`,
        `━━━━━━━━━━━━━━━━━━━`,
        `🆔 *Ticket ID:* \`${idDoc}\``,
        `👤 *Usuario:* ${reporteData.nombreUsuario || 'Usuario'} (\`${reporteData.uid}\`)`,
        `📧 *Email:* ${reporteData.email || 'Sin correo'}`,
        `📂 *Categoría:* #${reporteData.categoria}`,
        `📌 *Asunto:* ${reporteData.asunto}`,
        `💬 *Mensaje:* ${respuesta}`,
        comprobanteUrlParam ? `📎 *Comprobante:* ${comprobanteUrlParam}` : ``,
        `🕒 *Fecha:* ${fechaRespuesta}`,
        `━━━━━━━━━━━━━━━━━━━`,
      ].filter(Boolean).join("\n");

      enviarAlertaTelegram(mensajeTelegram).catch((err) => {
        console.warn("⚠️ No se pudo enviar alerta de Telegram por respuesta de usuario:", err);
      });
    }

    return normalizarReporteSoporte(idDoc, {
      ...reporteData,
      ...docUpdatePayload,
    });
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
  estado: "pendiente" | "en_revision" | "resuelto" | "rechazado" | "respondido" | "cerrado" | string,
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
