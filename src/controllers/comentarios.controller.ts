import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  eliminarComentarioService,
  guardarComentarioService,
  obtenerComentariosService,
} from "../service/comentarios.service.ts";
import {
  broadcastComentario,
  handleComentariosWebSocket,
  verificarRateLimit,
} from "../service/comentariosSocket.service.ts";

export const guardarComentario = async (ctx: RouterContext<string>) => {
  try {
    const { publicacionId, comentario, uid } = await ctx.request.body.json();

    if (!publicacionId || !comentario) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan datos requeridos (publicacionId, comentario)",
      };
      return;
    }

    // Control de cadencia (Rate Limiting: 3 segundos por usuario)
    const autorUid = uid || comentario?.idAutor || comentario?.uid;
    if (autorUid) {
      const rateCheck = verificarRateLimit(autorUid);
      if (!rateCheck.permitido) {
        const segundos = (rateCheck.restanteMs / 1000).toFixed(1);
        ctx.response.status = 429;
        ctx.response.body = {
          success: false,
          error: "rate_limit",
          message: `Control de cadencia: Espera ${segundos}s antes de enviar otro comentario.`,
          restanteMs: rateCheck.restanteMs,
        };
        return;
      }
    }

    const result = await guardarComentarioService(publicacionId, comentario);

    const comentarioCompleto = {
      idDoc: result.idDoc,
      id: result.idDoc,
      publicacionId,
      ...(typeof comentario === "object" ? comentario : { comentario }),
      createdAt: new Date().toISOString(),
    };

    // Emitir en tiempo real ÚNICAMENTE a la sala del audiolibro/historia
    broadcastComentario(publicacionId, comentarioCompleto);

    ctx.response.status = 201;
    ctx.response.body = {
      ...result,
      data: comentarioCompleto,
    };
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

/**
 * Carga inicial pasiva: Obtiene los últimos comentarios (por defecto 50)
 */
export const obtenerComentarios = async (ctx: RouterContext<string>) => {
  try {
    const { publicacionId } = ctx.params;
    if (!publicacionId) throw new Error("ID de publicación es requerido");

    const limitParam = ctx.request.url.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;

    const data = await obtenerComentariosService(publicacionId, limit);

    ctx.response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    ctx.response.headers.set("Pragma", "no-cache");
    ctx.response.headers.set("Expires", "0");
    ctx.response.status = 200;
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

/**
 * Endpoint WebSocket para comentarios en tiempo real
 * GET /ws/comentarios?publicacionId=:id&uid=:uid
 */
export const comentariosWebSocketController = (ctx: RouterContext<string>) => {
  if (!ctx.isUpgradable) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      message: "La conexión no es actualizable a WebSocket.",
    };
    return;
  }

  const publicacionId = ctx.request.url.searchParams.get("publicacionId");
  const uid = ctx.request.url.searchParams.get("uid");

  const ws = ctx.upgrade();
  handleComentariosWebSocket(ws, publicacionId, uid);
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
