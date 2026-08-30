import { Context, RouterContext } from "https://deno.land/x/oak/mod.ts";
import { seguirUsuarioService, dejarDeSeguirService, getGenteQueYoSigoService } from "../service/seguiruser.service.ts";

/**
 * Controlador para que un usuario empiece a seguir a otro.
 * Soporta { miUid, uidASeguir } o { idSeguidor, idSeguido, nombreSeguidor }.
 */
export const seguirUsuario = async (ctx: Context) => {
    try {
        const body = await ctx.request.body.json();
        const miUid = body.miUid || body.idSeguidor;
        const uidASeguir = body.uidASeguir || body.idSeguido;
        const nombreSeguidor = body.nombreSeguidor;

        if (!miUid || !uidASeguir) {
            ctx.response.status = 400;
            ctx.response.body = {
                success: false,
                message: "Faltan datos requeridos: miUid (o idSeguidor) y uidASeguir (o idSeguido)"
            };
            return;
        }

        await seguirUsuarioService(miUid, uidASeguir, nombreSeguidor);
        ctx.response.body = { success: true, message: "Usuario seguido con éxito" };
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