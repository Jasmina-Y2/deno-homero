// scripts/update_top_donadores.ts
const frontendPath = "c:/Users/LENOVO/Documents/CODIGO/NODEJS/Homero_api";

async function updateTopDonadoresCard() {
  const filePath = `${frontendPath}/src/components/subComponentesUser/TopDonadoresCard.tsx`;
  let content = await Deno.readTextFile(filePath);

  // 1. Reemplazar imports
  if (!content.includes("getSimplifyUserInfo")) {
    content = content.replace(
      'import {\n  obtenerHistorialAPI,\n  getHistoriaCardByCustomId2,\n  getPerfilUsuario,\n} from "../../API/historiaEditarAPI";',
      'import {\n  getSimplifyUserInfo,\n  getHistoriaCardByCustomId2,\n  getPerfilUsuario,\n} from "../../API/historiaEditarAPI";'
    );
  }

  // 2. Reemplazar calcularTopDonadores para que use getSimplifyUserInfo directamente
  const oldCalcularBlock = `      try {
        const mapaDonadores: { [key: string]: DonadorTop } = {};

        // 1. Obtener historial de transacciones recibidas por el creador
        try {
          const respHistorial = await obtenerHistorialAPI(autorUid, {
            limite: 100,
          });
          const movimientos = respHistorial?.historial || respHistorial?.data || [];`;

  const newCalcularBlock = `      try {
        // 1. Obtener Top Donadores ya calculados y enriquecidos en 1 sola llamada desde /api/simplify/user-info
        try {
          const respUserInfo = await getSimplifyUserInfo(autorUid);
          const topList = respUserInfo?.topDonadores || respUserInfo?.data?.topDonadores;
          if (Array.isArray(topList) && topList.length > 0) {
            if (isMounted) {
              setTopDonadores(topList);
              setCargando(false);
            }
            return;
          }
        } catch (errSimplify) {
          console.warn("⚠️ Aviso al cargar top donadores de simplify:", errSimplify);
        }

        const mapaDonadores: { [key: string]: DonadorTop } = {};

        try {
          const movimientos: any[] = [];`;

  if (content.includes("obtenerHistorialAPI(autorUid")) {
    content = content.replace(oldCalcularBlock, newCalcularBlock);
    await Deno.writeTextFile(filePath, content);
    console.log("✅ TopDonadoresCard.tsx actualizado con éxito para usar getSimplifyUserInfo.");
  } else {
    console.log("ℹ️ TopDonadoresCard.tsx ya no llamaba a obtenerHistorialAPI.");
  }
}

async function updateUserInfo() {
  const filePath = `${frontendPath}/src/components/subComponentesUser/UserInfo.tsx`;
  let content = await Deno.readTextFile(filePath);

  // Asegurar import
  if (!content.includes("getSimplifyUserInfo")) {
    content = content.replace(
      "getSimplifyUserData,",
      "getSimplifyUserData, getSimplifyUserInfo,",
    );
  }

  // Modificar fetch effect
  const oldEffect = `  useEffect(() => {
    const targetId = userInfo?.uid || userInfo?.id;
    if (targetId) {
      const fetchHistorias = async () => {
        try {
          const result = await mostrarColeccionesPorAutor(targetId);
          setColeccion(result || []);
        } catch (error) {
          console.error("❌ Error cargando historias del usuario:", error);
        } finally {
          setCargando(false);
        }
      };

      fetchHistorias();
    }
  }, [userInfo?.id, userInfo?.uid]);`;

  const newEffect = `  // Sincronizar colecciones, historias, seguidores y gastos directamente desde userInfo
  useEffect(() => {
    if (userInfo) {
      if (Array.isArray(userInfo.colecciones)) {
        setColeccion(userInfo.colecciones);
      }
      if (Array.isArray(userInfo.historias) || Array.isArray(userInfo.posts)) {
        const posts = userInfo.historias || userInfo.posts || [];
        setHistorias(posts);
        setNumPost(posts.length);
      }
      setCargando(false);
    }
  }, [userInfo]);`;

  if (content.includes("mostrarColeccionesPorAutor(targetId)")) {
    content = content.replace(oldEffect, newEffect);
    await Deno.writeTextFile(filePath, content);
    console.log("✅ UserInfo.tsx sincronizado.");
  }
}

await updateTopDonadoresCard();
await updateUserInfo();
