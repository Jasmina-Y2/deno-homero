import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
  getHistoriaCardByCustomId2Service,
  obtenerCardHistoriaService,
} from "../service/cardhistoria.service.ts";
import { getUsuarioByUidService } from "../service/users.service.ts";
import {
  getCardHistoriasService,
  getHistoriaByIdService,
  getHistoriasPorVistas,
} from "../service/historiaInfo.service.ts";
import {
  checkIfLikedService,
  obtenerTotalLikesService,
} from "../service/likeuser.service.ts";
import { obtenerComentariosService } from "../service/comentarios.service.ts";
import { getColeccionPorNombreService } from "../service/coleccionids.service.ts";
import {
  getTodasLasColeccionesService,
  mostrarColeccionesPorAutorService,
} from "../service/coleccion.service.ts";
import { verificarHistoriaVistaService } from "../service/vistasuser.service.ts";
import {
  obtenerHistorialUsuarioService,
  obtenerRankingCreadoresService,
} from "../service/propina.service.ts";
import {
  obtenerNotificacionesNoLeidasCountService,
  obtenerNotificacionesPorUsuarioService,
} from "../service/notification.service.ts";
import { CATALOGO_VOCES_AZURE, LISTA_VOCES_GEMINI } from "./ia.controller.ts";
import { ElevenLabsService } from "../service/elevenlabs.service.ts";
import { db } from "../config/firebase.ts";

// ============================================================================
// CONTROLADOR SIMPLIFICADO: TRAE 10 CARDS Y LLAMA A LOS SERVICES CON PROMISE.ALL
// ============================================================================
export const getSimplifyTab1CardsController = async (
  ctx: RouterContext<string>,
) => {
  try {
    const url = ctx.request.url;
    const limitParam = parseInt(url.searchParams.get("limit") || "10", 10);
    const limit = isNaN(limitParam) || limitParam <= 0
      ? 10
      : Math.min(limitParam, 50);
    const uid = url.searchParams.get("uid") ||
      url.searchParams.get("idUsuario") || "";

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
      const coleccionUid = historia.Coleccion?.[0]?.uid ||
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
              name: userDoc.perfil?.name || userDoc.name || historia.autor ||
                "Usuario",
              photoURL: userDoc.perfil?.photoURL || userDoc.photoURL ||
                historia.photoURL ||
                "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
              descripcion: userDoc.perfil?.descripcion || userDoc.descripcion ||
                "",
              verificado: Boolean(
                userDoc.perfil?.verificado ?? userDoc.verificado ?? false,
              ),
              marco_perfil_id: userDoc.perfil?.marco_perfil_id ??
                userDoc.marco_perfil_id ?? null,
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
            console.warn(
              `Aviso al cargar info de historia ${idHistoria}:`,
              err,
            );
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
          photoURL: historia.photoURL ||
            "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
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

    ctx.response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message:
        "Cards simplificadas obtenidas correctamente desde los servicios",
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
    const periodo = url.searchParams.get("periodo") ||
      url.searchParams.get("mes") || "mes";
    const limiteRankingParam = parseInt(
      url.searchParams.get("limite") || "10",
      10,
    );
    const limiteRanking = isNaN(limiteRankingParam) || limiteRankingParam <= 0
      ? 10
      : limiteRankingParam;

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
          console.warn(
            "⚠️ Aviso al cargar historias más vistas para Tab2:",
            err,
          );
          return [];
        }
      })(),

      // C) Catálogo completo de historias (HistoriaInfo)
      (async () => {
        try {
          return await getCardHistoriasService();
        } catch (err) {
          console.warn(
            "⚠️ Aviso al cargar catálogo de historias para Tab2:",
            err,
          );
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

    const listaCatalogo: any[] = Array.isArray(todasLasHistoriasRaw)
      ? (todasLasHistoriasRaw as any[])
      : [];

    // 2. Enriquecer las historias más vistas con el catálogo y perfil completo de cada autor
    const promesasVistasEnriquecidas = (historiasPorVistasRaw || []).map(
      async (item: any) => {
        const match: any = listaCatalogo.find((h: any) => {
          if (!h) return false;
          const hId = String(h.id || h.idDoc || "");
          const itemId = String(item.id || item.idDoc || "");
          const hDoc = String(h.idDoc || h.id || "");
          const itemDoc = String(item.idDoc || item.id || "");
          const hTitulo = (h.titulo || h.nombre || "").trim().toLowerCase();
          const itemTitulo = (item.titulo || item.nombre || "").trim()
            .toLowerCase();

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
                name: userDoc.perfil?.name || userDoc.name || item.autor ||
                  match?.autor || "Creador Homero",
                displayName: userDoc.perfil?.name || userDoc.name ||
                  item.autor || match?.autor || "Creador Homero",
                photoURL: userDoc.perfil?.photoURL || userDoc.photoURL ||
                  item.photoURL || match?.photoURL ||
                  "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
                foto: userDoc.perfil?.photoURL || userDoc.photoURL ||
                  item.photoURL || match?.photoURL ||
                  "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
                avatar: userDoc.perfil?.photoURL || userDoc.photoURL ||
                  item.photoURL || match?.photoURL ||
                  "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
                descripcion: userDoc.perfil?.descripcion ||
                  userDoc.descripcion || "",
                bio: userDoc.perfil?.descripcion || userDoc.descripcion || "",
                verificado: Boolean(
                  userDoc.perfil?.verificado ?? userDoc.verificado ?? false,
                ),
                marco_perfil_id: userDoc.perfil?.marco_perfil_id ??
                  userDoc.marco_perfil_id ?? null,
              };
            }
          } catch (e) {
            console.warn(`Aviso al cargar perfil de autor ${authorId}:`, e);
          }
        }

        const autorNombre = autorPerfil?.name ||
          autorPerfil?.displayName ||
          item.autor ||
          match?.autor ||
          "Creador Homero";

        const autorFoto = autorPerfil?.photoURL ||
          autorPerfil?.foto ||
          autorPerfil?.avatar ||
          item.fotoAutor ||
          item.photoURL ||
          match?.fotoAutor ||
          match?.photoURL ||
          "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png";

        const descEncontrada = item.descripcion ||
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
      },
    );

    const mostVistasEnriquecidas = await Promise.all(
      promesasVistasEnriquecidas,
    );

    ctx.response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );
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

