import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import { getGenteQueMeSigueService } from "../service/seguir.service.ts";


export const getGenteQueMeSigue = async (ctx: RouterContext<string>) => {
    try {
        const uid = ctx.params.uid;

        if (!uid) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "El UID es requerido en la URL" };
            return;
        }

        const data = await getGenteQueMeSigueService(uid);

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            data: data
        };
    } catch (error) {
        console.error("❌ Error en el controlador getGenteQueMeSigue:", error);
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            message: "Error al obtener la lista de seguidores",
            error: error instanceof Error ? error.message : String(error)
        };
    }
};

