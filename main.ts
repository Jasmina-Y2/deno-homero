import { Application } from "https://deno.land/x/oak/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import router from "./src/routes/index.ts";
import "./src/config/firebase.ts";
import awsRoutes from "./src/routes/aws.ts";
import elevenLabsRoutes from "./src/routes/elevenlabs.ts";

const app = new Application();
const PORT = 8000;

app.use(oakCors({
  origin: "*",
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "x-api-key",
    "Cache-Control",
    "cache-control",
    "Pragma",
    "Expires",
    "X-Requested-With",
    "Origin",
    "Range",
    "*",
  ],
  exposedHeaders: ["Content-Length", "Content-Range", "X-Response-Time"],
}));


app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(
    `${ctx.request.method} ${ctx.request.url} - ${ctx.response.status}`,
  );
});

// Rutas
app.use(router.routes());
app.use(router.allowedMethods());

app.use(awsRoutes.routes());
app.use(awsRoutes.allowedMethods());

app.use(elevenLabsRoutes.routes());
app.use(elevenLabsRoutes.allowedMethods());

console.log(`🦕 Servidor Deno escuchando en puerto ${PORT}`);
await app.listen({ port: PORT });
