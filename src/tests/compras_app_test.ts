import { assertEquals } from "@std/assert";
import { resolverCantidadMonedas } from "../service/comprasApp.service.ts";
import {
  actualizarEstadoCompraController,
  obtenerCompraPorIdController,
  obtenerComprasUsuarioController,
  registrarCompraManualController,
} from "../controllers/comprasApp.controller.ts";
import { revenueCatWebhookController } from "../controllers/revenuecat.controller.ts";

function createMockContext(
  bodyData: any = {},
  params: any = {},
  searchParams: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  const urlParams = new URLSearchParams(searchParams);
  const headerMap = new Map<string, string>(Object.entries(headers));

  const ctx: any = {
    params,
    request: {
      url: new URL(`http://localhost:8000/api/test?${urlParams.toString()}`),
      headers: {
        get: (name: string) => headerMap.get(name.toLowerCase()) || null,
      },
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
// 1. PRUEBAS DE RESOLUCIÓN DE MONEDAS (Evitar bug de 400 monedas)
// ----------------------------------------------------

Deno.test("Resolver Monedas: Paquete de 400 monedas en distintos formatos de Product ID", () => {
  assertEquals(resolverCantidadMonedas("coins_400"), 400);
  assertEquals(resolverCantidadMonedas("homero_coins_400"), 400);
  assertEquals(resolverCantidadMonedas("paquete_400"), 400);
  assertEquals(resolverCantidadMonedas("paquete_400_monedas"), 400);
  assertEquals(resolverCantidadMonedas("coins_tier_2"), 400);
  assertEquals(resolverCantidadMonedas("homero_v2_400_coins"), 400);
  assertEquals(resolverCantidadMonedas("app_tier1_v2_coins_400"), 400);
});

Deno.test("Resolver Monedas: Paquetes estándar (100, 500, 1000, 2500, 5000)", () => {
  assertEquals(resolverCantidadMonedas("coins_100"), 100);
  assertEquals(resolverCantidadMonedas("homero_coins_100"), 100);
  assertEquals(resolverCantidadMonedas("coins_tier_1"), 100);
  assertEquals(resolverCantidadMonedas("paquete_basico"), 100);

  assertEquals(resolverCantidadMonedas("coins_500"), 500);
  assertEquals(resolverCantidadMonedas("paquete_pro"), 500);

  assertEquals(resolverCantidadMonedas("coins_1000"), 1000);
  assertEquals(resolverCantidadMonedas("coins_tier_3"), 1000);
  assertEquals(resolverCantidadMonedas("paquete_master"), 1000);

  assertEquals(resolverCantidadMonedas("coins_2500"), 2500);
  assertEquals(resolverCantidadMonedas("coins_tier_4"), 2500);
  assertEquals(resolverCantidadMonedas("paquete_legendario"), 2500);

  assertEquals(resolverCantidadMonedas("coins_5000"), 5000);
  assertEquals(resolverCantidadMonedas("coins_tier_5"), 5000);
});

Deno.test("Resolver Monedas: Monedas manuales tienen prioridad", () => {
  assertEquals(resolverCantidadMonedas("coins_100", 750), 750);
  assertEquals(resolverCantidadMonedas("homero_coins_400", 400), 400);
});

Deno.test("Resolver Monedas: Fallback seguro de 100 para IDs no reconocidos", () => {
  assertEquals(resolverCantidadMonedas("producto_desconocido_sin_numeros"), 100);
  assertEquals(resolverCantidadMonedas(""), 100);
});

// ----------------------------------------------------
// 2. PRUEBAS DE CONTROLADOR DE COMPRAS DE LA APP
// ----------------------------------------------------

Deno.test("Compras App Controller: Obtener compras usuario requiere UID", async () => {
  const ctx = createMockContext({}, {});
  await obtenerComprasUsuarioController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(
    ctx.response.body.message,
    "El parámetro UID del usuario es requerido",
  );
});

Deno.test("Compras App Controller: Obtener compra por ID requiere ID", async () => {
  const ctx = createMockContext({}, { id: "" });
  await obtenerCompraPorIdController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(
    ctx.response.body.message,
    "El ID de la compra es requerido",
  );
});

Deno.test("Compras App Controller: Actualizar estado valida estados permitidos", async () => {
  const ctx = createMockContext(
    { estado: "estado_falso_invalido" },
    { id: "compra_test_123" },
  );

  await actualizarEstadoCompraController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(
    ctx.response.body.message.includes("Estado inválido"),
    true,
  );
});

Deno.test("Compras App Controller: Compra manual requiere idUsuario", async () => {
  const ctx = createMockContext({
    productId: "coins_400",
    cantidadMonedas: 400,
  });

  await registrarCompraManualController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(
    ctx.response.body.message,
    "El campo 'idUsuario' es requerido",
  );
});

// ----------------------------------------------------
// 3. PRUEBAS DE REVENUECAT WEBHOOK CONTROLLER
// ----------------------------------------------------

Deno.test("RevenueCat Webhook: Maneja evento TEST correctamente", async () => {
  const ctx = createMockContext({
    event: {
      type: "TEST",
      id: "test_event_123",
    },
  });

  await revenueCatWebhookController(ctx);

  assertEquals(ctx.response.status, 200);
  assertEquals(ctx.response.body.success, true);
  assertEquals(
    ctx.response.body.message,
    "Webhook de prueba recibido correctamente.",
  );
});

Deno.test("RevenueCat Webhook: Rechaza payload sin event con 400", async () => {
  const ctx = createMockContext({});

  await revenueCatWebhookController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(
    ctx.response.body.message.includes("Payload inválido"),
    true,
  );
});

Deno.test("RevenueCat Webhook: Evento sin app_user_id responde 200 con aviso", async () => {
  const ctx = createMockContext({
    event: {
      type: "NON_RENEWING_PURCHASE",
      product_id: "coins_400",
    },
  });

  await revenueCatWebhookController(ctx);

  assertEquals(ctx.response.status, 200);
  assertEquals(ctx.response.body.success, true);
  assertEquals(
    ctx.response.body.message,
    "Evento recibido pero sin app_user_id asociado",
  );
});

Deno.test("Detección Compras: Identificadores tipo 'buy_basico_...' se resuelven como paquetes de compras", () => {
  assertEquals(resolverCantidadMonedas("buy_basico_1789270519526", 50), 50);
  assertEquals(resolverCantidadMonedas("buy_400_coins_1789270519526"), 400);
  assertEquals(resolverCantidadMonedas("buy_paquete_500_monedas"), 500);
});

// ----------------------------------------------------
// 4. PRUEBAS DE REGISTRO DE COMPRA PENDIENTE (Google Play Slow Payment)
// ----------------------------------------------------

Deno.test("Compras App Controller: registrarCompraPendienteController requiere idUsuario o uid", async () => {
  const { registrarCompraPendienteController } = await import("../controllers/comprasApp.controller.ts");
  const ctx = createMockContext({
    productId: "coins_400",
    cantidadMonedas: 400,
  });

  await registrarCompraPendienteController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(
    ctx.response.body.message.includes("idUsuario"),
    true,
  );
});
