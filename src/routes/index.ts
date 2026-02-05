// src/routes/index.ts
import { Router } from "https://deno.land/x/oak/mod.ts";
import { getHistorias, createHistoria } from "../controllers/historia.controller.ts";
import { traducirTexto } from "../controllers/traductor.controller.ts";

const router = new Router();
router.get("/api/historias", getHistorias);
router.post("/api/historias", createHistoria);
router.post("/api/traductor", traducirTexto);

export default router;