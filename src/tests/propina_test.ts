import { assertEquals } from "@std/assert";
import {
  enviarPropinaController,
  obtenerHistorialController,
  propinaRateLimiter,
  reclamarRecompensaAnuncioController,
} from "../controllers/propina.controller.ts";

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
// PRUEBAS DE ENVIAR PROPINA & ANTI-FRAUDE
// ----------------------------------------------------

Deno.test("Validación: Faltan datos de oyente", async () => {
  const ctx = createMockContext({
    idCreador: "creador123",
    cantidadMonedas: 10,
    tipoSticker: "estrella",
  });

  await enviarPropinaController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El ID del oyente es requerido");
});

Deno.test("Validación: Faltan datos de creador", async () => {
  const ctx = createMockContext({
    idOyente: "oyente123",
    cantidadMonedas: 10,
    tipoSticker: "estrella",
  });

  await enviarPropinaController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El ID del creador es requerido");
});

Deno.test("Filtro Anti-Fraude: Oyente y creador son el mismo usuario (auto-donación)", async () => {
  const ctx = createMockContext({
    idOyente: "mismo123",
    idCreador: "mismo123",
    cantidadMonedas: 10,
    tipoSticker: "estrella",
  });

  await enviarPropinaController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "No puedes enviarte propinas a ti mismo");
});

Deno.test("Filtro Anti-Fraude: Rate Limiter bloquea toques repetitivos consecutivos", async () => {
  const testUser = "spam_user_" + Date.now();
  propinaRateLimiter.reset(testUser);

  const ctx1 = createMockContext({
    idOyente: testUser,
    idCreador: "creador123",
    cantidadMonedas: -1, // Fallará después de pasar el rate limiter
    tipoSticker: "estrella",
  });
  await enviarPropinaController(ctx1);
  assertEquals(ctx1.response.status, 400); // Pasó rate limiter, falló en validación

  const ctx2 = createMockContext({
    idOyente: testUser,
    idCreador: "creador123",
    cantidadMonedas: -1,
    tipoSticker: "estrella",
  });
  await enviarPropinaController(ctx2);
  assertEquals(ctx2.response.status, 400); // 2da petición permitida

  // 3ra petición inmediata debe ser bloqueada con HTTP 429
  const ctx3 = createMockContext({
    idOyente: testUser,
    idCreador: "creador123",
    cantidadMonedas: 10,
    tipoSticker: "estrella",
  });
  await enviarPropinaController(ctx3);
  assertEquals(ctx3.response.status, 429);
  assertEquals(ctx3.response.body.error, "RATE_LIMIT_EXCEEDED");
});

Deno.test("Validación: Cantidad de monedas inválida o <= 0", async () => {
  const ctx = createMockContext({
    idOyente: "oyente_val_1",
    idCreador: "creador123",
    cantidadMonedas: 0,
    tipoSticker: "estrella",
  });

  await enviarPropinaController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "La cantidad de monedas debe ser un número mayor a 0");
});

Deno.test("Validación: Falta tipo de sticker", async () => {
  const ctx = createMockContext({
    idOyente: "oyente_val_2",
    idCreador: "creador123",
    cantidadMonedas: 15,
  });

  await enviarPropinaController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El tipo de sticker es requerido");
});

// ----------------------------------------------------
// PRUEBAS DE HISTORIAL
// ----------------------------------------------------

Deno.test("Historial: Requiere UID en ruta o query", async () => {
  const ctx = createMockContext();

  await obtenerHistorialController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El UID del usuario es requerido (en ruta o parámetro ?uid=...)");
});

// ----------------------------------------------------
// PRUEBAS DE RECOMPENSA DE ANUNCIOS
// ----------------------------------------------------

Deno.test("Recompensa Anuncio: Requiere idUsuario", async () => {
  const ctx = createMockContext({
    adId: "ad_test_12345",
  });

  await reclamarRecompensaAnuncioController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El ID del usuario (idUsuario) es requerido");
});

Deno.test("Recompensa Anuncio: Requiere adId", async () => {
  const ctx = createMockContext({
    idUsuario: "user_test_123",
  });

  await reclamarRecompensaAnuncioController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El identificador del anuncio (adId) es requerido");
});
