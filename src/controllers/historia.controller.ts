import { HistoriaData } from "../models/historia.model.ts";
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { guardarHistoriaEnFirestoreService, getHistoriaByCustomIdService } from "../service/historia.service.ts";
import { generarThumbnailOGService, esUrlVideo, esUrlImagen } from "../service/multimedia.service.ts";

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
        const escenaConImagen = Array.isArray(body.historia)
            ? body.historia.find((h: any) => (h?.imagen && esUrlImagen(h?.imagen)) || (h?.media && esUrlImagen(h?.media)))
            : undefined;
        const escenaFallback = Array.isArray(body.historia) && body.historia.length > 0
            ? (body.historia[0]?.imagen || body.historia[0]?.media)
            : undefined;
        const fallbackImage = escenaConImagen?.imagen || escenaConImagen?.media || (escenaFallback && esUrlImagen(escenaFallback) ? escenaFallback : undefined);

        // El campo poster debe ser SIEMPRE una imagen (.webp, .jpg, .png), NUNCA un video
        if (body.poster && esUrlVideo(body.poster)) {
            body.poster = "";
        }
        if (!body.poster) {
            const imgValida = [body.imagen, fallbackImage, body.portada].find(
                (url) => url && typeof url === "string" && !esUrlVideo(url)
            );
            body.poster = imgValida || "";
        }

        // Limpiar campos redundantes: dejar únicamente 'poster'
        delete body.thumbnail;
        delete body.ogImage;

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
