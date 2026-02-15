import { CardHistoria } from "../models/cardhistoria.model.ts";
import { guardarCardHistoriaEnFirestoreService, obtenerCardHistoriaService } from "../service/cardhistoria.service.ts";
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";

export const crearCardHistoriaController = async (ctx: RouterContext<string>) => {
    try {
        const body = await ctx.request.body.json();

        const idNuevaCard = await guardarCardHistoriaEnFirestoreService(body as CardHistoria);

        ctx.response.status = 201;
        ctx.response.body = {
            success: true,
            message: "Card creada correctamente",
            id: idNuevaCard
        };

    } catch (error) {
        console.error("❌ Error en controlador CardHistoria:", error);
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido al guardar la card"
        };
    }
};
export const obtenerCardHistoriaController = async (ctx: RouterContext<string>) => {
    try {
        const historias = await obtenerCardHistoriaService();

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            message: "Historias obtenidas correctamente",
            data: historias
        };

    } catch (error) {
        console.error("❌ Error en controlador obtenerCardHistoria:", error);

        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido al obtener las historias"
        };
    }
};