// ============================================================================
// CONTROLADOR SIMPLIFICADO USER: TRAE DATOS DE USUARIO Y AUDITA SALDO DE MONEDAS
// ============================================================================
export const getSimplifyUserDataController = async (
  ctx: RouterContext<string>,
) => {
  try {
    const url = ctx.request.url;
    const uid = ctx.params?.uid || url.searchParams.get("uid") ||
      url.searchParams.get("idUsuario") || "";

    if (!uid || uid.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message:
          "El parámetro UID es requerido en la URL (/api/simplify/users/:uid) o como query parameter (?uid=...)",
      };
      return;
    }

    const cleanUid = uid.trim();
    console.log("📥 [API /api/simplify/users] Petición recibida para UID:", cleanUid);

    // 1. Ejecución paralela: consultar usuario y consultar historial de transacciones
    const [userDoc, historial] = await Promise.all([
      (async () => {
        try {
          return await getUsuarioByUidService(cleanUid);
        } catch (err) {
          console.warn(`⚠️ Aviso al cargar usuario ${cleanUid}:`, err);
          return null;
        }
      })(),
      (async () => {
        try {
          return await obtenerHistorialUsuarioService(cleanUid);
        } catch (err) {
          console.warn(
            `⚠️ Aviso al cargar historial de transacciones de ${cleanUid}:`,
            err,
          );
          return null;
        }
      })(),
    ]);

    if (!userDoc) {
      console.warn("❌ [API /api/simplify/users] No se encontró usuario para UID:", cleanUid);
      ctx.response.status = 404;
      ctx.response.body = {
        success: false,
        message: `No se encontró ningún usuario con UID: ${cleanUid}`,
        data: null,
      };
      return;
    }

    // 2. Calcular las monedas desde el historial de transacciones
    let saldoMonedas = 0;
    if (historial) {
      const ganancias = Number(historial.totalGanancias || 0);
      const recompensas = Number(historial.totalRecompensas || 0);
      const gastos = Number(historial.totalGastos || 0);
      saldoMonedas = Math.max(0, (ganancias + recompensas) - gastos);
    }

    // 3. Devolver el objeto con todos los datos del usuario + apartado de monedas (sin idDoc)
    const rawUser = { ...(userDoc as any) };
    delete rawUser.idDoc;

    const finalUid = rawUser.uid || cleanUid;

    const usuarioConMonedas = {
      ...rawUser,
      uid: finalUid,
      monedas: saldoMonedas,
      saldoMonedas: saldoMonedas,
      billetera: {
        ...(rawUser.billetera || {}),
        monedas: saldoMonedas,
      },
    };

    console.log("📤 [API /api/simplify/users] Enviando datos a cliente para UID:", finalUid, {
      uid: usuarioConMonedas.uid,
      nombre: usuarioConMonedas.perfil?.name,
      email: usuarioConMonedas.perfil?.email,
      monedas: usuarioConMonedas.monedas,
    });

    ctx.response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Datos de usuario y balance de monedas obtenidos correctamente",
      data: usuarioConMonedas,
      monedas: saldoMonedas,
    };
  } catch (error: any) {
    console.error("❌ Error en getSimplifyUserDataController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener usuario y transacciones simplificadas",
      error: error?.message || "Error interno del servidor",
    };
  }
};

