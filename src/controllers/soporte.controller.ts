import type { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  actualizarEstadoReporteService,
  crearReporteService,
  obtenerReportePorIdService,
  obtenerReportesService,
  obtenerReportesUsuarioService,
  responderReporteService,
} from "../service/soporte.service.ts";

/**
 * Función utilitaria para extraer el body JSON de forma compatible con diferentes versiones de Oak
 */
const extraerBodyJson = async (ctx: Context): Promise<any> => {
  try {
    if (typeof (ctx.request.body as any)?.json === "function") {
      return await (ctx.request.body as any).json();
    }
    const bodyResult = (ctx.request.body as any)({ type: "json" });
    return await bodyResult.value;
  } catch (err) {
    console.warn("⚠️ No se pudo parsear body JSON directamente:", err);
    return {};
  }
};

/**
 * Registrar un nuevo reporte de soporte
 * POST /api/soporte/reporte o POST /soporte/reporte
 */
export const crearReporteController = async (ctx: Context) => {
  try {
    const body = await extraerBodyJson(ctx);
    const {
      uid,
      nombreUsuario,
      email,
      categoria,
      asunto,
      descripcion,
      userAgent,
      plataforma,
      fecha,
      appVersion,
      metadata,
      comprobanteUrl,
    } = body || {};

    if (!descripcion && !asunto) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        success: false,
        message: "El asunto o la descripción del reporte son obligatorios",
      };
      return;
    }

    const reporteGuardado = await crearReporteService({
      uid: uid || "anonimo",
      nombreUsuario: nombreUsuario || "Usuario",
      email: email || "",
      categoria: categoria || "otro",
      asunto: asunto || "Reporte de soporte",
      descripcion: descripcion || "",
      userAgent: userAgent || "",
      plataforma: plataforma || "web",
      fecha,
      appVersion: appVersion || "1.0.0",
      metadata,
      comprobanteUrl,
    });

    ctx.response.status = 201;
    ctx.response.body = {
      ok: true,
      success: true,
      message: "Reporte creado exitosamente",
      mensaje: "Reporte recibido y registrado correctamente",
      data: reporteGuardado,
    };
  } catch (error: unknown) {
    console.error("❌ Error en crearReporteController:", error);
    const errorMessage = error instanceof Error ? error.message : "Error interno";
    ctx.response.status = 500;
    ctx.response.body = {
      ok: false,
      success: false,
      error: errorMessage,
      message: "Error al procesar el reporte de soporte",
    };
  }
};

/**
 * Obtener listado de reportes (para dashboard/admin)
 * GET /api/soporte/reportes
 */
