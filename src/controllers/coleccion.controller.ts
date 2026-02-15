import { crearColeccionService, mostrarColeccionesPorAutorService } from "../service/coleccion.service.ts"
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { ColeccionData } from "../models/coleccion.model.ts";

export const crearColeccionController = async (ctx: RouterContext<string>) => {
    try {
        const body = await ctx.request.body.json();
        console.log(body);
        if (!body.idAutor) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, error: "Faltan idAutor" };
            return;
        }

        const coleccionId = await crearColeccionService(body as ColeccionData);
        ctx.response.status = 201;
        ctx.response.body = { success: true, id: coleccionId };

    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : "Error desconocido"
        };
    }
};

export const mostrarColeccionesPorAutorController = async (ctx: RouterContext<string>) => {
    try {
        const idAutor = ctx.request.url.searchParams.get("idAutor");
        if (!idAutor) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, error: "Se requiere el parámetro idAutor" };
            return;
        }
        const colecciones = await mostrarColeccionesPorAutorService(idAutor);
        ctx.response.status = 200;
        ctx.response.body = { success: true, data: colecciones };
    } catch (err) {
        const error = err as Error;
        ctx.response.status = 500;
        ctx.response.body = { success: false, error: error.message };
    }
};
