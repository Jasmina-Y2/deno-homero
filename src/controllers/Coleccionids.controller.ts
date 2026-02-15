import { agregarHistoriaAColeccionService } from "../service/coleccionids.service.ts"
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";



export const agregarHistoriaAColeccionController = async (ctx: RouterContext<string>) => {
    try {
        const body = await ctx.request.body.json();
        const result = await agregarHistoriaAColeccionService(body.coleccionId, body.historiaId);
        ctx.response.status = 200;
        ctx.response.body = { success: result };

    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        };
    }
};
