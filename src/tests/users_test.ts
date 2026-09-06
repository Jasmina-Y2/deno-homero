import { assertEquals } from "@std/assert";
import { asignarPrivilegiosUsuarioController } from "../controllers/users.controller.ts";

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
