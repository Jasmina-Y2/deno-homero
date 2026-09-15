import { Router } from "https://deno.land/x/oak/mod.ts";
import { getSimplifyTab1CardsController } from "../controllers/simplify.controller.ts";

const router = new Router();

// ============================================================================
// RUTAS SIMPLIFICADAS (HTMLTAB1 - CARGA OPTIMIZADA CON PROMISE.ALL)
// ============================================================================
router.get("/api/simplify/tab1", getSimplifyTab1CardsController);

export { getSimplifyTab1CardsController };
export default router;
