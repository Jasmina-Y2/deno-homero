import { assertEquals, assertRejects, assert } from "jsr:@std/assert@1";
import { generarToken, verificarToken, extraerTokenHeader } from "../utils/jwt.ts";
import { esPropietarioOAdmin } from "../middlewares/auth.middleware.ts";

Deno.test("JWT: Generar y verificar token de usuario normal", () => {
  const payload = {
    uid: "user123",
    email: "user@example.com",
    name: "Usuario Normal",
    rol: "usuario",
    isAdmin: false,
    verificado: false,
  };

  const token = generarToken(payload);
  assert(token && token.length > 20, "El token debe generarse correctamente");

  const decoded = verificarToken(token);
  assertEquals(decoded.uid, "user123");
  assertEquals(decoded.email, "user@example.com");
  assertEquals(decoded.rol, "usuario");
  assertEquals(decoded.isAdmin, false);
});

Deno.test("JWT: Generar y verificar token de ADMIN", () => {
  const payload = {
    uid: "admin999",
    email: "admin@homero.com",
    name: "Admin Principal",
    rol: "admin",
    isAdmin: true,
    verificado: true,
  };

  const token = generarToken(payload);
  const decoded = verificarToken(token);
  assertEquals(decoded.uid, "admin999");
  assertEquals(decoded.isAdmin, true);
  assertEquals(decoded.rol, "admin");
});

Deno.test("JWT: Extraer token desde header Bearer", () => {
  const mockCtx = {
    request: {
      headers: new Headers({
        Authorization: "Bearer mi_token_secreto_xyz",
      }),
    },
  };

  const extracted = extraerTokenHeader(mockCtx);
  assertEquals(extracted, "mi_token_secreto_xyz");
});

Deno.test("RBAC: Permisos de propietario o admin", () => {
  const normalUserCtx = {
    state: {
      user: {
        uid: "autor1",
        rol: "usuario",
        isAdmin: false,
      },
    },
  } as any;

  const adminCtx = {
    state: {
      user: {
        uid: "admin1",
        rol: "admin",
        isAdmin: true,
      },
    },
  } as any;

  // Normal user es propietario de su recurso
  assertEquals(esPropietarioOAdmin(normalUserCtx, "autor1"), true);
  // Normal user NO es propietario de recurso ajeno
  assertEquals(esPropietarioOAdmin(normalUserCtx, "otro_autor_2"), false);

  // Admin tiene permiso sobre cualquier recurso
  assertEquals(esPropietarioOAdmin(adminCtx, "autor1"), true);
  assertEquals(esPropietarioOAdmin(adminCtx, "otro_autor_2"), true);
});
