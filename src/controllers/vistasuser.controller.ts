import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import { registrarVistaUsuarioService, verificarHistoriaVistaService, getHistoriasVistasService } from "../service/vistasuser.service.ts";
export const registrarVistaUsuario = async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();
        const { idUsuario, idHistoria } = body;

        if (!idUsuario || !idHistoria) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "Faltan idUsuario o idHistoria" };
            return;
        }

        await registrarVistaUsuarioService(idUsuario, idHistoria);

        ctx.response.status = 200;
        ctx.response.body = { success: true, message: "Vista registrada en el usuario" };
    } catch (error: unknown) {
        ctx.response.status = 500;
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        ctx.response.body = { success: false, message: "Error registrando vista", error: errorMessage };
    }
};

export const checkStoryViewed = async (ctx: RouterContext<string>) => {
    try {
        const { idUsuario, idHistoria } = ctx.params;
        const viewed = await verificarHistoriaVistaService(idUsuario!, idHistoria!);
        ctx.response.body = { success: true, viewed };
    } catch (error: unknown) {
        ctx.response.status = 500;
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        ctx.response.body = { success: false, message: "Error verificando vista", error: errorMessage };
    }
};

export const getHistoriasVistas = async (ctx: RouterContext<string>) => {
    try {
        const { uid } = ctx.params;
        if (!uid) throw new Error("UID requerido");

        const data = await getHistoriasVistasService(uid);
        ctx.response.body = { success: true, data };
    } catch (error: unknown) {
        ctx.response.status = 500;
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        ctx.response.body = { success: false, message: "Error obteniendo las historias vistas", error: errorMessage };
    }
};