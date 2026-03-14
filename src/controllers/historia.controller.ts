import { HistoriaData } from "../models/historia.model.ts";
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { guardarHistoriaEnFirestoreService, getHistoriaByCustomIdService } from "../service/historia.service.ts";

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
export const getHistoriaByCustomId = async (ctx: RouterContext<string>) => {
    try {
        const customId = ctx.params.id;
        if (!customId) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "El ID es requerido" };
            return;
        }

        const data = await getHistoriaByCustomIdService(customId);

        ctx.response.status = 200;
        ctx.response.body = { success: true, data };
    } catch (error: any) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, message: "Error interno del servidor", error: error.message };
    }
};
