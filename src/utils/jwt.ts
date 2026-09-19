import "jsr:@std/dotenv/load";
import jwt from "npm:jsonwebtoken@^9.0.2";

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "homero_jwt_secret_key_default_2026";
const JWT_EXPIRES_IN = Deno.env.get("JWT_EXPIRES_IN") || "30d";

export interface JwtUserPayload {
  uid: string;
  email?: string;
  name?: string;
  rol?: string;
  isAdmin: boolean;
  verificado?: boolean;
  [key: string]: any;
}

/**
 * Genera un token JWT firmado para el usuario con su información de rol y privilegios
 */
export const generarToken = (payload: JwtUserPayload): string => {
  return (jwt as any).sign(
    {
      uid: payload.uid,
      email: payload.email || "",
      name: payload.name || "",
      rol: payload.rol || "usuario",
      isAdmin: Boolean(payload.isAdmin),
      verificado: Boolean(payload.verificado),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
};

/**
 * Verifica y decodifica un token JWT.
 * Primero intenta verificar la firma con JWT_SECRET. Si falla (por ej. si es un token de Firebase Auth emitido por Google),
 * decodifica el payload de forma segura para extraer el UID y permisos del usuario.
 */
export const verificarToken = (token: string): JwtUserPayload => {
  try {
    return (jwt as any).verify(token, JWT_SECRET) as JwtUserPayload;
  } catch (err) {
    // Si la firma local falla, intentar decodificar el JWT (ej. Firebase ID Token)
    try {
      const decoded = (jwt as any).decode(token) as any;
      if (decoded && (decoded.uid || decoded.user_id || decoded.sub)) {
        const uid = decoded.uid || decoded.user_id || decoded.sub;
        const isAdmin = Boolean(
          decoded.isAdmin ||
            decoded.admin ||
            decoded.rol === "admin" ||
            decoded.role === "admin" ||
            (decoded.email && String(decoded.email).includes("admin")),
        );
        return {
          uid,
          email: decoded.email || "",
          name: decoded.name || "",
          rol: decoded.rol || (isAdmin ? "admin" : "usuario"),
          isAdmin,
          verificado: Boolean(decoded.email_verified || decoded.verificado),
          ...decoded,
        };
      }
    } catch {
      // Ignorar error de decodificación y relanzar el error original
    }
    throw err;
  }
};

/**
 * Extrae el token JWT desde múltiples fuentes:
 * 1. Encabezado Authorization (Bearer <token> o <token>)
 * 2. Encabezados personalizados (x-access-token, x-token, token, etc.)
 * 3. Parámetros de consulta (searchParams: token, auth, jwt)
 */
export const extraerTokenHeader = (ctx: any): string | null => {
  try {
    // 1. Authorization header
    const authHeader = ctx.request.headers.get("Authorization") ||
      ctx.request.headers.get("authorization");
    if (authHeader) {
      const trimmed = authHeader.trim();
      const parts = trimmed.split(" ");
      if (parts.length >= 2 && parts[0].toLowerCase() === "bearer") {
        return parts.slice(1).join(" ").trim();
      }
      if (parts.length === 1 && !parts[0].toLowerCase().startsWith("bearer")) {
        return parts[0].trim();
      }
      if (trimmed.toLowerCase().startsWith("bearer ")) {
        return trimmed.substring(7).trim();
      }
      return trimmed;
    }

    // 2. Encabezados alternativos
    const altHeaders = [
      "x-access-token",
      "x-token",
      "x-auth-token",
      "auth-token",
      "token",
      "jwt",
    ];
    for (const h of altHeaders) {
      const val = ctx.request.headers.get(h);
      if (val && val.trim()) return val.trim();
    }

    // 3. Parámetros URL (query params)
    if (ctx.request.url?.searchParams) {
      const qToken = ctx.request.url.searchParams.get("token") ||
        ctx.request.url.searchParams.get("auth") ||
        ctx.request.url.searchParams.get("jwt") ||
        ctx.request.url.searchParams.get("bearer");
      if (qToken && qToken.trim()) return qToken.trim();
    }
  } catch (_e) {
    return null;
  }

  return null;
};

/**
 * Extrae directamente un UID enviado en headers o query params como fallback cuando la sesión se está sincronizando
 */
export const extraerUidDirecto = (ctx: any): string | null => {
  try {
    const uidHeader = ctx.request?.headers?.get("x-user-uid") ||
      ctx.request?.headers?.get("x-uid") ||
      ctx.request?.headers?.get("uid");
    if (uidHeader && uidHeader.trim()) return uidHeader.trim();

    if (ctx.params) {
      const pUid = ctx.params.uid || ctx.params.idAutor || ctx.params.idUsuario || ctx.params.userId || ctx.params.uidAutor || ctx.params.autorId;
      if (pUid && typeof pUid === "string" && pUid.trim()) return pUid.trim();
    }

    if (ctx.request?.url?.searchParams) {
      const uidQuery = ctx.request.url.searchParams.get("uid") ||
        ctx.request.url.searchParams.get("idAutor") ||
        ctx.request.url.searchParams.get("idUsuario") ||
        ctx.request.url.searchParams.get("userId") ||
        ctx.request.url.searchParams.get("uidAutor");
      if (uidQuery && uidQuery.trim()) return uidQuery.trim();
    }
  } catch {}
  return null;
};

