import { Router } from "https://deno.land/x/oak/mod.ts";
import type { RouterContext } from "https://deno.land/x/oak/mod.ts";
import {
    crearHistoriaController,
} from "../controllers/historia.controller.ts";
import { crearHistoriaInfoController } from "../controllers/historiainfo.controller.ts"
import { crearCardHistoriaController, obtenerCardHistoriaController } from "../controllers/cardhistoria.controller.ts";
import {
    crearColeccionController,
    mostrarColeccionesPorAutorController
} from "../controllers/coleccion.controller.ts"

import {
    agregarHistoriaAColeccionController
} from "../controllers/Coleccionids.controller.ts"

import {
    traducirTexto
} from "../controllers/traductor.controller.ts"

const router = new Router();

router.get("/api/card-historias/mostrar", obtenerCardHistoriaController);

router.post("/api/colecciones/crear", crearColeccionController);
router.post("/api/coleccion-ids/crear", agregarHistoriaAColeccionController);
router.get("/api/colecciones/mostrar", mostrarColeccionesPorAutorController);

router.post("/api/historias/crear", crearHistoriaController);
router.post("/api/card-historias/crear", crearCardHistoriaController);
router.post("/api/historias-info/crear", crearHistoriaInfoController);

router.post("/api/traductor", traducirTexto);

export default router;


