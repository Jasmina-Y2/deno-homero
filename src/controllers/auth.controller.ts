import { Context } from "https://deno.land/x/oak/mod.ts";
import * as service from "../service/auth.service.ts";
import { generarToken } from "../utils/jwt.ts";

export const loginAndSync = async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();

        if (!body.uid || !body.email) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "Datos de usuario incompletos" };
            return;
        }

        const user = await service.syncUserWithGoogleService(body);

        const esAdmin = Boolean(
            user.sistema?.ADMIN === true ||
            (user as any).ADMIN === true ||
            user.perfil?.rol?.toLowerCase() === "admin" ||
            (user as any).rol?.toLowerCase() === "admin"
        );

        const token = generarToken({
            uid: user.uid,
            email: user.perfil?.email || (user as any).email || body.email,
            name: user.perfil?.name || (user as any).name || body.name || "",
            rol: user.perfil?.rol || (user as any).rol || (esAdmin ? "admin" : "usuario"),
            isAdmin: esAdmin,
            verificado: Boolean(user.perfil?.verificado),
        });

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            token,
            user,
        };
    } catch (error: unknown) {
        ctx.response.status = 500;
        const errorMessage = error instanceof Error ? error.message : "Error desconocido";
        ctx.response.body = { success: false, error: errorMessage };
    }
};