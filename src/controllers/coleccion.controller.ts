import { 
    crearColeccionService,
    getTodasLasColeccionesService, 
    mostrarColeccionesPorAutorService, 
    getColeccionesPorIdService, 
    eliminarColeccionesPorUidService,
    calificarColeccionService,
    obtenerCalificacionColeccionService,
    eliminarCalificacionColeccionService
} from "../service/coleccion.service.ts";
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { ColeccionData } from "../models/coleccion.model.ts";

export const crearColeccionController = async (ctx: RouterContext<string>) => {
    try {
        const body = await ctx.request.body.json();
        const user = (ctx.state as any)?.user;
        const isAdmin = Boolean((ctx.state as any)?.isAdmin);
        const uidFromHeader = ctx.request.headers.get("x-user-uid") || ctx.request.headers.get("uid");
        const authorUid = user?.uid || uidFromHeader || body.idAutor || body.uidAutor;

        if (authorUid && !isAdmin) {
            body.idAutor = authorUid;
        }

        // Si la colección no tiene un UUID generado, asignar uno
        if (!body.uid) {
            body.uid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        }

        if (!body.idAutor) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, error: "Falta idAutor" };
            return;
        }

        const coleccionId = await crearColeccionService(body as ColeccionData);
        ctx.response.status = 201;
        ctx.response.body = { success: true, id: coleccionId, uid: body.uid };

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

export const getColeccionesPorId = async (ctx: RouterContext<string>) => {
    try {
        const { uid } = ctx.params;
        if (!uid) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "UID es requerido" };
            return;
        }
        const data = await getColeccionesPorIdService(uid);
        ctx.response.body = { success: true, data };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, error: error instanceof Error ? error.message : String(error) };
    }
};

export const eliminarColeccionesPorUid = async (ctx: RouterContext<string>) => {
    try {
        const { uid } = ctx.params;
        const user = (ctx.state as any)?.user;
        const isAdmin = Boolean((ctx.state as any)?.isAdmin);
        const uidFromParams = ctx.request.url.searchParams.get("uid") ||
            ctx.request.url.searchParams.get("idAutor") ||
            ctx.request.headers.get("x-user-uid") ||
            ctx.request.headers.get("uid");
        const userUid = user?.uid || uidFromParams || undefined;

        if (!uid) {
            ctx.response.status = 400;
            ctx.response.body = { success: false, message: "UID o ID de colección es requerido" };
            return;
        }

        const data = await eliminarColeccionesPorUidService(uid, userUid, isAdmin);
        
        ctx.response.status = 200;
        ctx.response.body = { success: true, data };
    } catch (error: any) {
        if (error?.message === "FORBIDDEN") {
            ctx.response.status = 403;
            ctx.response.body = {
                success: false,
                message: "Acceso denegado: Solo el autor o un Administrador pueden eliminar esta colección.",
            };
            return;
        }
        ctx.response.status = 500;
        ctx.response.body = { 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
        };
    }
};

export const getTodasLasColecciones = async (ctx: RouterContext<string>) => {
    try {
        const colecciones = await getTodasLasColeccionesService();
        ctx.response.status = 200;
        ctx.response.body = { success: true, data: colecciones };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = { success: false, error: error instanceof Error ? error.message : String(error) };
    }
};

export const calificarColeccionController = async (ctx: RouterContext<string>) => {
    try {
        const body = await ctx.request.body.json();
        const idColeccion = body.idColeccion || body.uid || body.docId;
        const idUsuario = body.idUsuario || body.uidUsuario || body.userId;
        const puntuacion = body.puntuacion ?? body.calificacion ?? body.rating ?? body.estrellas;
        const nombreUsuario = body.nombreUsuario || body.nombre;

        if (!idColeccion || !idUsuario) {
            ctx.response.status = 400;
            ctx.response.body = {
                success: false,
                error: "Faltan datos requeridos: 'idColeccion' e 'idUsuario'."
            };
            return;
        }

        if (puntuacion === undefined || puntuacion === null || isNaN(Number(puntuacion))) {
            ctx.response.status = 400;
            ctx.response.body = {
                success: false,
                error: "Debes enviar una 'puntuacion' válida entre 1 y 5 estrellas."
            };
            return;
        }

        const result = await calificarColeccionService(
            idColeccion,
            idUsuario,
            Number(puntuacion),
            nombreUsuario
        );

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            ...result,
        };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : "Error al calificar la colección"
        };
    }
};

export const obtenerCalificacionColeccionController = async (ctx: RouterContext<string>) => {
    try {
        const idColeccion = ctx.params?.idColeccion || ctx.params?.uid;
        const idUsuario = ctx.params?.idUsuario || ctx.request.url.searchParams.get("idUsuario") || undefined;

        if (!idColeccion) {
            ctx.response.status = 400;
            ctx.response.body = {
                success: false,
                error: "Parámetro 'idColeccion' es requerido en la URL."
            };
            return;
        }

        const result = await obtenerCalificacionColeccionService(idColeccion, idUsuario);

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            ...result,
        };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : "Error al obtener la calificación"
        };
    }
};

export const eliminarCalificacionColeccionController = async (ctx: RouterContext<string>) => {
    try {
        const body = await ctx.request.body.json();
        const idColeccion = body.idColeccion || body.uid;
        const idUsuario = body.idUsuario || body.uidUsuario;

        if (!idColeccion || !idUsuario) {
            ctx.response.status = 400;
            ctx.response.body = {
                success: false,
                error: "Faltan datos requeridos: 'idColeccion' e 'idUsuario'."
            };
            return;
        }

        const result = await eliminarCalificacionColeccionService(idColeccion, idUsuario);

        ctx.response.status = 200;
        ctx.response.body = {
            success: true,
            ...result,
        };
    } catch (error) {
        ctx.response.status = 500;
        ctx.response.body = {
            success: false,
            error: error instanceof Error ? error.message : "Error al eliminar la calificación"
        };
    }
};
