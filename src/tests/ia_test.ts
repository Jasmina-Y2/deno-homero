import { assertEquals } from "@std/assert";
import {
  detectarIdiomaController,
  generarDescripcionController,
  generarVozGeminiController,
} from "../controllers/ia.controller.ts";

function createMockContext(bodyData: any = {}) {
  const ctx: any = {
    request: {
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

Deno.test("IA Detectar Idioma: Falla si el texto está vacío", async () => {
  const ctx = createMockContext({ texto: "" });
  await detectarIdiomaController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
});

Deno.test("IA Generar Descripción: Falla si el texto está vacío", async () => {
  const ctx = createMockContext({ texto: "" });
  await generarDescripcionController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
});

Deno.test("IA Gemini Voz: Falla si el texto está vacío", async () => {
  const ctx = createMockContext({ texto: "" });
  await generarVozGeminiController(ctx);

  assertEquals(ctx.response.status, 400);
  assertEquals(ctx.response.body.success, false);
});

