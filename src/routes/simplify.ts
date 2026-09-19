import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  getSimplifyBilleteraController,
  getSimplifyColeccionDetalleController,
  getSimplifyHistoriaDetalleController,
  getSimplifyLikesStatusController,
  getSimplifyNotificacionesDetalleController,
  getSimplifyNotificacionesNoLeidasController,
  getSimplifyTab1CardsController,
  getSimplifyTab2DataController,
  getSimplifyTab3DataController,
  getSimplifyUserDataController,
  getSimplifyUserInfoController,
  getSimplifyVocesController,
} from "../controllers/simplify.controller.ts";
import { authOpcional } from "../middlewares/auth.middleware.ts";

const router = new Router();

// ============================================================================
// RUTAS SIMPLIFICADAS (TAB1, TAB2, TAB3, USERS, USER-INFO, COLECCION, BILLETERA, VOCES, NOTIFICACIONES, LIKES, HISTORIA)
// ============================================================================
router.get("/api/simplify/tab1", getSimplifyTab1CardsController);
router.get("/api/simplify/tab2", getSimplifyTab2DataController);
router.get("/api/simplify/tab3", getSimplifyTab3DataController);
router.get("/api/simplify/users/:uid", getSimplifyUserDataController);
router.get("/api/simplify/users", getSimplifyUserDataController);

// Ruta unificada para pantalla de perfil de usuario (User + Historial + Colecciones + Posts + Seguidores + Top Donadores)
router.get("/api/simplify/user-info/:uid", getSimplifyUserInfoController);
router.get("/api/simplify/user-info", getSimplifyUserInfoController);
router.get("/api/simplify/userinfo/:uid", getSimplifyUserInfoController);
router.get("/api/simplify/userinfo", getSimplifyUserInfoController);

// Ruta unificada para Colección completa (Detalles + Autor + Episodios/Historias + Calificación/Voto)
router.get(
  "/api/simplify/coleccion/:idColeccion/:idUsuario",
  authOpcional,
  getSimplifyColeccionDetalleController,
);
router.get(
  "/api/simplify/coleccion/:idColeccion",
  authOpcional,
  getSimplifyColeccionDetalleController,
);
router.get(
  "/api/simplify/coleccion",
  authOpcional,
  getSimplifyColeccionDetalleController,
);
router.get(
  "/api/simplify/colecciones/:idColeccion/:idUsuario",
  authOpcional,
  getSimplifyColeccionDetalleController,
);
router.get(
  "/api/simplify/colecciones/:idColeccion",
  authOpcional,
  getSimplifyColeccionDetalleController,
);
router.get(
  "/api/simplify/colecciones",
  authOpcional,
  getSimplifyColeccionDetalleController,
);

// Ruta unificada para Billetera (Pagos/Retiros + Compras de App + Límites de Anuncios por Dispositivo)
router.get("/api/simplify/billetera/:uid", getSimplifyBilleteraController);
router.get("/api/simplify/billetera", getSimplifyBilleteraController);

// Catálogo unificado de todas las voces IA (Azure, Gemini, ElevenLabs)
router.get("/api/simplify/voces", getSimplifyVocesController);

// Conteo de likes y estado Me Gusta (isLiked) unificado
router.get(
  "/api/simplify/likes/:idPublicacion",
  authOpcional,
  getSimplifyLikesStatusController,
);

// Ruta unificada para Historia Completa (Contenido + Total Likes + Estado Liked de Usuario)
router.get("/api/simplify/historia/:id", authOpcional, getSimplifyHistoriaDetalleController);
router.get("/api/simplify/historia", authOpcional, getSimplifyHistoriaDetalleController);

router.get(
  "/api/simplify/notificaciones/no-leidas",
  getSimplifyNotificacionesNoLeidasController,
);
router.get(
  "/api/simplify/notificaciones",
  getSimplifyNotificacionesDetalleController,
);

export {
  getSimplifyBilleteraController,
  getSimplifyColeccionDetalleController,
  getSimplifyHistoriaDetalleController,
  getSimplifyLikesStatusController,
  getSimplifyNotificacionesDetalleController,
  getSimplifyNotificacionesNoLeidasController,
  getSimplifyTab1CardsController,
  getSimplifyTab2DataController,
  getSimplifyTab3DataController,
  getSimplifyUserDataController,
  getSimplifyUserInfoController,
  getSimplifyVocesController,
};
export default router;

