import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  actualizarDescripcionUsuarioService,
  actualizarFotoUsuarioService,
  actualizarNombreUsuarioService,
  actualizarSuscripcionUsuarioService,
  crearUsuarioService,
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

export const crearUsuario = async (ctx: RouterContext<string>) => {
  try {
    const datos = await ctx.request.body.json();

    const user = await crearUsuarioService(datos);

    ctx.response.status = 201;
    ctx.response.body = { success: true, data: user };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";
    ctx.response.body = {
      success: false,
      message: "Error creando el perfil del usuario",
      error: errorMessage,
    };
  }
};

export const actualizarNombreUsuario = async (ctx: RouterContext<string>) => {
  try {
    const body = await ctx.request.body.json();
    const { uid, nuevoNombre } = body;

    if (!uid || !nuevoNombre) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan datos requeridos: uid o nuevoNombre",
      };
      return;
    }

    const userActualizado = await actualizarNombreUsuarioService(
      uid,
      nuevoNombre,
    );

    ctx.response.status = 200;
    ctx.response.body = { success: true, data: userActualizado };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";

    ctx.response.body = {
      success: false,
      message: "Error actualizando el nombre del usuario",
      error: errorMessage,
    };
  }
};

export const actualizarDescripcionUsuario = async (
  ctx: RouterContext<string>,
) => {
  try {
    const body = await ctx.request.body.json();
    const { uid, nuevaDescripcion } = body;

    if (!uid || !nuevaDescripcion) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan datos requeridos: uid o nuevaDescripcion",
      };
      return;
    }

    const userActualizado = await actualizarDescripcionUsuarioService(
      uid,
      nuevaDescripcion,
    );

    ctx.response.status = 200;
    ctx.response.body = { success: true, data: userActualizado };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";

    ctx.response.body = {
      success: false,
      message: "Error actualizando la descripción del usuario",
      error: errorMessage,
    };
  }
};
export const actualizarFotoUsuario = async (ctx: RouterContext<string>) => {
  try {
    const body = await ctx.request.body.json();
    const { uid, nuevaFotoURL } = body;

    if (!uid || !nuevaFotoURL) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan datos requeridos: uid o nuevaFotoURL",
      };
      return;
    }

    const userActualizado = await actualizarFotoUsuarioService(
      uid,
      nuevaFotoURL,
    );

    ctx.response.status = 200;
    ctx.response.body = { success: true, data: userActualizado };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";

    ctx.response.body = {
      success: false,
      message: "Error actualizando la foto del usuario",
      error: errorMessage,
    };
  }
};

export const actualizarSuscripcionUsuario = async (
  ctx: RouterContext<string>,
) => {
  try {
    const body = await ctx.request.body.json();
    const {
      uid,
      nuevaSuscripcion,
      verificado,
      diasDuracion,
      ElevensLab,
      elevensLab,
      fechaSuscripcion,
      fechaVencimiento,
    } = body;

    if (!uid || nuevaSuscripcion === undefined || verificado === undefined) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan datos requeridos: uid, nuevaSuscripcion o verificado",
      };
      return;
    }

    const dias = typeof diasDuracion === "number" && diasDuracion > 0
      ? diasDuracion
      : 30;

    const cantidadEleven = typeof ElevensLab === "number"
      ? ElevensLab
      : (typeof elevensLab === "number" ? elevensLab : 15);

    const userActualizado = await actualizarSuscripcionUsuarioService(
      uid,
      Boolean(nuevaSuscripcion),
      Boolean(verificado),
      fechaSuscripcion ?? null,
      fechaVencimiento ?? null,
      dias,
      cantidadEleven,
    );

    ctx.response.status = 200;
    ctx.response.body = { success: true, data: userActualizado };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";

    ctx.response.body = {
      success: false,
      message: "Error actualizando la suscripción del usuario",
      error: errorMessage,
    };
  }
};

