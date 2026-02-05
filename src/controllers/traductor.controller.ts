// src/controllers/traductor.controller.ts
import { Context } from "https://deno.land/x/oak/mod.ts";

export const traducirTexto = async (ctx: Context) => {
    try {
        // Verificamos si hay cuerpo
        if (!ctx.request.hasBody) {
            ctx.response.status = 400;
            ctx.response.body = { ok: false, message: "No enviaste datos" };
            return;
        }

        // Usamos .json() para parsear el body directamente
        const body = await ctx.request.body.json();

        const { texto, idiomaOrigen = "en", idiomaDestino = "es" } = body;

        // Validación básica
        if (!texto) {
            ctx.response.status = 400;
            ctx.response.body = { ok: false, message: "Por favor envía el campo 'texto'" };
            return;
        }

        console.log(`🔤 Traduciendo: "${texto}" de ${idiomaOrigen} a ${idiomaDestino}...`);
        // Agrega &de=tu_email@gmail.com al final
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=${idiomaOrigen}|${idiomaDestino}&de=yasmin@gmail.com`;
        const respuestaExterna = await fetch(url);
        const data = await respuestaExterna.json();

        ctx.response.body = {
            ok: true,
            original: texto,
            traduccion: data.responseData.translatedText,
            match: data.responseData.match
        };

    } catch (error) {
        console.error("❌ Error al traducir:", error);
        ctx.response.status = 500;
        ctx.response.body = { ok: false, message: "Error interno del servidor de traducción" };
    }
};