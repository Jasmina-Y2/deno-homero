import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { obtenerCardHistoriaService } from "../service/cardhistoria.service.ts";
import { getUsuarioByUidService } from "../service/users.service.ts";
import { getHistoriaByIdService } from "../service/historiaInfo.service.ts";
import { checkIfLikedService, obtenerTotalLikesService } from "../service/likeuser.service.ts";
import { obtenerComentariosService } from "../service/comentarios.service.ts";
import { getColeccionPorNombreService } from "../service/coleccionids.service.ts";
import { verificarHistoriaVistaService } from "../service/vistasuser.service.ts";

// ============================================================================
// CONTROLADOR SIMPLIFICADO: TRAE 10 CARDS Y LLAMA A LOS SERVICES CON PROMISE.ALL
// ============================================================================
export const getSimplifyTab1CardsController = async (
  ctx: RouterContext<string>,
) => {
  try {
    const url = ctx.request.url;
    const limitParam = parseInt(url.searchParams.get("limit") || "10", 10);
    const limit = isNaN(limitParam) || limitParam <= 0 ? 10 : Math.min(limitParam, 50);
    const uid = url.searchParams.get("uid") || url.searchParams.get("idUsuario") || "";

    // 1. Traemos SOLO las 10 historias llamando al servicio existente
    const historias = await obtenerCardHistoriaService(limit);

    if (!historias || historias.length === 0) {
      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "No hay historias disponibles",
        data: [],
        count: 0,
      };
      return;
    }

    // 2. Mapeamos cada historia para ejecutar los servicios existentes en paralelo con Promise.all
    const promesasDeHistorias = historias.map(async (historia: any) => {
      const idHistoria = String(historia.id || historia.idDoc || "");
      const idAutor = String(
        historia.idAutor ||
        historia.id_autor ||
        historia.uidAutor ||
        historia.autorId ||
        historia.idUsuario ||
        "",
      );
      const coleccionUid =
        historia.Coleccion?.[0]?.uid ||
        historia.coleccion?.[0]?.uid ||
        (typeof historia.Coleccion === "string" ? historia.Coleccion : null);

      // 3. Ejecución concurrente llamando ÚNICAMENTE a los servicios del backend
      const [
        autor,
        historiaInfo,
        likesCount,
        isLiked,
        comentarios,
        coleccionHistorias,
        yaVisto,
      ] = await Promise.all([
        // Servicio de Usuario / Perfil del Autor
        (async () => {
          if (!idAutor) return null;
          try {
            const userDoc = (await getUsuarioByUidService(idAutor)) as any;
            if (!userDoc) return null;
            return {
              ...userDoc,
              name: userDoc.perfil?.name || userDoc.name || historia.autor || "Usuario",
              photoURL: userDoc.perfil?.photoURL || userDoc.photoURL || historia.photoURL || "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
              descripcion: userDoc.perfil?.descripcion || userDoc.descripcion || "",
              verificado: Boolean(userDoc.perfil?.verificado ?? userDoc.verificado ?? false),
              marco_perfil_id: userDoc.perfil?.marco_perfil_id ?? userDoc.marco_perfil_id ?? null,
            };
          } catch (err) {
            console.warn(`Aviso al cargar autor ${idAutor}:`, err);
            return null;
          }
        })(),

        // Servicio de HistoriaInfo
        (async () => {
          if (!idHistoria) return null;
          try {
            const info = await getHistoriaByIdService(idHistoria);
            return Array.isArray(info) && info.length > 0 ? info[0] : null;
          } catch (err) {
            console.warn(`Aviso al cargar info de historia ${idHistoria}:`, err);
            return null;
          }
        })(),

        // Servicio de Total Likes
        (async () => {
          if (!idHistoria) return 0;
          try {
            return await obtenerTotalLikesService(idHistoria);
          } catch {
            return Number(historia.likes || 0);
          }
        })(),

        // Servicio para verificar si el usuario dio Like
        (async () => {
          if (!idHistoria || !uid) return false;
          try {
            return await checkIfLikedService(idHistoria, uid);
          } catch {
            return false;
          }
        })(),

        // Servicio de Comentarios
        (async () => {
          if (!idHistoria) return [];
          try {
            return await obtenerComentariosService(idHistoria, 20);
          } catch (err) {
            console.warn(`Aviso al cargar comentarios de ${idHistoria}:`, err);
            return [];
          }
        })(),

        // Servicio de Colección
        (async () => {
          if (!coleccionUid) return [];
          try {
            return await getColeccionPorNombreService(coleccionUid);
          } catch (err) {
            console.warn(`Aviso al cargar colección ${coleccionUid}:`, err);
            return [];
          }
        })(),

        // Servicio de Historial de Vista
        (async () => {
          if (!idHistoria || !uid) return false;
          try {
            return await verificarHistoriaVistaService(uid, idHistoria);
          } catch {
            return false;
          }
        })(),
      ]);

      // 4. Retornamos la tarjeta con todos sus datos resueltos
      return {
        ...historia,
        id: idHistoria,
        autor: autor || {
          name: historia.autor || "Usuario",
          photoURL: historia.photoURL || "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
          descripcion: "",
          verificado: false,
          marco_perfil_id: null,
        },
        historiaInfo: historiaInfo,
        reacHistoria: historiaInfo ? [historiaInfo] : [],
        likesCount: likesCount,
        isLiked: isLiked,
        comentarios: comentarios,
        totalComentarios: comentarios.length,
        coleccionHistorias: coleccionHistorias,
        totalEpisodios: coleccionHistorias.length,
        yaVisto: yaVisto,
      };
    });

    const cardsUnificadas = await Promise.all(promesasDeHistorias);

    ctx.response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Cards simplificadas obtenidas correctamente desde los servicios",
      data: cardsUnificadas,
      count: cardsUnificadas.length,
    };
  } catch (error: any) {
    console.error("❌ Error en getSimplifyTab1CardsController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener las cards simplificadas",
      error: error?.message || "Error interno del servidor",
    };
  }
};
