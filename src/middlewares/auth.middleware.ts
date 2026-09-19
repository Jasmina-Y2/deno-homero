import { Context } from "https://deno.land/x/oak/mod.ts";
import {
  extraerTokenHeader,
  extraerUidDirecto,
  JwtUserPayload,
  verificarToken,
} from "../utils/jwt.ts";

/**
 * Middleware para requerir autenticación mediante JWT (Bearer Token).
 * Almacena el usuario decodificado en ctx.state.user y ctx.state.isAdmin.
 * Si el token falla pero se envía un UID directo válido (ej. sincronización de sesión frontend),
 * permite la petición asignando el UID a ctx.state.user.
 */
export const requerirAuth = async (
  ctx: Context,
  next: () => Promise<unknown>,
) => {
  try {
    const token = extraerTokenHeader(ctx);

    if (token) {
      try {
        const payload = verificarToken(token);
        ctx.state.user = payload;
        ctx.state.isAdmin = Boolean(payload.isAdmin || payload.rol === "admin");
        await next();
        return;
      } catch (tokenErr) {
        console.warn("⚠️ Token falló verificación, intentando fallback UID:", tokenErr);
      }
    }

    // Fallback 1: verificar si se envió el UID en headers, route params o query params
    const uidDirecto = extraerUidDirecto(ctx);
    if (uidDirecto) {
      ctx.state.user = {
        uid: uidDirecto,
        rol: "usuario",
        isAdmin: false,
      };
      ctx.state.isAdmin = false;
      await next();
      return;
    }

    // Fallback 2: si es una petición POST/PUT con body, extraer el autor/usuario del body
    if (ctx.request.hasBody) {
      try {
        let body: any = null;
        if (typeof (ctx.request.body as any)?.json === "function") {
          body = await (ctx.request.body as any).json();
        } else if (typeof ctx.request.body === "function") {
          const res = (ctx.request.body as any)({ type: "json" });
          body = res?.value ? await res.value : res;
        }

        if (body) {
          (ctx.state as any).parsedBody = body;
          const bodyUid = body.idAutor || body.uidAutor || body.uid || body.idUsuario || body.userId || body.autorId;
          if (bodyUid && typeof bodyUid === "string" && bodyUid.trim()) {
            ctx.state.user = {
              uid: bodyUid.trim(),
              rol: "usuario",
              isAdmin: false,
            };
            ctx.state.isAdmin = false;
            await next();
            return;
          }
        }
      } catch (_bodyErr) {
        // Ignorar error al leer body
      }
    }

    ctx.response.status = 401;
    ctx.response.body = {
      success: false,
      message: "Token de autenticación requerido. Debes iniciar sesión.",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error de autenticación";
    console.warn("⚠️ Error en autenticación:", msg);
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
      try {
        const payload = verificarToken(token);
        ctx.state.user = payload;
        ctx.state.isAdmin = Boolean(payload.isAdmin || payload.rol === "admin");
        await next();
        return;
      } catch {}
    }
    const uidDirecto = extraerUidDirecto(ctx);
    if (uidDirecto) {
      ctx.state.user = { uid: uidDirecto, rol: "usuario", isAdmin: false };
      ctx.state.isAdmin = false;
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
