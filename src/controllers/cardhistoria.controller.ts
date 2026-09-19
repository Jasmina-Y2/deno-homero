import { CardHistoria } from "../models/cardhistoria.model.ts";
import {
  eliminarCardPorIdService,
  eliminarImagenesDeHistoria,
  getHistoriaCardByCustomId2Service,
  getHistoriaCardByCustomIdService,
  guardarCardHistoriaEnFirestoreService,
  obtenerCardHistoriaService,
} from "../service/cardhistoria.service.ts";
import { generarThumbnailOGService, esUrlVideo, esUrlImagen } from "../service/multimedia.service.ts";
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";

export const crearCardHistoriaController = async (
  ctx: RouterContext<string>,
) => {
  try {
    let body = (ctx.state as any)?.parsedBody;
    if (!body) {
      body = typeof (ctx.request.body as any)?.json === "function"
        ? await (ctx.request.body as any).json()
        : await ctx.request.body.json();
    }
    const user = (ctx.state as any)?.user;
    const isAdmin = Boolean((ctx.state as any)?.isAdmin);
    const uidFromHeader = ctx.request.headers.get("x-user-uid") || ctx.request.headers.get("uid");
    const authorUid = user?.uid || uidFromHeader || body.idAutor || body.uidAutor;

    if (authorUid && !isAdmin) {
      body.idAutor = authorUid;
    }

    // Asegurar que poster siempre se guarde (usando poster enviado, portada, imagen o fallback)
    body.poster = body.poster || body.portada || body.imagen || body.video || "";

    // Limpiar campos redundantes: dejar únicamente 'poster'
    delete body.thumbnail;
    delete body.ogImage;

    const idNuevaCard = await guardarCardHistoriaEnFirestoreService(
      body as CardHistoria,
    );

    ctx.response.status = 201;
    ctx.response.body = {
      success: true,
      message: "Card creada correctamente",
      id: idNuevaCard,
    };
  } catch (error) {
    console.error("❌ Error en controlador CardHistoria:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Error desconocido al guardar la card",
    };
  }
};
export const obtenerCardHistoriaController = async (
  ctx: RouterContext<string>,
) => {
  try {
    const historias = await obtenerCardHistoriaService();

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Historias obtenidas correctamente",
      data: historias,
    };
  } catch (error) {
    console.error("❌ Error en controlador obtenerCardHistoria:", error);

    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error
        ? error.message
        : "Error desconocido al obtener las historias",
    };
  }
};

export const eliminarCardController = async (ctx: RouterContext<string>) => {
  try {
    const idCard = ctx.params.id;
    const user = (ctx.state as any)?.user;
    const isAdmin = Boolean((ctx.state as any)?.isAdmin);
    const uidFromParams = ctx.request.url.searchParams.get("uid") ||
      ctx.request.url.searchParams.get("idAutor") ||
      ctx.request.headers.get("x-user-uid") ||
      ctx.request.headers.get("uid");
    const userUid = user?.uid || uidFromParams || undefined;

    if (!idCard) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "Falta el ID de la card" };
      return;
    }

    const resultado = await eliminarCardPorIdService(idCard, userUid, isAdmin);

    if (resultado.success) {
      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "Historia eliminada correctamente",
      };
    } else if (resultado.motivo === "FORBIDDEN") {
      ctx.response.status = 403;
      ctx.response.body = {
        success: false,
        message: "Acceso denegado: Solo el autor o un Administrador pueden eliminar esta historia.",
      };
    } else {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "No se encontró ninguna historia con ese ID",
      };
    }
  } catch (error) {
    console.error("❌ Error en controlador eliminar:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error interno del servidor",
    };
  }
};

export const eliminarMultimediaController = async (
  ctx: RouterContext<string>,
) => {
  try {
    const id = ctx.params.id;
    const user = (ctx.state as any)?.user;
    const isAdmin = Boolean((ctx.state as any)?.isAdmin);
    const uidFromParams = ctx.request.url.searchParams.get("uid") ||
      ctx.request.url.searchParams.get("idAutor") ||
      ctx.request.headers.get("x-user-uid") ||
      ctx.request.headers.get("uid");
    const userUid = user?.uid || uidFromParams || undefined;

    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el ID de la historia (customId)",
      };
      return;
    }
    await eliminarImagenesDeHistoria(id, userUid, isAdmin);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Proceso de eliminación de multimedia finalizado",
    };
  } catch (error: any) {
    if (error?.message === "FORBIDDEN") {
      ctx.response.status = 403;
      ctx.response.body = {
        success: false,
        message: "Acceso denegado: Solo el autor o un Administrador pueden limpiar la multimedia de esta historia.",
      };
      return;
    }
    if (error?.message === "NOT_FOUND") {
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: "Historia no encontrada.",
      };
      return;
    }
    console.error("❌ Error en controlador multimedia:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error interno al intentar eliminar multimedia",
    };
  }
};

export const getHistoriaCardByAutor = async (ctx: RouterContext<string>) => {
  try {
    const idAutor = ctx.params.idAutor;
    const data = await getHistoriaCardByCustomId2Service(idAutor!);
    ctx.response.status = 200;
    ctx.response.body = { success: true, data };
  } catch (error: any) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, message: error.message };
  }
};
export const getHistoriaCardById = async (ctx: RouterContext<string>) => {
  try {
    const id = ctx.params.id;
    const data = await getHistoriaCardByCustomIdService(id!);
    ctx.response.status = 200;
    ctx.response.body = { success: true, data };
  } catch (error: any) {
    ctx.response.status = 500;
    ctx.response.body = { success: false, message: error.message };
  }
};
