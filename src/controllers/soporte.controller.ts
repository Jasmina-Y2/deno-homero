import type { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  actualizarEstadoReporteService,
  crearReporteService,
  obtenerReportesService,
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
    const { uid, nombreUsuario, email, categoria, asunto, descripcion, fecha, appVersion, metadata } = body || {};

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
      uid,
      nombreUsuario,
      email,
      categoria: categoria || "general",
      asunto: asunto || "Reporte de usuario",
      descripcion: descripcion || "",
      fecha,
      appVersion,
      metadata,
    });

    ctx.response.status = 201;
    ctx.response.body = {
      ok: true,
      success: true,
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
 * Obtener listado de reportes (opcional para dashboard/admin)
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

    if (!estado || !["pendiente", "en_revision", "resuelto", "rechazado"].includes(estado)) {
      ctx.response.status = 400;
      ctx.response.body = {
        ok: false,
        success: false,
        message: "Estado inválido. Debe ser: pendiente, en_revision, resuelto o rechazado",
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