// ============================================================================
// CONTROLADOR SIMPLIFICADO: VERIFICA SI HAY NOTIFICACIONES NO LEÍDAS (TRUE/FALSE)
// ============================================================================
export const getSimplifyNotificacionesNoLeidasController = async (
  ctx: RouterContext<string>,
) => {
  try {
    const url = ctx.request.url;
    const uid = ctx.params?.uid || url.searchParams.get("uid") ||
      url.searchParams.get("idUsuario") || "";

    if (!uid || uid.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message: "El parámetro UID es requerido",
        tieneNoLeidas: false,
        noLeidas: false,
        conteo: 0,
      };
      return;
    }

    const cleanUid = uid.trim();
    const count = await obtenerNotificacionesNoLeidasCountService(cleanUid);
    const tieneNoLeidas = count > 0;

    ctx.response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      tieneNoLeidas,
      noLeidas: tieneNoLeidas,
      conteo: count,
    };
  } catch (error: any) {
    console.error(
      "❌ Error en getSimplifyNotificacionesNoLeidasController:",
      error,
    );
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al consultar notificaciones no leídas",
      tieneNoLeidas: false,
      noLeidas: false,
      conteo: 0,
      error: error?.message || "Error interno del servidor",
    };
  }
};

// ============================================================================
// CONTROLADOR SIMPLIFICADO: NOTIFICACIONES ENRIQUECIDAS CON USERS E HISTORIAINFO
// ============================================================================
export const getSimplifyNotificacionesDetalleController = async (
  ctx: RouterContext<string>,
) => {
  try {
    const url = ctx.request.url;
    const uid = ctx.params?.uid || ctx.params?.id ||
      url.searchParams.get("uid") || url.searchParams.get("idUsuario") || "";

    if (!uid || uid.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message:
          "El parámetro UID es requerido en la URL (/api/simplify/notificaciones/:uid) o como query param (?uid=...)",
        data: [],
      };
      return;
    }

    const cleanUid = uid.trim();

    // 1. Obtener todas las notificaciones del usuario
    const notificacionesRaw = await obtenerNotificacionesPorUsuarioService(
      cleanUid,
    );

    if (!notificacionesRaw || notificacionesRaw.length === 0) {
      ctx.response.headers.set(
        "Cache-Control",
        "no-cache, no-store, must-revalidate",
      );
      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "No hay notificaciones para este usuario",
        data: [],
        count: 0,
        noLeidas: 0,
        tieneNoLeidas: false,
      };
      return;
    }

    // 2. Mapear y enriquecer en paralelo cada notificación con User e HistoriaInfo
    const notificacionesEnriquecidas = await Promise.all(
      notificacionesRaw.map(async (notif: any) => {
        const notifData = notif.data || {};

        // Identificar ID del usuario emisor
        const idEmisor = String(
          notif.uidUsuario ||
            notif.idUsuario ||
            notifData.idUsuario ||
            notifData.uidUsuario ||
            notifData.uidEmisor ||
            notifData.idSeguidor ||
            notifData.uidSeguidor ||
            notifData.idRemitente ||
            notifData.idOyente ||
            "",
        ).trim();

        // Identificar ID de la historia (si aplica)
        const idHistoria = String(
          notif.idHistoria ||
            notif.historiaId ||
            notif.publicacionId ||
            notifData.idHistoria ||
            notifData.historiaId ||
            notifData.publicacionId ||
            notifData.idPublicacion ||
            "",
        ).trim();

        // Ejecutar consultas concurrentes de Usuario e Historia
        const [userDoc, historiaDoc] = await Promise.all([
          // Consulta de usuario emisor
          (async () => {
            if (!idEmisor || idEmisor === cleanUid) return null;
            try {
              const u = (await getUsuarioByUidService(idEmisor)) as any;
              if (!u) return null;
              return {
                uid: u.uid || idEmisor,
                name: u.perfil?.name || u.name || notif.nombreUsuario ||
                  notifData.nombreUsuario || "Usuario",
                displayName: u.perfil?.name || u.name || notif.nombreUsuario ||
                  notifData.nombreUsuario || "Usuario",
                photoURL: u.perfil?.photoURL || u.photoURL ||
                  notif.fotoUsuario || notifData.fotoUsuario ||
                  "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
                foto: u.perfil?.photoURL || u.photoURL || notif.fotoUsuario ||
                  notifData.fotoUsuario ||
                  "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
                descripcion: u.perfil?.descripcion || u.descripcion || "",
                verificado: Boolean(
                  u.perfil?.verificado ?? u.verificado ?? false,
                ),
                marco_perfil_id: u.perfil?.marco_perfil_id ??
                  u.marco_perfil_id ?? null,
                rol: u.perfil?.rol || u.rol || "usuario",
              };
            } catch (err) {
              console.warn(
                `⚠️ Aviso al cargar usuario emisor ${idEmisor} en notificación:`,
                err,
              );
              return null;
            }
          })(),

          // Consulta de historia info
          (async () => {
            if (!idHistoria) return null;
            try {
              const hList = await getHistoriaByIdService(idHistoria);
              if (Array.isArray(hList) && hList.length > 0) {
                const h: any = hList[0];
                return {
                  id: h.id || idHistoria,
                  idDoc: h.idDoc || h.id || idHistoria,
                  titulo: h.titulo || h.nombre || notifData.tituloHistoria ||
                    "",
                  descripcion: h.descripcion || "",
                  imagen: h.imagen || h.portada || h.img || "",
                  generos: h.generos || [],
                  autor: h.autor || "",
                  idAutor: h.idAutor || "",
                  paginas: h.paginas || 0,
                  vistas: h.vistas || 0,
                  likes: h.likes || 0,
                };
              }

              // Fallback directo a Firestore si idHistoria es un docId directo
              const docSnap = await db.collection("HistoriaInfo").doc(
                idHistoria,
              ).get();
              if (docSnap.exists) {
                const hData: any = docSnap.data();
                return {
                  id: hData?.id || docSnap.id,
                  idDoc: docSnap.id,
                  titulo: hData?.titulo || hData?.nombre ||
                    notifData.tituloHistoria || "",
                  descripcion: hData?.descripcion || "",
                  imagen: hData?.imagen || hData?.portada || hData?.img || "",
                  generos: hData?.generos || [],
                  autor: hData?.autor || "",
                  idAutor: hData?.idAutor || "",
                  paginas: hData?.paginas || 0,
                  vistas: hData?.vistas || 0,
                  likes: hData?.likes || 0,
                };
              }

              return null;
            } catch (err) {
              console.warn(
                `⚠️ Aviso al cargar historia ${idHistoria} en notificación:`,
                err,
              );
              return null;
            }
          })(),
        ]);

        const usuarioFinal = userDoc || (notif.nombreUsuario
          ? {
            uid: idEmisor,
            name: notif.nombreUsuario || notifData.nombreUsuario || "Usuario",
            displayName: notif.nombreUsuario || notifData.nombreUsuario ||
              "Usuario",
            photoURL: notif.fotoUsuario || notifData.fotoUsuario ||
              "https://mybuckethomero3.s3.us-east-1.amazonaws.com/homero_asset/DEFAULT.png",
            verificado: false,
            marco_perfil_id: null,
          }
          : null);

        return {
          ...notif,
          id: notif.id || notif.idDoc,
          idDoc: notif.idDoc || notif.id,
          usuario: usuarioFinal,
          user: usuarioFinal,
          usuarioEmisor: usuarioFinal,
          historia: historiaDoc,
          historiaInfo: historiaDoc,
          esDeHistoria: Boolean(historiaDoc),
        };
      }),
    );

    const conteoNoLeidas = notificacionesEnriquecidas.filter((n: any) =>
      !n.leido
    ).length;

    ctx.response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Notificaciones enriquecidas obtenidas correctamente",
      data: notificacionesEnriquecidas,
      count: notificacionesEnriquecidas.length,
      noLeidas: conteoNoLeidas,
      tieneNoLeidas: conteoNoLeidas > 0,
    };
  } catch (error: any) {
    console.error(
      "❌ Error en getSimplifyNotificacionesDetalleController:",
      error,
    );
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener notificaciones enriquecidas",
      error: error?.message || "Error interno del servidor",
      data: [],
    };
  }
};

