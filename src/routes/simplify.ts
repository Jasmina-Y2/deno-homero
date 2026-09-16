import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  getSimplifyNotificacionesDetalleController,
  getSimplifyNotificacionesNoLeidasController,
  getSimplifyTab1CardsController,
  getSimplifyTab2DataController,
  getSimplifyUserDataController,
} from "../controllers/simplify.controller.ts";

const router = new Router();

// ============================================================================
// RUTAS SIMPLIFICADAS (TAB1, TAB2, USERS, NOTIFICACIONES - CARGA OPTIMIZADA)
// ============================================================================
router.get("/api/simplify/tab1", getSimplifyTab1CardsController);
router.get("/api/simplify/tab2", getSimplifyTab2DataController);
router.get("/api/simplify/users/:uid", getSimplifyUserDataController);
router.get("/api/simplify/users", getSimplifyUserDataController);

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
  getSimplifyUserDataController,
};
export default router;
