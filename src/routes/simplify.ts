import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  getSimplifyLikesStatusController,
  getSimplifyNotificacionesDetalleController,
  getSimplifyNotificacionesNoLeidasController,
  getSimplifyTab1CardsController,
  getSimplifyTab2DataController,
  getSimplifyTab3DataController,
  getSimplifyUserDataController,
  getSimplifyVocesController,
} from "../controllers/simplify.controller.ts";

const router = new Router();

// ============================================================================
// RUTAS SIMPLIFICADAS (TAB1, TAB2, TAB3, USERS, VOCES, NOTIFICACIONES, LIKES)
// ============================================================================
router.get("/api/simplify/tab1", getSimplifyTab1CardsController);
router.get("/api/simplify/tab2", getSimplifyTab2DataController);
router.get("/api/simplify/tab3", getSimplifyTab3DataController);
router.get("/api/simplify/users/:uid", getSimplifyUserDataController);
router.get("/api/simplify/users", getSimplifyUserDataController);

// Catálogo unificado de todas las voces IA (Azure, Gemini, ElevenLabs)
router.get("/api/simplify/voces", getSimplifyVocesController);

// Conteo de likes y estado Me Gusta (isLiked) unificado
router.get(
  "/api/simplify/likes/:idPublicacion",
  getSimplifyLikesStatusController,
);

router.get(
  "/api/simplify/notificaciones/no-leidas",
  getSimplifyNotificacionesNoLeidasController,
);
router.get(
  "/api/simplify/notificaciones",
  getSimplifyNotificacionesDetalleController,
);

export {
  getSimplifyLikesStatusController,
  getSimplifyNotificacionesDetalleController,
  getSimplifyNotificacionesNoLeidasController,
  getSimplifyTab1CardsController,
  getSimplifyTab2DataController,
  getSimplifyTab3DataController,
  getSimplifyUserDataController,
  getSimplifyVocesController,
};
export default router;
