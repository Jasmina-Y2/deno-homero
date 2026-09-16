import { Context } from "https://deno.land/x/oak/mod.ts";
import { extraerTokenHeader, JwtUserPayload, verificarToken } from "../utils/jwt.ts";

/**
 * Middleware para requerir autenticación mediante JWT (Bearer Token).
 * Almacena el usuario decodificado en ctx.state.user y ctx.state.isAdmin.
 */
export const requerirAuth = async (ctx: Context, next: () => Promise<unknown>) => {
  try {
    const token = extraerTokenHeader(ctx);

    if (!token) {
      ctx.response.status = 401;
      ctx.response.body = {
        success: false,
        message: "Token de autenticación requerido. Debes iniciar sesión.",
      };
      return;
    }

    const payload = verificarToken(token);
    ctx.state.user = payload;
    ctx.state.isAdmin = Boolean(payload.isAdmin || payload.rol === "admin");

    await next();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Token inválido";
    console.warn("⚠️ Error en autenticación JWT:", msg);
    ctx.response.status = 401;
    ctx.response.body = {
      success: false,
      message: "Token de autenticación inválido o expirado. Por favor inicia sesión nuevamente.",
      error: msg,
    };
  }
};

/**
 * Middleware para requerir permisos de Administrador (ADMIN).
 * Solo permite continuar si el token es válido y el usuario es ADMIN.
 */
export const requerirAdmin = async (ctx: Context, next: () => Promise<unknown>) => {
  try {
    const token = extraerTokenHeader(ctx);

    if (!token) {
      ctx.response.status = 401;
      ctx.response.body = {
        success: false,
        message: "Token de autenticación requerido. Se necesitan permisos de Administrador.",
      };
      return;
    }

    const payload = verificarToken(token);
    ctx.state.user = payload;
    ctx.state.isAdmin = Boolean(payload.isAdmin || payload.rol === "admin");

    if (!ctx.state.isAdmin) {
      console.warn(`⛔ Intento no autorizado a ruta de Admin por usuario: ${payload.uid} (${payload.email})`);
      ctx.response.status = 403;
      ctx.response.body = {
        success: false,
        message: "Acceso denegado: Solo el Administrador tiene permisos para realizar esta acción.",
      };
      return;
    }

    await next();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Token inválido";
    console.warn("⚠️ Error validando Admin JWT:", msg);
    ctx.response.status = 401;
    ctx.response.body = {
      success: false,
      message: "Token de autenticación inválido o expirado.",
      error: msg,
    };
  }
};

/**
 * Middleware opcional: si se envía un token válido, se cargan los datos del usuario en ctx.state.user.
 * Si no se envía token, la petición continúa normalmente sin bloquear.
 */
export const authOpcional = async (ctx: Context, next: () => Promise<unknown>) => {
  try {
    const token = extraerTokenHeader(ctx);
    if (token) {
      const payload = verificarToken(token);
      ctx.state.user = payload;
      ctx.state.isAdmin = Boolean(payload.isAdmin || payload.rol === "admin");
    } else {
      ctx.state.user = null;
      ctx.state.isAdmin = false;
    }
  } catch (_error) {
    ctx.state.user = null;
    ctx.state.isAdmin = false;
  }
  await next();
};

/**
 * Función auxiliar para verificar si el usuario autenticado es el propietario de un recurso o es Admin.
 */
export const esPropietarioOAdmin = (ctx: Context, idPropietario: string): boolean => {
  const user = (ctx.state as any)?.user as JwtUserPayload | undefined;
  if (!user) return false;
  if (user.isAdmin || user.rol === "admin") return true;
  return user.uid === idPropietario;
};
