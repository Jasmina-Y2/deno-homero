// src/routes/index.ts
import { Router } from "https://deno.land/x/oak/mod.ts";
import { getHistorias, createHistoria } from "../controllers/historia.controller.ts";

const router = new Router();
router.get("/api/historias", getHistorias);
router.post("/api/historias", createHistoria);

export default router;