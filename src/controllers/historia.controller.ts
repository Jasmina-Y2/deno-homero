import { HistoriaData } from "../models/historia.model.ts";
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { guardarHistoriaEnFirestoreService } from "../service/historia.service.ts";

export const crearHistoriaController = async (ctx: RouterContext<string>) => {
    try {
        const body = await ctx.request.body.json();

        const historiaId = await guardarHistoriaEnFirestoreService(body as HistoriaData);

        ctx.response.status = 201;
        ctx.response.body = {
            success: true,
            message: "Historia guardada correctamente",
            id: historiaId
        };

    } catch (error) {
        console.error("❌ Error en controlador Historia:", error);
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : "Error al guardar la historia"
        };
    }
};