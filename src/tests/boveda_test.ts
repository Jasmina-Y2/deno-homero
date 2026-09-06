import { assertEquals } from "@std/assert";
import {
  guardarPinBovedaController,
  obtenerPinBovedaController,
} from "../controllers/boveda.controller.ts";

function createMockContext(
  bodyData: any = {},
  params: any = {},
  searchParams: Record<string, string> = {},
  method: string = "GET",
) {
  const urlParams = new URLSearchParams(searchParams);
  const ctx: any = {
    params,
    request: {
      method,
      hasBody: Object.keys(bodyData).length > 0,
      url: new URL(`http://localhost:8000/api/test?${urlParams.toString()}`),
      body: () => ({
        type: "json",
        value: Promise.resolve(bodyData),
      }),
    },
    response: {
      status: 200,
      body: {},
    },
  };
  return ctx;
}

// ----------------------------------------------------
// PRUEBAS DE VALIDACIÓN (CONTROLADOR BÓVEDA)
// ----------------------------------------------------

Deno.test("Bóveda Controller: Requiere UID al consultar PIN", async () => {
  const ctx = createMockContext({}, { uid: "" }, {});
  await obtenerPinBovedaController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El identificador del usuario (uid) es requerido");
});

Deno.test("Bóveda Controller: Requiere UID al guardar PIN", async () => {
  const ctx = createMockContext({ pin: "1234" }, {}, {}, "POST");
  await guardarPinBovedaController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El identificador del usuario (uid) es requerido");
});

Deno.test("Bóveda Controller: Requiere PIN al guardar", async () => {
  const ctx = createMockContext({ uid: "user_test_123" }, {}, {}, "POST");
  await guardarPinBovedaController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El PIN es requerido");
});