export const obtenerReportesController = async (ctx: RouterContext<string>) => {
  try {
    const url = ctx.request.url;
    const uid = url.searchParams.get("uid") || undefined;
    const categoria = url.searchParams.get("categoria") || undefined;
    const estado = url.searchParams.get("estado") || undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const reportes = await obtenerReportesService({
      uid,
      categoria,
      estado,
      limit,
    });

    ctx.response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    ctx.response.headers.set("Pragma", "no-cache");
    ctx.response.headers.set("Expires", "0");
    ctx.response.status = 200;
    ctx.response.body = {
      ok: true,
      success: true,
      data: reportes,
    };
  } catch (error: unknown) {
    console.error("❌ Error en obtenerReportesController:", error);
    const errorMessage = error instanceof Error ? error.message : "Error interno";
    ctx.response.status = 500;
    ctx.response.body = {
      ok: false,
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Obtener reportes de un usuario específico
 * GET /api/soporte/reportes/usuario/:uid
 */
export const obtenerReportesUsuarioController = async (ctx: RouterContext<string>) => {
  try {
    const { uid } = ctx.params;
    if (!uid) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        success: false,
        message: "El parámetro UID de usuario es obligatorio",
      };
      return;
    }

    const reportes = await obtenerReportesUsuarioService(uid);

    ctx.response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    ctx.response.headers.set("Pragma", "no-cache");
    ctx.response.headers.set("Expires", "0");
    ctx.response.status = 200;
    ctx.response.body = {
      ok: true,
      success: true,
      data: reportes,
    };
  } catch (error: unknown) {
    console.error("❌ Error en obtenerReportesUsuarioController:", error);
    const errorMessage = error instanceof Error ? error.message : "Error interno";
    ctx.response.status = 500;
    ctx.response.body = {
      ok: false,
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Obtener un reporte individual por su ID
 * GET /api/soporte/reporte/:id
 */
export const obtenerReportePorIdController = async (ctx: RouterContext<string>) => {
  try {
    const { id } = ctx.params;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        success: false,
        message: "El parámetro ID de reporte es obligatorio",
      };
      return;
    }

    const reporte = await obtenerReportePorIdService(id);
    if (!reporte) {
      ctx.response.status = 404;
      ctx.response.body = {
        ok: false,
        success: false,
        error: "Reporte no encontrado",
        message: "Reporte no encontrado",
      };
      return;
    }

    ctx.response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    ctx.response.headers.set("Pragma", "no-cache");
    ctx.response.headers.set("Expires", "0");
    ctx.response.status = 200;
    ctx.response.body = {
      ok: true,
      success: true,
      data: reporte,
    };
  } catch (error: unknown) {
    console.error("❌ Error en obtenerReportePorIdController:", error);
    const errorMessage = error instanceof Error ? error.message : "Error interno";
    ctx.response.status = 500;
    ctx.response.body = {
      ok: false,
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Responder reporte de soporte o enviar mensaje en el chat del ticket
 * POST /api/soporte/reporte/:id/responder y POST /api/soporte/reporte/:id/mensaje
 */
export const responderReporteController = async (ctx: RouterContext<string>) => {
  try {
    const { id } = ctx.params;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        success: false,
        message: "ID de reporte requerido",
      };
      return;
    }

    const body = await extraerBodyJson(ctx);
    const {
      respuesta,
      texto,
      mensaje,
      estado = "respondido",
      respondidoPor = "Equipo de Homero",
      metadata,
      remitente,
      autorId,
      autorNombre,
      comprobanteUrl,
      imagenUrl,
    } = body || {};

    const textoFinal = (respuesta || texto || mensaje || "").trim();

    if (!textoFinal && !comprobanteUrl && !imagenUrl) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        success: false,
        message: "El texto del mensaje o comprobante es obligatorio",
      };
      return;
    }

    const resultado = await responderReporteService({
      idDoc: id,
      respuesta: textoFinal || (comprobanteUrl ? "Se adjuntó comprobante de pago." : "Mensaje"),
      estado,
      respondidoPor,
      metadata,
      remitente,
      autorId,
      autorNombre,
      comprobanteUrl,
      imagenUrl,
    });

    if (!resultado) {
      ctx.response.status = 404;
      ctx.response.body = {
        ok: false,
        success: false,
        error: "Reporte no encontrado",
        message: "Reporte no encontrado",
      };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = {
      ok: true,
      success: true,
      message: "Mensaje y actualización registrados con éxito",
      data: resultado,
    };
  } catch (error: unknown) {
    console.error("❌ Error en responderReporteController:", error);
    const errorMessage = error instanceof Error ? error.message : "Error interno";
    ctx.response.status = 500;
    ctx.response.body = {
      ok: false,
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Actualizar el estado de un reporte
 * PUT /api/soporte/reporte/:id/estado
 */
export const actualizarEstadoReporteController = async (ctx: RouterContext<string>) => {
  try {
    const { id } = ctx.params;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { ok: false, success: false, message: "ID de reporte requerido" };
      return;
    }

    const body = await extraerBodyJson(ctx);
    const { estado } = body || {};

    if (!estado || !["pendiente", "en_revision", "resuelto", "rechazado", "respondido", "cerrado"].includes(estado)) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        success: false,
        message: "Estado inválido. Debe ser: pendiente, en_revision, resuelto, respondido, cerrado o rechazado",
      };
      return;
    }

    const actualizado = await actualizarEstadoReporteService(id, estado);
    if (!actualizado) {
      ctx.response.status = 404;
      ctx.response.body = { ok: false, success: false, message: "Reporte no encontrado" };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = {
      ok: true,
      success: true,
      mensaje: "Estado del reporte actualizado correctamente",
      data: actualizado,
    };
  } catch (error: unknown) {
    console.error("❌ Error en actualizarEstadoReporteController:", error);
    const errorMessage = error instanceof Error ? error.message : "Error interno";
    ctx.response.status = 500;
    ctx.response.body = {
      ok: false,
      success: false,
      error: errorMessage,
    };
  }
};
