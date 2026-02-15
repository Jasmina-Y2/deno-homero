
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { guardarHistoriaInfoEnFirestoreService } from "../service/historiaInfo.service.ts";

export const crearHistoriaInfoController = async (ctx: RouterContext<string>) => {
    try {
        const body = await ctx.request.body.json();

        const infoId = await guardarHistoriaInfoEnFirestoreService(body);
        ctx.response.status = 201;
        ctx.response.body = {
            success: true,
            message: "Estadísticas inicializadas correctamente",
            id: infoId
        };
    } catch (error) {
        console.error("❌ Error en controlador HistoriaInfo:", error);
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : "Error al guardar info de la historia"
        };
    }
};