import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  actualizarDescripcionUsuarioService,
  actualizarDiaRachaUsuarioService,
  actualizarFotoUsuarioService,
  actualizarMarcoUsuarioService,
  actualizarNombreUsuarioService,
  actualizarSuscripcionUsuarioService,
  agregarSuscripcionUsuarioService,
  asignarPrivilegiosUsuarioService,
  crearUsuarioService,
  descontarUsoElevenLabsService,
  editarSuscripcionUsuarioService,
  eliminarSuscripcionUsuarioService,
  getUsuarioByEmailService,
  getUsuarioByUidService,
  getUsuariosService,
  guardarFcmTokenService,
  obtenerDiaRachaUsuarioService,
  obtenerSuscripcionesUsuarioService,
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

    ctx.response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    ctx.response.headers.set("Pragma", "no-cache");
    ctx.response.headers.set("Expires", "0");
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
      tipo,
      fechaSuscripcion,
      fechaVencimiento,
      diasDuracion,
      elevensLab,
      planLector,
      planEscritor,
    } = body;

    if (!uid || nuevaSuscripcion === undefined) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan datos requeridos: uid o nuevaSuscripcion",
      };
      return;
    }

    const userActualizado = await actualizarSuscripcionUsuarioService({
      uid,
      nuevaSuscripcion: Boolean(nuevaSuscripcion),
      verificado: verificado !== undefined ? Boolean(verificado) : undefined,
      tipo: tipo ?? "escritor",
      fechaSuscripcion: fechaSuscripcion ?? null,
      fechaVencimiento: fechaVencimiento ?? null,
      diasDuracion: diasDuracion ?? 30,
      elevensLab: elevensLab !== undefined ? Number(elevensLab) : undefined,
      planLector,
      planEscritor,
    });

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
// MIGRAR ESTRUCTURA DE USUARIOS A FORMATO MODULAR
// ==========================================
export const migrarEstructuraUsuariosController = async (ctx: Context) => {
  try {
    const { migrarTodosLosUsuariosService } = await import("../service/users.service.ts");
    const resultado = await migrarTodosLosUsuariosService();
    ctx.response.status = 200;
    ctx.response.body = resultado;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en migrarEstructuraUsuariosController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al migrar la estructura de los usuarios",
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
      tipo: body.tipo,
      entitlementId: body.entitlementId,
      productId: body.productId,
      suscripciones: body.suscripciones,
      verificado: body.verificado,
      ADMIN: valorAdmin,
      activo: body.activo !== undefined ? Boolean(body.activo) : undefined,
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
    const uid = body.uid || body.userId;
    const fcmToken = body.fcmToken || body.fcm_token || body.token;

    if (!uid || !fcmToken) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta uid o fcmToken (o fcm_token)",
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

// ==========================================
// ACTUALIZAR MARCO DE PERFIL
// ==========================================
export const actualizarMarcoUsuarioController = async (ctx: Context) => {
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

    const userId = body.userId || body.uid || params.uid || params.userId || searchParams.get("userId") || searchParams.get("uid");

    if (!userId) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el parámetro requerido: userId o uid",
      };
      return;
    }

    const frame = body.frame;
    const marco_perfil_id = frame?.id ?? body.marco_perfil_id ?? body.selectedFrame ?? body.frameId ?? body.id ?? null;

    const resultado = await actualizarMarcoUsuarioService({
      userId,
      uid: userId,
      marco_perfil_id,
      frame,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Marco de perfil actualizado correctamente",
      data: resultado,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";
    console.error("❌ Error en actualizarMarcoUsuarioController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al actualizar el marco del perfil",
      error: errorMessage,
    };
  }
};

export const actualizarMarcoUsuario = actualizarMarcoUsuarioController;

// ==========================================
// ACTUALIZAR DÍA DE RACHA DEL USUARIO
// ==========================================
export const actualizarDiaRachaUsuarioController = async (ctx: Context) => {
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

    const uid = body.uid || body.userId || params.uid || searchParams.get("uid");

    if (!uid) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el parámetro requerido: uid o userId",
      };
      return;
    }

    const diaRachaRaw = body.dia_racha ?? body["dia racha"] ?? body.diaRacha ?? body.racha ?? body.dias_racha;
    const diaRacha = diaRachaRaw !== undefined && diaRachaRaw !== null ? Number(diaRachaRaw) : undefined;
    const incrementar = Boolean(body.incrementar ?? body.sumar ?? (diaRacha === undefined));

    const resultado = await actualizarDiaRachaUsuarioService(
      uid,
      diaRacha,
      incrementar,
    );

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Día de racha actualizado correctamente",
      data: resultado,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";
    console.error("❌ Error en actualizarDiaRachaUsuarioController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al actualizar el día de racha del usuario",
      error: errorMessage,
    };
  }
};

export const actualizarDiaRachaUsuario = actualizarDiaRachaUsuarioController;

// ==========================================
// OBTENER DÍA DE RACHA DEL USUARIO
// ==========================================
export const obtenerDiaRachaUsuarioController = async (ctx: Context) => {
  try {
    const params = (ctx as any).params || {};
    const searchParams = ctx.request.url.searchParams;
    const uid = params.uid || searchParams.get("uid") || searchParams.get("userId");

    if (!uid) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el parámetro requerido: uid o userId",
      };
      return;
    }

    const resultado = await obtenerDiaRachaUsuarioService(uid);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: resultado,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";
    console.error("❌ Error en obtenerDiaRachaUsuarioController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener el día de racha del usuario",
      error: errorMessage,
    };
  }
};

export const obtenerDiaRachaUsuario = obtenerDiaRachaUsuarioController;

