import { Router } from "https://deno.land/x/oak/mod.ts";
import {
  getSimplifyTab1CardsController,
  getSimplifyTab2DataController,
} from "../controllers/simplify.controller.ts";

const router = new Router();

// ============================================================================
// RUTAS SIMPLIFICADAS (HTMLTAB1 Y HTMLTAB2 - CARGA OPTIMIZADA CON PROMISE.ALL)
// ============================================================================
router.get("/api/simplify/tab1", getSimplifyTab1CardsController);
router.get("/api/simplify/tab2", getSimplifyTab2DataController);

export { getSimplifyTab1CardsController, getSimplifyTab2DataController };
export default router;
