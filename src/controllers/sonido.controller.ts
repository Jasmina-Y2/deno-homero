import type { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  crearSonidoService,
  modificarSonidoService,
  obtenerSonidoPorIdService,
  obtenerSonidosService,
} from "../service/sonido.service.ts";

export const crearSonido = async (ctx: Context) => {
  try {
    const datos = await ctx.request.body.json();

    const data = await crearSonidoService(datos);

    ctx.response.status = 201;
    ctx.response.body = { success: true, data };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const obtenerSonidos = async (ctx: Context) => {
  try {
    const data = await obtenerSonidosService();
    ctx.response.status = 200;
    ctx.response.body = { success: true, data };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const obtenerSonidoPorId = async (ctx: RouterContext<string>) => {
  try {
    const { id } = ctx.params;

    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "ID de sonido requerido" };
      return;
    }

    const data = await obtenerSonidoPorIdService(id);

    if (!data) {
      ctx.response.status = 404;
      ctx.response.body = { success: false, message: "Sonido no encontrado" };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = { success: true, data };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export const modificarSonido = async (ctx: RouterContext<string>) => {
  try {
    const { id } = ctx.params;

    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "ID de sonido requerido" };
      return;
    }

    const datosActualizados = await ctx.request.body.json();

    const data = await modificarSonidoService(id, datosActualizados);

    ctx.response.status = 200;
    ctx.response.body = { success: true, data };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

