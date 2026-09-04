import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  eliminarComentarioService,
  guardarComentarioService,
  obtenerComentariosService,
} from "../service/comentarios.service.ts";

export const guardarComentario = async (ctx: RouterContext<string>) => {
  try {
    const { publicacionId, comentario } = await ctx.request.body.json();

    if (!publicacionId || !comentario) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan datos requeridos",
      };
      return;
    }

    const result = await guardarComentarioService(publicacionId, comentario);
    ctx.response.body = result;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Error al guardar comentario",
    };
  }
};

export const obtenerComentarios = async (ctx: RouterContext<string>) => {
  try {
    const { publicacionId } = ctx.params;
    if (!publicacionId) throw new Error("ID de publicación es requerido");

    const data = await obtenerComentariosService(publicacionId);
    ctx.response.body = { success: true, data };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Error al obtener comentarios",
    };
  }
};

export const eliminarComentario = async (ctx: RouterContext<string>) => {
  try {
    const idComentario = ctx.params?.id || ctx.request.url.searchParams.get("id");

    if (!idComentario || idComentario.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El ID del comentario es requerido",
      };
      return;
    }

    const eliminado = await eliminarComentarioService(idComentario.trim());

    if (eliminado) {
      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "Comentario eliminado exitosamente",
        id: idComentario,
      };
    } else {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "No se encontró ningún comentario con ese ID",
      };
    }
  } catch (error) {
    console.error("❌ Error en eliminarComentario controller:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Error interno al eliminar el comentario",
    };
  }
};
