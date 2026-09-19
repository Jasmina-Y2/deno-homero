import { assertEquals, assertRejects } from "@std/assert";
import { actualizarColeccionService } from "../service/coleccion.service.ts";

Deno.test("Colecciones: Validar requerimiento de UID al actualizar", async () => {
  await assertRejects(
    async () => {
      await actualizarColeccionService("", { nombre: "Nuevo Nombre" });
    },
    Error,
    "Se requiere el UID o ID de la colección",
  );
});
