import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  getUsuarioByEmailService,
  getUsuarioByUidService,
  getUsuariosService,
} from "../service/users.service.ts";

export const getUsuarios = async (ctx: Context) => {
  try {
    const data = await getUsuariosService();
    ctx.response.body = { success: true, data };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
export const getUsuarioPerfil = async (ctx: RouterContext<string>) => {
  try {
    const { uid } = ctx.params;

    if (!uid) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "UID requerido" };
      return;
    }

    const user = await getUsuarioByUidService(uid);

    if (!user) {
      ctx.response.status = 404;
      ctx.response.body = { success: false, message: "Usuario no encontrado" };
      return;
    }

    ctx.response.body = { success: true, data: user };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";
    ctx.response.body = {
      success: false,
      message: "Error obteniendo el perfil del usuario",
      error: errorMessage,
    };
  }
};
export const verificarUsuarioEmail = async (ctx: RouterContext<string>) => {
  try {
    const { email } = ctx.params;

    if (!email) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "Email requerido" };
      return;
    }

    const user = await getUsuarioByEmailService(email);

    if (!user) {
      ctx.response.status = 404;
      ctx.response.body = { success: false, message: "Usuario no encontrado" };
      return;
    }

    ctx.response.body = { success: true, data: user };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";
    ctx.response.body = {
      success: false,
      message: "Error verificando el email del usuario",
      error: errorMessage,
    };
  }
};
