import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  getSimplifyTab1CardsController,
  getSimplifyTab2DataController,
  getSimplifyUserDataController,
} from "../controllers/simplify.controller.ts";

const router = new Router();

// ============================================================================
// RUTAS SIMPLIFICADAS (HTMLTAB1, HTMLTAB2, USERS - CARGA OPTIMIZADA CON PROMISE.ALL)
// ============================================================================
router.get("/api/simplify/tab1", getSimplifyTab1CardsController);
router.get("/api/simplify/tab2", getSimplifyTab2DataController);
router.get("/api/simplify/users/:uid", getSimplifyUserDataController);
router.get("/api/simplify/users", getSimplifyUserDataController);

export {
  getSimplifyTab1CardsController,
  getSimplifyTab2DataController,
  getSimplifyUserDataController,
};
export default router;
