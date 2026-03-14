import { Context } from "https://deno.land/x/oak/mod.ts";
import * as service from "../service/auth.service.ts";

export const loginAndSync = async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();

        if (!body.uid || !body.email) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "Datos de usuario incompletos" };
            return;
        }

        const user = await service.syncUserWithGoogleService(body);
        ctx.response.body = { success: true, user };
    } catch (error: unknown) {
        ctx.response.status = 500;
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        ctx.response.body = { success: false, error: errorMessage };
    }
};