import { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { getHistoriasFromCategoriaService } from "../service/categoriahistoria.service.ts";

export const getHistoriasPorCategoria = async (ctx: RouterContext<string>) => {
    try {
        const { categoriaId } = ctx.params;

        if (!categoriaId) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "El ID de categoría es obligatorio" };
            return;
        }

        const data = await getHistoriasFromCategoriaService(categoriaId);
        ctx.response.body = { success: true, data };

    } catch (error: unknown) {
        ctx.response.status = 500;
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        ctx.response.body = { success: false, message: "Error obteniendo las historias de la categoria", error: errorMessage };
    }
};