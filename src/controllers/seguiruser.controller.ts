import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import { seguirUsuarioService, dejarDeSeguirService, getGenteQueYoSigoService } from "../service/seguiruser.service.ts";

/**
 * Controlador para que un usuario empiece a seguir a otro.
 * Se espera un método POST con un JSON que contenga miUid y uidASeguir.
 */
export const seguirUsuario = async (ctx: Context) => {
    try {
        const { miUid, uidASeguir } = await ctx.request.body.json();
        await seguirUsuarioService(miUid, uidASeguir);
        ctx.response.body = { success: true, message: "Usuario seguido" };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
};

/**
 * Controlador para dejar de seguir a un usuario.
 * Se espera un método POST con miUid y uidADejar.
 */
export const dejarDeSeguir = async (ctx: Context) => {
    try {
        const { miUid, uidADejar } = await ctx.request.body.json();
        await dejarDeSeguirService(miUid, uidADejar);
        ctx.response.body = { success: true, message: "Has dejado de seguir al usuario" };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
};

/**
 * Controlador para obtener la lista de usuarios.
 * Nota: Aquí usas RouterContext porque el UID viene en la URL: /api/seguidores/:uid
 */
export const getGenteQueYoSigo = async (ctx: RouterContext<string>) => {
    try {
        const uid = ctx.params.uid;
        const data = await getGenteQueYoSigoService(uid!);
        ctx.response.body = { success: true, data };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
};