// ============================================================================
// CONTROLADOR SIMPLIFICADO TAB3: HISTORIAS CARD DEL AUTOR Y COLECCIONES DEL AUTOR
// ============================================================================
export const getSimplifyTab3DataController = async (
  ctx: RouterContext<string>,
) => {
  try {
    const url = ctx.request.url;
    const idAutor = ctx.params?.idAutor ||
      ctx.params?.uid ||
      ctx.params?.id ||
      url.searchParams.get("idAutor") ||
      url.searchParams.get("uid") ||
      url.searchParams.get("id") ||
      "";

    if (!idAutor || idAutor.trim() === "") {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message:
          "El parámetro idAutor (o uid) es requerido en la URL (/api/simplify/tab3/:idAutor) o como query param (?idAutor=...)",
        data: {
          historiasCard: [],
          historias: [],
          colecciones: [],
        },
      };
      return;
    }

    const cleanIdAutor = idAutor.trim();

    // 1. Ejecución concurrente con Promise.all llamando a los servicios de CardHistoria y Colección por autor
    const [historiasCardRaw, coleccionesRaw] = await Promise.all([
      (async () => {
        try {
          return await getHistoriaCardByCustomId2Service(cleanIdAutor);
        } catch (err) {
          console.warn(
            `⚠️ Aviso al cargar historias-card del autor ${cleanIdAutor}:`,
            err,
          );
          return [];
        }
      })(),
      (async () => {
        try {
          return await mostrarColeccionesPorAutorService(cleanIdAutor);
        } catch (err) {
          console.warn(
            `⚠️ Aviso al cargar colecciones del autor ${cleanIdAutor}:`,
            err,
          );
          return [];
        }
      })(),
    ]);

    ctx.response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message:
        "Datos de Tab3 (historias-card y colecciones) obtenidos correctamente",
      data: {
        historiasCard: historiasCardRaw || [],
        historias: historiasCardRaw || [],
        colecciones: coleccionesRaw || [],
      },
      countHistorias: (historiasCardRaw || []).length,
      countColecciones: (coleccionesRaw || []).length,
    };
  } catch (error: any) {
    console.error("❌ Error en getSimplifyTab3DataController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener datos de Tab3",
      error: error?.message || "Error interno del servidor",
      data: {
        historiasCard: [],
        historias: [],
        colecciones: [],
      },
    };
  }
};

