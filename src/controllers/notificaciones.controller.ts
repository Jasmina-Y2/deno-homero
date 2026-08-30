import { RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  eliminarNotificacionService,
  marcarNotificacionLeidaService,
  marcarTodasNotificacionesLeidasService,
  obtenerNotificacionesNoLeidasCountService,
  obtenerNotificacionesPorUsuarioService,
} from "../service/notification.service.ts";

/**
 * Obtiene todas las notificaciones de un usuario
 * GET /api/notificaciones/:uid
 */
export const obtenerNotificacionesUsuario = async (ctx: RouterContext<string>) => {
  try {
    const { uid } = ctx.params;
    if (!uid) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "UID de usuario requerido" };
      return;
    }

    const notificaciones = await obtenerNotificacionesPorUsuarioService(uid);
    ctx.response.status = 200;
    ctx.response.body = { success: true, data: notificaciones };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    ctx.response.body = {
      success: false,
      message: "Error al obtener notificaciones",
      error: errorMessage,
    };
  }
};

/**
 * Obtiene el conteo de notificaciones no leídas de un usuario
 * GET /api/notificaciones/no-leidas/:uid
 */
export const obtenerConteoNoLeidas = async (ctx: RouterContext<string>) => {
  try {
    const { uid } = ctx.params;
    if (!uid) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "UID de usuario requerido" };
      return;
    }

    const unreadCount = await obtenerNotificacionesNoLeidasCountService(uid);
    ctx.response.status = 200;
    ctx.response.body = { success: true, unreadCount };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    ctx.response.body = {
      success: false,
      message: "Error al obtener conteo de notificaciones",
      error: errorMessage,
    };
  }
};

/**
 * Marca una notificación como leída por su ID
 * PUT /api/notificaciones/marcar-leida/:id
 */
export const marcarNotificacionLeida = async (ctx: RouterContext<string>) => {
  try {
    const { id } = ctx.params;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "ID de notificación requerido" };
      return;
    }

    const result = await marcarNotificacionLeidaService(id);
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Notificación marcada como leída",
      data: result,
    };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    ctx.response.body = {
      success: false,
      message: "Error al marcar notificación como leída",
      error: errorMessage,
    };
  }
};

/**
 * Marca todas las notificaciones de un usuario como leídas
 * PUT /api/notificaciones/marcar-todas-leidas/:uid
 */
export const marcarTodasNotificacionesLeidas = async (ctx: RouterContext<string>) => {
  try {
    const { uid } = ctx.params;
    if (!uid) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "UID de usuario requerido" };
      return;
    }

    const result = await marcarTodasNotificacionesLeidasService(uid);
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Todas las notificaciones fueron marcadas como leídas",
      data: result,
    };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    ctx.response.body = {
      success: false,
      message: "Error al marcar todas las notificaciones como leídas",
      error: errorMessage,
    };
  }
};

/**
 * Elimina una notificación
 * DELETE /api/notificaciones/eliminar/:id
 */
export const eliminarNotificacion = async (ctx: RouterContext<string>) => {
  try {
    const { id } = ctx.params;
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "ID de notificación requerido" };
      return;
    }

    const result = await eliminarNotificacionService(id);
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Notificación eliminada correctamente",
      data: result,
    };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    ctx.response.body = {
      success: false,
      message: "Error al eliminar la notificación",
      error: errorMessage,
    };
  }
};
