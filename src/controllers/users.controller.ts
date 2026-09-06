import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  actualizarDescripcionUsuarioService,
  actualizarFotoUsuarioService,
  actualizarNombreUsuarioService,
  actualizarSuscripcionUsuarioService,
  asignarPrivilegiosUsuarioService,
  crearUsuarioService,
  getUsuarioByEmailService,
  getUsuarioByUidService,
  getUsuariosService,
  guardarFcmTokenService,
} from "../service/users.service.ts";

// ==========================================
// OBTENER TODOS LOS USUARIOS
// ==========================================
export const getUsuarios = async (ctx: Context) => {
  try {
    const data = await getUsuariosService();
    ctx.response.status = 200;
    ctx.response.body = { success: true, data };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";

    ctx.response.body = {
      success: false,
      message: "Error obteniendo los usuarios",
      error: errorMessage,
    };
  }
};

// ==========================================
// OBTENER PERFIL POR UID
// ==========================================
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
      ctx.response.status = 200;
      ctx.response.body = {
        success: false,
        exists: false,
        data: null,
        message: "Usuario no encontrado",
      };
      return;
    }

    ctx.response.status = 200;
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

// ==========================================
// VERIFICAR USUARIO POR EMAIL
// ==========================================
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
      ctx.response.status = 200;
      ctx.response.body = {
        success: false,
        exists: false,
        data: null,
        message: "Usuario no encontrado",
      };
      return;
    }

    ctx.response.status = 200;
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

// ==========================================
// CREAR USUARIO
// ==========================================
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

// ==========================================
// ACTUALIZAR NOMBRE
// ==========================================
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

// ==========================================
// ACTUALIZAR DESCRIPCIÓN
// ==========================================
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

// ==========================================
// ACTUALIZAR FOTO
// ==========================================
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

// ==========================================
// ACTUALIZAR SUSCRIPCIÓN
// ==========================================
export const actualizarSuscripcionUsuario = async (
  ctx: RouterContext<string>,
) => {
  try {
    const body = await ctx.request.body.json();
    const {
      uid,
      nuevaSuscripcion,
      verificado,
      fechaSuscripcion,
      fechaVencimiento,
      diasDuracion,
      elevensLab,
    } = body;

    if (!uid || nuevaSuscripcion === undefined || verificado === undefined) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan datos requeridos: uid, nuevaSuscripcion o verificado",
      };
      return;
    }

    const userActualizado = await actualizarSuscripcionUsuarioService(
      uid,
      Boolean(nuevaSuscripcion),
      Boolean(verificado),
      fechaSuscripcion ?? null,
      fechaVencimiento ?? null,
      diasDuracion,
      elevensLab,
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

// ==========================================
// ASIGNAR PRIVILEGIOS DE USUARIO (ADMIN / MOD)
// ==========================================
export const asignarPrivilegiosUsuarioController = async (ctx: Context) => {
  try {
    let body: Record<string, any> = {};
    try {
      if (typeof (ctx.request.body as any)?.json === "function") {
        body = await (ctx.request.body as any).json();
      } else if (typeof (ctx.request as any)?.body === "function") {
        const bodyResult = (ctx.request as any).body({ type: "json" });
        body = await bodyResult.value;
      }
    } catch {
      body = {};
    }

    const params = (ctx as any).params || {};
    const searchParams = ctx.request.url.searchParams;

    const uid = body.uid || params.uid || searchParams.get("uid");
    const email = body.email || searchParams.get("email");

    if (!uid && !email) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Se requiere 'uid' o 'email' del usuario",
      };
      return;
    }

    const valorAdmin = body.ADMIN !== undefined
      ? body.ADMIN
      : (body.admin !== undefined ? body.admin : body.isAdmin);

    const resultado = await asignarPrivilegiosUsuarioService({
      uid,
      email,
      suscription: body.suscription ?? body.nuevaSuscripcion,
      verificado: body.verificado,
      ADMIN: valorAdmin,
      admin: valorAdmin,
      isAdmin: valorAdmin,
      rol: body.rol,
      dias: body.dias ?? body.diasDuracion,
      diasDuracion: body.diasDuracion ?? body.dias,
      fechaSuscripcion: body.fechaSuscripcion,
      fechaVencimiento: body.fechaVencimiento,
      elevensLab: body.elevensLab ?? body.ElevensLab,
      sumarElevensLab: body.sumarElevensLab,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Privilegios actualizados exitosamente",
      data: resultado,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en asignarPrivilegiosUsuarioController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al asignar privilegios al usuario",
      error: errorMessage,
    };
  }
};

// ==========================================
// GUARDAR TOKEN FCM
// ==========================================
export const guardarFcmToken = async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();
    const { uid, fcmToken } = body;

    if (!uid || !fcmToken) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta uid o fcmToken",
      };
      return;
    }

    const resultado = await guardarFcmTokenService(uid, fcmToken);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Token guardado en el backend",
      data: resultado,
    };
  } catch (error: unknown) {
    ctx.response.status = 500;
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";

    ctx.response.body = {
      success: false,
      message: "Error al guardar el token en el backend",
      error: errorMessage,
    };
  }
};

