import { HistoriaData } from "../models/historia.model.ts";
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { guardarHistoriaEnFirestoreService, getHistoriaByCustomIdService } from "../service/historia.service.ts";
import { generarThumbnailOGService, esUrlVideo } from "../service/multimedia.service.ts";

export const crearHistoriaController = async (ctx: RouterContext<string>) => {
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
        const firstImageInHistoria = Array.isArray(body.historia) && body.historia.length > 0
            ? body.historia[0]?.imagen
            : undefined;
        const mediaToProcess = body.poster || body.video || body.imagen || firstImageInHistoria;

        if (mediaToProcess) {
            try {
                const ogThumbnail = await generarThumbnailOGService(mediaToProcess, {
                    folder: "posters",
                    captureSecond: body.captureSecond ?? 2,
                });
                if (ogThumbnail) {
                    if (!body.poster || esUrlVideo(body.poster)) {
                        body.poster = ogThumbnail;
                    }
                    body.thumbnail = ogThumbnail;
                    body.ogImage = ogThumbnail;
                }
            } catch (mediaError) {
                console.warn("⚠️ No se pudo auto-generar thumbnail para Historia:", mediaError);
            }
        }

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
