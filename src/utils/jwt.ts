import jwt from "npm:jsonwebtoken@^9.0.2";

const JWT_SECRET = Deno.env.get("JWT_SECRET");
const JWT_EXPIRES_IN = Deno.env.get("JWT_EXPIRES_IN");

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
 * Verifica y decodifica un token JWT. Lanza error si es inválido o expiró.
 */
export const verificarToken = (token: string): JwtUserPayload => {
  return (jwt as any).verify(token, JWT_SECRET) as JwtUserPayload;
};

/**
 * Extrae el token JWT desde el encabezado Authorization (Bearer <token>)
 */
export const extraerTokenHeader = (ctx: any): string | null => {
  const authHeader = ctx.request.headers.get("Authorization") ||
    ctx.request.headers.get("authorization");
  if (!authHeader) return null;

  const parts = authHeader.trim().split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1].trim();
  }
  if (parts.length === 1 && !parts[0].toLowerCase().startsWith("bearer")) {
    return parts[0].trim();
  }
  return null;
};
