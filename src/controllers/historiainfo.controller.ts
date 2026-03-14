
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
    guardarHistoriaInfoEnFirestoreService,
    obtenerCardsPorAutorService,
    getCardHistoriasService,
    incrementarVistasService,
    getHistoriaByIdService
} from "../service/historiaInfo.service.ts";

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
export const getCardsPorAutor = async (ctx: RouterContext<string>) => {
    try {
        const idAutor = ctx.request.url.searchParams.get("idAutor");

        if (!idAutor) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "idAutor requerido" };
            return;
        }

        const historias = await obtenerCardsPorAutorService(idAutor);

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            data: historias
        };

    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, error: error instanceof Error ? error.message : "Error al obtener info de la historia" };
    }
};

export const getCardHistoriasController = async (ctx: RouterContext<string>) => {
    try {
        const historias = await getCardHistoriasService();

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            data: historias
        };

    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : "Error al obtener info de la historia"
        };
    }
};

export const incrementarVistas = async (ctx: RouterContext<string>) => {
    try {
        const id = ctx.params.id;
        if (!id) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "ID requerido en la URL" };
            return;
        }
        const nuevasVistas = await incrementarVistasService(id);

        if (nuevasVistas === null) {
            ctx.response.status = 404;
            ctx.response.body = { success: false, message: "Historia no encontrada" };
            return;
        }
        ctx.response.status = 200;
        ctx.response.body = { success: true, vistas: nuevasVistas };
    } catch (error: any) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, message: "Error al incrementar vistas", error: error.message };
    }
};

export const getHistoriaById = async (ctx: RouterContext<string>) => {
    try {
        const id = ctx.params.id;
        if (!id) throw new Error("ID de historia es requerido");

        const data = await getHistoriaByIdService(id);
        ctx.response.body = { success: true, data };
    } catch (error: any) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, error: error.message };
    }
};