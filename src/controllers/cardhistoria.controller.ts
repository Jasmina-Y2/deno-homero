import { CardHistoria } from "../models/cardhistoria.model.ts";
import {
  eliminarCardPorIdService,
  eliminarImagenesDeHistoria,
  getHistoriaCardByCustomId2Service,
  getHistoriaCardByCustomIdService,
  guardarCardHistoriaEnFirestoreService,
  obtenerCardHistoriaService,
} from "../service/cardhistoria.service.ts";
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";

export const crearCardHistoriaController = async (
  ctx: RouterContext<string>,
) => {
  try {
    const body = await ctx.request.body.json();

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

    if (!idCard) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "Falta el ID de la card" };
      return;
    }

    const eliminado = await eliminarCardPorIdService(idCard);

    if (eliminado) {
      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "Historia eliminada correctamente",
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
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el ID de la historia (customId)",
      };
      return;
    }
    await eliminarImagenesDeHistoria(id);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Proceso de eliminación de multimedia finalizado",
    };
  } catch (error) {
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
