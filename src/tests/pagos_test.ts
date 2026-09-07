import { assertEquals } from "@std/assert";
import {
  actualizarEstadoPagoController,
  obtenerPagoPorIdController,
  obtenerPagosUsuarioController,
  pagoRateLimiter,
  solicitarRetiroController,
} from "../controllers/pago.controller.ts";
import { ID_HOMERO_DEFAULT } from "../service/pago.service.ts";

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
// PRUEBAS DE SOLICITAR RETIRO / PAGOS A HOMERO
// ----------------------------------------------------

Deno.test("Constante: ID_HOMERO_DEFAULT debe ser 7cBW5g7xYGbh7Fh2zTCHvNBdGHx1", () => {
  assertEquals(ID_HOMERO_DEFAULT, "7cBW5g7xYGbh7Fh2zTCHvNBdGHx1");
});

Deno.test("Validación: Falta idUsuario en solicitud de retiro", async () => {
  const ctx = createMockContext({
    cantidadMonedas: 100,
    metodoPago: "paypal",
    correoPago: "user@test.com",
  });

  await solicitarRetiroController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(
    ctx.response.body.message,
    "El ID del usuario (idUsuario o uid) es requerido",
  );
});

Deno.test("Filtro Anti-Fraude: No permitir auto-retiro al mismo ID de Homero", async () => {
  const ctx = createMockContext({
    idUsuario: "7cBW5g7xYGbh7Fh2zTCHvNBdGHx1",
    idDestino: "7cBW5g7xYGbh7Fh2zTCHvNBdGHx1",
    cantidadMonedas: 100,
  });

  await solicitarRetiroController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(
    ctx.response.body.message,
    "No puedes solicitar retiro enviando dinero a tu propia cuenta",
  );
});

Deno.test("Validación: Cantidad de monedas inválida o <= 0", async () => {
  const ctx = createMockContext({
    idUsuario: "user_test_123",
    cantidadMonedas: 0,
    metodoPago: "paypal",
  });

  await solicitarRetiroController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(
    ctx.response.body.message,
    "La cantidad de monedas debe ser un número mayor a 0",
  );
});

Deno.test("Filtro Anti-Fraude: Rate Limiter bloquea spam de solicitudes de retiro", async () => {
  const testUid = "spammer_user_retiro_999";
  pagoRateLimiter.reset(testUid);

  const ctx1 = createMockContext({
    idUsuario: testUid,
    cantidadMonedas: -1, // Fallará en validación posterior pero consumirá intento
  });
  const ctx2 = createMockContext({
    idUsuario: testUid,
    cantidadMonedas: -1,
  });
  const ctx3 = createMockContext({
    idUsuario: testUid,
    cantidadMonedas: -1,
  });

  await solicitarRetiroController(ctx1);
  await solicitarRetiroController(ctx2);
  await solicitarRetiroController(ctx3);

  // El 3er intento inmediato debe ser bloqueado por Rate Limiter (HTTP 429)
  assertEquals(ctx3.response.status, 429);
  assertEquals(ctx3.response.body.success, false);
  assertEquals(ctx3.response.body.error, "RATE_LIMIT_EXCEEDED");

  pagoRateLimiter.reset(testUid);
});

Deno.test("Consulta Pagos Usuario: Requiere UID en ruta o query", async () => {
  const ctx = createMockContext({}, {});
  await obtenerPagosUsuarioController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
});

Deno.test("Consulta Pago por ID: Requiere ID del pago", async () => {
  const ctx = createMockContext({}, { id: "" });
  await obtenerPagoPorIdController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El ID del pago es requerido");
});

Deno.test("Actualizar Estado Pago: Rechaza estados no válidos", async () => {
  const ctx = createMockContext(
    { estado: "estado_inventado_invalido" },
    { id: "pago_123" },
  );

  await actualizarEstadoPagoController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(
    ctx.response.body.message.includes("Estado inválido"),
    true,
  );
});
