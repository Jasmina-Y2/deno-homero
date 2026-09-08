import { assertEquals } from "@std/assert";
import {
  actualizarDiaRachaUsuarioController,
  actualizarMarcoUsuarioController,
  asignarPrivilegiosUsuarioController,
  guardarFcmToken,
} from "../controllers/users.controller.ts";

function createMockContext(
  bodyData: any = {},
  params: any = {},
  searchParams: Record<string, string> = {},
) {
  const urlParams = new URLSearchParams(searchParams);
  const ctx: any = {
    params,
    request: {
      url: new URL(`http://localhost:8000/api/test?${urlParams.toString()}`),
      body: {
        json: () => Promise.resolve(bodyData),
      },
    },
    response: {
      status: 200,
      body: {},
    },
  };
  return ctx;
}

// ----------------------------------------------------
// PRUEBAS DE PRIVILEGIOS DE USUARIO (CONTROLADOR)
// ----------------------------------------------------

Deno.test("Privilegios Usuario: Requiere UID o Email", async () => {
  const ctx = createMockContext({ suscription: true, verificado: true });
  await asignarPrivilegiosUsuarioController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "Se requiere 'uid' o 'email' del usuario");
});

// ----------------------------------------------------
// PRUEBAS DE ACTUALIZACIÓN DE MARCO DE PERFIL
// ----------------------------------------------------

Deno.test("Actualizar Marco: Falla si no se proporciona userId o uid", async () => {
  const ctx = createMockContext({
    frame: { id: "marco_oro", src: "https://ejemplo.com/marco_oro.png" },
  });
  await actualizarMarcoUsuarioController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "Falta el parámetro requerido: userId o uid");
});

// ----------------------------------------------------
// PRUEBAS DE GUARDAR FCM TOKEN
// ----------------------------------------------------

Deno.test("Guardar FCM Token: Falla si falta uid o token", async () => {
  const ctx = createMockContext({ uid: "user_test_123" });
  await guardarFcmToken(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "Falta uid o fcmToken (o fcm_token)");
});

// ----------------------------------------------------
// PRUEBAS DE DÍA DE RACHA
// ----------------------------------------------------

Deno.test("Día de Racha: Falla si no se proporciona UID", async () => {
  const ctx = createMockContext({ dia_racha: 3 });
  await actualizarDiaRachaUsuarioController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "Falta el parámetro requerido: uid o userId");
});



