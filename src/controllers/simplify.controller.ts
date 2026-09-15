import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import { obtenerCardHistoriaService } from "../service/cardhistoria.service.ts";
import { getUsuarioByUidService } from "../service/users.service.ts";
import {
  getHistoriaByIdService,
  getHistoriasPorVistas,
  getCardHistoriasService,
} from "../service/historiaInfo.service.ts";
import { checkIfLikedService, obtenerTotalLikesService } from "../service/likeuser.service.ts";
import { obtenerComentariosService } from "../service/comentarios.service.ts";
import { getColeccionPorNombreService } from "../service/coleccionids.service.ts";
import { getTodasLasColeccionesService } from "../service/coleccion.service.ts";
import { verificarHistoriaVistaService } from "../service/vistasuser.service.ts";
import { obtenerRankingCreadoresService } from "../service/propina.service.ts";

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

// ============================================================================
// CONTROLADOR SIMPLIFICADO TAB2: RANKING, MOST-VISTAS, HISTORIAS-INFO Y COLECCIONES
// ============================================================================
export const getSimplifyTab2DataController = async (
  ctx: RouterContext<string>,
) => {
  try {
    const url = ctx.request.url;
    const periodo = url.searchParams.get("periodo") || url.searchParams.get("mes") || "mes";
    const limiteRankingParam = parseInt(url.searchParams.get("limite") || "10", 10);
    const limiteRanking = isNaN(limiteRankingParam) || limiteRankingParam <= 0 ? 10 : limiteRankingParam;

    // 1. Ejecución paralela de las 4 fuentes de datos de Tab2
    const [
      rankingRaw,
      historiasPorVistasRaw,
      todasLasHistoriasRaw,
      todasLasColeccionesRaw,
    ] = await Promise.all([
      // A) Ranking mensual de creadores más apoyados
      (async () => {
        try {
          const res = await obtenerRankingCreadoresService(periodo);
          const items = Array.isArray(res?.ranking) ? res.ranking : [];
          return items.slice(0, limiteRanking);
        } catch (err) {
          console.warn("⚠️ Aviso al cargar ranking para Tab2:", err);
          return [];
        }
      })(),

      // B) Historias más vistas (HistoriaInfo)
      (async () => {
        try {
          return await getHistoriasPorVistas();
        } catch (err) {
          console.warn("⚠️ Aviso al cargar historias más vistas para Tab2:", err);
          return [];
        }
      })(),

      // C) Catálogo completo de historias (HistoriaInfo)
      (async () => {
        try {
          return await getCardHistoriasService();
        } catch (err) {
          console.warn("⚠️ Aviso al cargar catálogo de historias para Tab2:", err);
          return [];
        }
      })(),

      // D) Todas las colecciones
      (async () => {
        try {
          return await getTodasLasColeccionesService();
        } catch (err) {
          console.warn("⚠️ Aviso al cargar colecciones para Tab2:", err);
          return [];
        }
      })(),
    ]);

    const listaCatalogo: any[] = Array.isArray(todasLasHistoriasRaw) ? (todasLasHistoriasRaw as any[]) : [];

    // 2. Enriquecer las historias más vistas con el catálogo y perfil completo de cada autor
    const promesasVistasEnriquecidas = (historiasPorVistasRaw || []).map(async (item: any) => {
      const match: any = listaCatalogo.find((h: any) => {
        if (!h) return false;
        const hId = String(h.id || h.idDoc || "");
        const itemId = String(item.id || item.idDoc || "");
        const hDoc = String(h.idDoc || h.id || "");
        const itemDoc = String(item.idDoc || item.id || "");
        const hTitulo = (h.titulo || h.nombre || "").trim().toLowerCase();
        const itemTitulo = (item.titulo || item.nombre || "").trim().toLowerCase();

        return (
          (hId && (hId === itemId || hId === itemDoc)) ||
          (hDoc && (hDoc === itemId || hDoc === itemDoc)) ||
          (hTitulo && itemTitulo && hTitulo === itemTitulo)
        );
      });

      const authorId = String(
        item.idAutor ||
        item.autorId ||
        item.uidAutor ||
        match?.idAutor ||
        match?.autorId ||
        match?.uidAutor ||
        item.idUsuario ||
        "",
      );

      let autorPerfil: any = null;
      if (authorId) {
        try {
          const userDoc = (await getUsuarioByUidService(authorId)) as any;
          if (userDoc) {
            autorPerfil = {
              uid: userDoc.uid || authorId,
              name: userDoc.perfil?.name || userDoc.name || item.autor || match?.autor || "Creador Homero",
              displayName: userDoc.perfil?.name || userDoc.name || item.autor || match?.autor || "Creador Homero",
              photoURL: userDoc.perfil?.photoURL || userDoc.photoURL || item.photoURL || match?.photoURL || "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
              foto: userDoc.perfil?.photoURL || userDoc.photoURL || item.photoURL || match?.photoURL || "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
              avatar: userDoc.perfil?.photoURL || userDoc.photoURL || item.photoURL || match?.photoURL || "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
              descripcion: userDoc.perfil?.descripcion || userDoc.descripcion || "",
              bio: userDoc.perfil?.descripcion || userDoc.descripcion || "",
              verificado: Boolean(userDoc.perfil?.verificado ?? userDoc.verificado ?? false),
              marco_perfil_id: userDoc.perfil?.marco_perfil_id ?? userDoc.marco_perfil_id ?? null,
            };
          }
        } catch (e) {
          console.warn(`Aviso al cargar perfil de autor ${authorId}:`, e);
        }
      }

      const autorNombre =
        autorPerfil?.name ||
        autorPerfil?.displayName ||
        item.autor ||
        match?.autor ||
        "Creador Homero";

      const autorFoto =
        autorPerfil?.photoURL ||
        autorPerfil?.foto ||
        autorPerfil?.avatar ||
        item.fotoAutor ||
        item.photoURL ||
        match?.fotoAutor ||
        match?.photoURL ||
        "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png";

      const descEncontrada =
        item.descripcion ||
        item.descripcionES ||
        item.descripcionEN ||
        item.sinopsis ||
        item.resumen ||
        (match
          ? match.descripcion ||
            match.descripcionES ||
            match.descripcionEN ||
            match.sinopsis ||
            match.resumen ||
            match.detalles ||
            match.description
          : "") ||
        autorPerfil?.descripcion ||
        autorPerfil?.bio ||
        "";

      return {
        ...(match || {}),
        ...item,
        id: String(item.id || item.idDoc || match?.id || ""),
        idDoc: String(item.idDoc || item.id || match?.idDoc || ""),
        autorPerfil,
        autorNombre,
        autorFoto,
        idAutor: authorId,
        descripcion: descEncontrada,
      };
    });

    const mostVistasEnriquecidas = await Promise.all(promesasVistasEnriquecidas);

    ctx.response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Datos de Tab2 obtenidos correctamente",
      data: {
        ranking: rankingRaw,
        mostVistas: mostVistasEnriquecidas,
        vistas: mostVistasEnriquecidas,
        historiasInfo: listaCatalogo,
        colecciones: todasLasColeccionesRaw,
      },
    };
  } catch (error: any) {
    console.error("❌ Error en getSimplifyTab2DataController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener datos de Tab2",
      error: error?.message || "Error interno del servidor",
    };
  }
};