// ============================================================================
// CONTROLADOR SIMPLIFICADO VOCES: AZURE, GEMINI Y ELEVENLABS (TODO EN 1)
// ============================================================================
const elevenLabsServiceInstance = new ElevenLabsService();

export const getSimplifyVocesController = (ctx: RouterContext<string>) => {
  try {
    // 1. Voces Azure
    const espanolAzure = (CATALOGO_VOCES_AZURE || []).filter((v: any) =>
      v.codigoIdioma?.startsWith("es-")
    );
    const inglesAzure = (CATALOGO_VOCES_AZURE || []).filter((v: any) =>
      v.codigoIdioma?.startsWith("en-")
    );
    const azureData = {
      success: true,
      total: CATALOGO_VOCES_AZURE.length,
      proveedor: "Microsoft Azure Cognitive Services Speech (Neural)",
      region: Deno.env.get("AZURE_SPEECH_REGION") || "canadacentral",
      idiomas: {
        espanol: {
          total: espanolAzure.length,
          voces: espanolAzure,
        },
        ingles: {
          total: inglesAzure.length,
          voces: inglesAzure,
        },
      },
      todas: CATALOGO_VOCES_AZURE,
      voces: CATALOGO_VOCES_AZURE,
    };

    // 2. Voces Google Gemini
    const geminiData = {
      success: true,
      total: LISTA_VOCES_GEMINI.length,
      proveedor: "Google Gemini API (AI Studio)",
      gratis: true,
      soporteMultilingue:
        "Todas las voces detectan automáticamente el idioma del texto (Español, Inglés, Portugués, Francés, Alemán, Italiano, Japonés, etc.) sin necesidad de configuración adicional.",
      voces: LISTA_VOCES_GEMINI,
    };

    // 3. Voces ElevenLabs
    const elevenVoices = elevenLabsServiceInstance.getVoices();
    const elevenlabsData = {
      success: true,
      ...elevenVoices,
      voces: elevenVoices.all || [],
    };

    ctx.response.headers.set(
      "Cache-Control",
      "public, max-age=3600, stale-while-revalidate=86400",
    );
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message:
        "Catálogo completo de voces de IA (Azure, Gemini y ElevenLabs) obtenido correctamente",
      data: {
        azure: azureData,
        gemini: geminiData,
        elevenlabs: elevenlabsData,
      },
      totales: {
        azure: CATALOGO_VOCES_AZURE.length,
        gemini: LISTA_VOCES_GEMINI.length,
        elevenlabs: elevenVoices.total || 0,
        total: CATALOGO_VOCES_AZURE.length + LISTA_VOCES_GEMINI.length +
          (elevenVoices.total || 0),
      },
    };
  } catch (error: any) {
    console.error("❌ Error en getSimplifyVocesController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener catálogo unificado de voces",
      error: error?.message || "Error interno del servidor",
      data: {
        azure: { total: 0, voces: [] },
        gemini: { total: 0, voces: [] },
        elevenlabs: { total: 0, voces: [] },
      },
    };
  }
};

