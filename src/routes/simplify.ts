import { Router } from "https://deno.land/x/oak/mod.ts";
import {
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
// RUTAS SIMPLIFICADAS (TAB1, TAB2, TAB3, USERS, VOCES, NOTIFICACIONES)
// ============================================================================
router.get("/api/simplify/tab1", getSimplifyTab1CardsController);
router.get("/api/simplify/tab2", getSimplifyTab2DataController);
router.get("/api/simplify/tab3", getSimplifyTab3DataController);
router.get("/api/simplify/users", getSimplifyUserDataController);

// Catálogo unificado de todas las voces IA (Azure, Gemini, ElevenLabs)
router.get("/api/simplify/voces", getSimplifyVocesController);

router.get(
  "/api/simplify/notificaciones/no-leidas",
  getSimplifyNotificacionesNoLeidasController,
);
router.get(
  "/api/simplify/notificaciones",
  getSimplifyNotificacionesDetalleController,
);

export {
  getSimplifyNotificacionesDetalleController,
  getSimplifyNotificacionesNoLeidasController,
  getSimplifyTab1CardsController,
  getSimplifyTab2DataController,
  getSimplifyTab3DataController,
  getSimplifyUserDataController,
  getSimplifyVocesController,
};
export default router;
