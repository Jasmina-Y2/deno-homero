import { assertEquals } from "@std/assert";
import { enviarPropinaController } from "../controllers/propina.controller.ts";

function createMockContext(bodyData: any) {
  const ctx: any = {
    request: {
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

Deno.test("Validación: Oyente y creador son el mismo usuario", async () => {
  const ctx = createMockContext({
    idOyente: "mismo123",
    idCreador: "mismo123",
    cantidadMonedas: 10,
    tipoSticker: "estrella",
  });

  await enviarPropinaController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El oyente y el creador no pueden ser el mismo usuario");
});

Deno.test("Validación: Cantidad de monedas inválida o <= 0", async () => {
  const ctx = createMockContext({
    idOyente: "oyente123",
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
    idOyente: "oyente123",
    idCreador: "creador123",
    cantidadMonedas: 15,
  });

  await enviarPropinaController(ctx);
  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
  assertEquals(ctx.response.body.message, "El tipo de sticker es requerido");
});