// ============================================================================
// CONTROLADOR SIMPLIFICADO: CONTEO DE LIKES Y ESTADO ME GUSTA (IS_LIKED)
// ============================================================================
export const getSimplifyLikesStatusController = async (
  ctx: RouterContext<string>,
) => {
  try {
    const url = ctx.request.url;
    const idPublicacion = ctx.params?.idPublicacion ||
      ctx.params?.id ||
      url.searchParams.get("idPublicacion") ||
      url.searchParams.get("idHistoria") ||
      url.searchParams.get("id") ||
      "";

    const uid = url.searchParams.get("uid") ||
      url.searchParams.get("idUsuario") ||
      url.searchParams.get("idUser") ||
      "";

    const cleanIdPublicacion = idPublicacion.trim();
    const cleanUid = uid.trim();

    if (!cleanIdPublicacion) {
      ctx.response.status = 400;
      ctx.response.body = {
        success: false,
        message:
          "El ID de la publicación es requerido en la URL (/api/simplify/likes/:idPublicacion) o como query parameter (?idPublicacion=...)",
        data: null,
      };
      return;
    }

    // 1. Ejecutar en paralelo: obtener total de likes y verificar estado si hay UID
    const [totalLikes, isLiked] = await Promise.all([
      (async () => {
        try {
          return await obtenerTotalLikesService(cleanIdPublicacion);
        } catch (err) {
          console.warn(
            `⚠️ Aviso al obtener total de likes para ${cleanIdPublicacion}:`,
            err,
          );
          return 0;
        }
      })(),
      (async () => {
        if (!cleanUid) return false;
        try {
          return await checkIfLikedService(cleanIdPublicacion, cleanUid);
        } catch (err) {
          console.warn(
            `⚠️ Aviso al verificar like del usuario ${cleanUid} para ${cleanIdPublicacion}:`,
            err,
          );
          return false;
        }
      })(),
    ]);

    ctx.response.headers.set(
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );
    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Estado de likes obtenido correctamente",
      data: {
        idPublicacion: cleanIdPublicacion,
        idHistoria: cleanIdPublicacion,
        totalLikes: totalLikes,
        total: totalLikes,
        likes: totalLikes,
        isLiked: Boolean(isLiked),
        liked: Boolean(isLiked),
        hasLiked: Boolean(isLiked),
        uid: cleanUid || null,
        idUsuario: cleanUid || null,
      },
      totalLikes: totalLikes,
      total: totalLikes,
      isLiked: Boolean(isLiked),
      liked: Boolean(isLiked),
    };
  } catch (error: any) {
    console.error("❌ Error en getSimplifyLikesStatusController:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      success: false,
      message: "Error al obtener estado de likes de la publicación",
      error: error?.message || "Error interno del servidor",
      data: {
        idPublicacion: "",
        totalLikes: 0,
        total: 0,
        isLiked: false,
        liked: false,
      },
    };
  }
};

