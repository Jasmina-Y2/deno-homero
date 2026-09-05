import { assertEquals } from "@std/assert";
import {
  consultarEstadoDispositivoController,
  resetearLimiteDispositivoController,
  validarYRecompensarDispositivoController,
} from "../controllers/deviceAdLimit.controller.ts";
import {
  COLECCION_DEVICE_AD_LIMITS,
  MAX_ANUNCIOS_POR_DISPOSITIVO_DIA,
  obtenerFechaHoyUTC,
} from "../service/deviceAdLimit.service.ts";

function createMockContext(bodyData: any = {}, params: any = {}, searchParams: Record<string, string> = {}) {
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
// PRUEBAS DE VALIDACIÓN DE ENTRADA (CONTROLADOR)
// ----------------------------------------------------

Deno.test("Device Ad Limit: Requiere UID del usuario", async () => {
  const ctx = createMockContext({
    deviceId: "device_abc_123",
    cantidadMonedas: 10,
  });

  await validarYRecompensarDispositivoController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El identificador del usuario (uid) es requerido");
});

Deno.test("Device Ad Limit: Requiere deviceId del dispositivo", async () => {
  const ctx = createMockContext({
    uid: "user_abc_123",
    cantidadMonedas: 10,
  });

  await validarYRecompensarDispositivoController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El identificador del dispositivo (deviceId) es requerido");
});

Deno.test("Device Ad Limit: Consultar estado requiere deviceId", async () => {
  const ctx = createMockContext({}, { deviceId: "" });

  await consultarEstadoDispositivoController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El deviceId es requerido en la ruta o parámetro query");
});

Deno.test("Device Ad Limit: Resetear límite requiere deviceId", async () => {
  const ctx = createMockContext({}, { deviceId: "" });

  await resetearLimiteDispositivoController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El deviceId es requerido para reiniciar el límite");
});

// ----------------------------------------------------
// PRUEBAS DE LÓGICA DE NEGOCIO Y CONSTANTES
// ----------------------------------------------------

Deno.test("Device Ad Limit: Constantes de configuración correctas", () => {
  assertEquals(MAX_ANUNCIOS_POR_DISPOSITIVO_DIA, 3);
  assertEquals(COLECCION_DEVICE_AD_LIMITS, "device_ad_limits");
});

Deno.test("Device Ad Limit: Helper de fecha UTC devuelve formato YYYY-MM-DD", () => {
  const fecha = obtenerFechaHoyUTC();
  assertEquals(/^\d{4}-\d{2}-\d{2}$/.test(fecha), true);
});
