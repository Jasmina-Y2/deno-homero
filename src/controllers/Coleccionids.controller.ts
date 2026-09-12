import { 
    agregarHistoriaAColeccionService, 
    getColeccionPorNombreService, 
    reordenarEpisodiosColeccionService 
} from "../service/coleccionids.service.ts";
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";

export const agregarHistoriaAColeccionController = async (ctx: RouterContext<string>) => {
    try {
        const body = await ctx.request.body.json();
        const result = await agregarHistoriaAColeccionService(body.idColeccion, body.idHistoria);
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

export const getColeccionDetalle = async (ctx: RouterContext<string>) => {
    try {
        const { docId } = ctx.params;
        if (!docId) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "docId es requerido" };
            return;
        }

        const data = await getColeccionPorNombreService(docId);
        ctx.response.body = { success: true, data };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, error: error instanceof Error ? error.message : String(error) };
    }
};

export const reordenarEpisodiosColeccionController = async (ctx: RouterContext<string>) => {
    try {
        const body = await ctx.request.body.json();
        const idColeccion = body.idColeccion || body.uid || body.docId || ctx.params?.idColeccion || ctx.params?.docId;
        const historias = body.historias || body.historiasIds || body.episodios || body.orden;

        if (!idColeccion) {
            ctx.response.status = 400;
            ctx.response.body = {
                success: false,
                error: "Falta el campo 'idColeccion' o 'uid' en el cuerpo de la petición.",
            };
            return;
        }

        if (!historias || !Array.isArray(historias) || historias.length === 0) {
            ctx.response.status = 400;
            ctx.response.body = {
                success: false,
                error: "Debes enviar un array 'historias' con los IDs en el nuevo orden.",
            };
            return;
        }

        const result = await reordenarEpisodiosColeccionService(idColeccion, historias);

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            ...result,
        };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido al reordenar episodios",
        };
    }
};