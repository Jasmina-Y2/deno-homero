import { Context } from "https://deno.land/x/oak/mod.ts";
import { guardarAudioService, obtenerAudiosHistoriaService } from "../service/audiohistoria.service.ts";

export const guardarAudio = async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();
        const { historiaUID, index, url, idioma } = body;

        if (!historiaUID || index === undefined || !url || !idioma) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "Faltan datos requeridos (historiaUID, index, url, idioma)" };
            return;
        }

        const result = await guardarAudioService(historiaUID, index, url, idioma);

        ctx.response.status = 200;
        ctx.response.body = { success: true, message: "Audio guardado correctamente", data: result };
    } catch (error: any) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, message: "No se pudo guardar el audio", error: error.message };
    }
};

export const obtenerAudios = async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();
        const { historiaUID } = body;

        if (!historiaUID) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "historiaUID es requerido" };
            return;
        }
        const data = await obtenerAudiosHistoriaService(historiaUID);

        ctx.response.status = 200;
        ctx.response.body = { success: true, data };
    } catch (error: any) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, message: "Error obteniendo audios", error: error.message };
    }
};