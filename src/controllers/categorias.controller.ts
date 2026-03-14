import { Context } from "https://deno.land/x/oak/mod.ts";
import { getCategoriasService } from "../service/categorias.service.ts";

export const getCategoriasController = async (ctx: Context) => {
    try {
        const categorias = await getCategoriasService();

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            data: categorias
        };

    } catch (error: any) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            message: error.message
        };
    }
};