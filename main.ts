import { Application } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import router from "./src/routes/index.ts";
import "./src/config/firebase.ts";
import awsRoutes from "./src/routes/aws.ts";

const app = new Application();
const PORT = 8000;

app.use(oakCors());


app.use(router.routes());
app.use(router.allowedMethods());

app.use(awsRoutes.routes());
app.use(awsRoutes.allowedMethods());


console.log(`🦕 Servidor Deno escuchando en http://localhost:${PORT}`);
await app.listen({ port: PORT });