// ==========================================
// DESCONTAR / CONSUMIR USO DE ELEVENSLAB
// ==========================================
export const descontarUsoElevenLabsController = async (ctx: Context) => {
  try {
    let body: any = {};
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
    const uid = body.uid || body.userId || params.uid || searchParams.get("uid");

    if (!uid) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el parámetro requerido: uid o userId",
      };
      return;
    }

    const resultado = await descontarUsoElevenLabsService(uid);

    ctx.response.status = resultado.success ? 200 : 403;
    ctx.response.body = resultado;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Error desconocido";
    console.error("❌ Error en descontarUsoElevenLabsController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al procesar el uso de ElevenLabs",
      error: errorMessage,
    };
  }
};

export const consumirElevenLabsController = descontarUsoElevenLabsController;

// ==========================================
// OBTENER SUSCRIPCIONES DEL USUARIO (GET)
// ==========================================
export const obtenerSuscripcionesUsuarioController = async (ctx: Context) => {
  try {
    const params = (ctx as any).params || {};
    const searchParams = ctx.request.url.searchParams;
    const uid = params.uid || searchParams.get("uid") || searchParams.get("userId");

    if (!uid) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Falta el parámetro requerido: uid o userId",
      };
      return;
    }

    const resultado = await obtenerSuscripcionesUsuarioService(uid);

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: resultado,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en obtenerSuscripcionesUsuarioController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener las suscripciones del usuario",
      error: errorMessage,
    };
  }
};

// ==========================================
// AGREGAR / CREAR SUSCRIPCIÓN (POST)
// ==========================================
export const agregarSuscripcionUsuarioController = async (ctx: Context) => {
  try {
    let body: any = {};
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

    const uid = body.uid || body.userId || params.uid || searchParams.get("uid");
    const entitlementId = body.entitlementId || body.id || body.tipo || body.plan || params.entitlementId;

    if (!uid || !entitlementId) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan datos requeridos: 'uid' y 'entitlementId'",
      };
      return;
    }

    const resultado = await agregarSuscripcionUsuarioService({
      uid,
      entitlementId,
      productId: body.productId || body.product_id,
      diasDuracion: body.diasDuracion !== undefined ? Number(body.diasDuracion) : (body.dias !== undefined ? Number(body.dias) : 30),
      fechaSuscripcion: body.fechaSuscripcion,
      fechaVencimiento: body.fechaVencimiento,
      autoRenovacion: body.autoRenovacion !== undefined ? Boolean(body.autoRenovacion) : false,
      verificado: body.verificado !== undefined ? Boolean(body.verificado) : undefined,
      elevensLab: body.elevensLab !== undefined ? Number(body.elevensLab) : undefined,
    });

    ctx.response.status = 201;
    ctx.response.body = {
      success: true,
      message: `Suscripción '${entitlementId}' agregada exitosamente`,
      data: resultado,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en agregarSuscripcionUsuarioController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al agregar la suscripción del usuario",
      error: errorMessage,
    };
  }
};

// ==========================================
// EDITAR / ACTUALIZAR SUSCRIPCIÓN (PUT)
// ==========================================
export const editarSuscripcionUsuarioController = async (ctx: Context) => {
  try {
    let body: any = {};
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

    const uid = body.uid || body.userId || params.uid || searchParams.get("uid");
    const entitlementId = body.entitlementId || body.id || body.tipo || body.plan || params.entitlementId;

    if (!uid || !entitlementId) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan datos requeridos: 'uid' y 'entitlementId'",
      };
      return;
    }

    const resultado = await editarSuscripcionUsuarioService({
      uid,
      entitlementId,
      activo: body.activo !== undefined ? Boolean(body.activo) : undefined,
      productId: body.productId || body.product_id,
      diasDuracion: body.diasDuracion !== undefined ? Number(body.diasDuracion) : (body.dias !== undefined ? Number(body.dias) : undefined),
      fechaSuscripcion: body.fechaSuscripcion,
      fechaVencimiento: body.fechaVencimiento,
      autoRenovacion: body.autoRenovacion !== undefined ? Boolean(body.autoRenovacion) : undefined,
      verificado: body.verificado !== undefined ? Boolean(body.verificado) : undefined,
      elevensLab: body.elevensLab !== undefined ? Number(body.elevensLab) : undefined,
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: `Suscripción '${entitlementId}' editada exitosamente`,
      data: resultado,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en editarSuscripcionUsuarioController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al editar la suscripción del usuario",
      error: errorMessage,
    };
  }
};

// ==========================================
// ELIMINAR / CANCELAR SUSCRIPCIÓN (DELETE)
// ==========================================
export const eliminarSuscripcionUsuarioController = async (ctx: Context) => {
  try {
    let body: any = {};
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

    const uid = params.uid || body.uid || body.userId || searchParams.get("uid");
    const entitlementId = params.entitlementId || body.entitlementId || body.id || body.tipo || body.plan || searchParams.get("entitlementId");

    if (!uid || !entitlementId) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "Faltan datos requeridos: 'uid' y 'entitlementId'",
      };
      return;
    }

    const eliminarCompletamente = body.hardDelete !== undefined
      ? Boolean(body.hardDelete)
      : (body.eliminarCompletamente !== undefined ? Boolean(body.eliminarCompletamente) : true);

    const resultado = await eliminarSuscripcionUsuarioService(uid, entitlementId, eliminarCompletamente);

    ctx.response.status = 200;
    ctx.response.body = resultado;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("❌ Error en eliminarSuscripcionUsuarioController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al eliminar la suscripción del usuario",
      error: errorMessage,
    };
  }
};




