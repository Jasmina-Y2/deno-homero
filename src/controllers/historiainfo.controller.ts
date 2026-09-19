
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
    guardarHistoriaInfoEnFirestoreService,
    obtenerCardsPorAutorService,
    getCardHistoriasService,
    incrementarVistasService,
    getHistoriaByIdService,
    getHistoriasPorVistas
} from "../service/historiaInfo.service.ts";
import { generarThumbnailOGService, esUrlVideo, esUrlImagen } from "../service/multimedia.service.ts";

export const crearHistoriaInfoController = async (ctx: RouterContext<string>) => {
    try {
        let body = (ctx.state as any)?.parsedBody;
        if (!body) {
            body = typeof (ctx.request.body as any)?.json === "function"
                ? await (ctx.request.body as any).json()
                : await ctx.request.body.json();
        }
        const user = (ctx.state as any)?.user;
        const isAdmin = Boolean((ctx.state as any)?.isAdmin);
        const uidFromHeader = ctx.request.headers.get("x-user-uid") || ctx.request.headers.get("uid");
        const authorUid = user?.uid || uidFromHeader || body.idAutor || body.uidAutor;

        if (authorUid && !isAdmin) {
            body.idAutor = authorUid;
        }

        // Auto-generación de Thumbnail / Poster Open Graph (1200x630) para WhatsApp
        const mediaToProcess = body.poster || body.portada || body.video || body.imagen;
        if (mediaToProcess) {
            try {
                const ogThumbnail = await generarThumbnailOGService(mediaToProcess, {
                    folder: "posters",
                    captureSecond: body.captureSecond ?? 2,
                });
                if (ogThumbnail) {
                    body.poster = body.poster || ogThumbnail;
                    body.thumbnail = ogThumbnail;
                    body.ogImage = ogThumbnail;
                }
            } catch (mediaError) {
                console.warn("⚠️ No se pudo auto-generar thumbnail para HistoriaInfo:", mediaError);
            }
        }

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


export const getHistoriasPorVistasController = async (ctx: RouterContext<string>) => {
    try {
        const historias = await getHistoriasPorVistas();

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
