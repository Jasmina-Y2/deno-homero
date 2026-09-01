import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
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
