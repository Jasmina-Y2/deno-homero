import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import { checkIfLikedService, toggleLikeService, obtenerTotalLikesService, getHistoriasConLikeService } from "../service/likeuser.service.ts";

export const checkLikeStatus = async (ctx: Context) => {
    try {
        const idPublicacion = ctx.request.url.searchParams.get("idPublicacion");
        const idUsuario = ctx.request.url.searchParams.get("idUsuario");

        if (!idPublicacion || !idUsuario) {
            ctx.response.status = 400;
            ctx.response.body = {
                success: false,
                message: "Faltan parámetros: idPublicacion o idUsuario"
            };
            return;
        }

        const isLiked = await checkIfLikedService(idPublicacion, idUsuario);

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            liked: isLiked
        };

    } catch (error: unknown) {
        ctx.response.status = 500;
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        ctx.response.body = { success: false, message: "Error interno del servidor", error: errorMessage };
    }
};
export const toggleLike = async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();
        const { idPublicacion, idUsuario } = body;

        if (!idPublicacion || !idUsuario) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "Faltan idPublicacion o idUsuario" };
            return;
        }

        const result = await toggleLikeService(idPublicacion, idUsuario);

        ctx.response.status = 200;
        ctx.response.body = { success: true, ...result };
    } catch (error: unknown) {
        ctx.response.status = 500;
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        ctx.response.body = { success: false, message: "Error gestionando el like", error: errorMessage };
    }
};
export const getLikesCount = async (ctx: RouterContext<string>) => {
    try {
        const id = ctx.params.id;
        const total = await obtenerTotalLikesService(id!);
        ctx.response.body = { success: true, totalLikes: total };
    } catch (error: unknown) {
        ctx.response.status = 500;
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        ctx.response.body = { success: false, message: "Error gestionando el like", error: errorMessage };
    }
};

export const getHistoriasLiked = async (ctx: RouterContext<string>) => {
    try {
        const { uid } = ctx.params;
        if (!uid) throw new Error("UID requerido");

        const data = await getHistoriasConLikeService(uid);
        ctx.response.body = { success: true, data };
    } catch (error: unknown) {
        ctx.response.status = 500;
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        ctx.response.body = { success: false, message: "Error obteniendo las historias likeadas", error: errorMessage };
    }
};