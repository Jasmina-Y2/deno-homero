// scripts/update_simplify_userinfo.ts
import { join } from "https://deno.land/std/path/mod.ts";

const frontendPath = "c:/Users/LENOVO/Documents/CODIGO/NODEJS/Homero_api";

// 1. Actualizar historiaEditarAPI.ts para incluir getSimplifyUserInfo
async function updateHistoriaEditarAPI() {
  const filePath = `${frontendPath}/src/API/historiaEditarAPI.ts`;
  let content = await Deno.readTextFile(filePath);

  if (!content.includes("getSimplifyUserInfo")) {
    const targetAfter = "const getSimplifyUserData = async (uid: string, forceRefresh = false) => {";
    const newHelper = `const simplifyUserInfoCache = new Map<
    string,
    { timestamp: number; data: any }
>();
const pendingSimplifyUserInfoRequests = new Map<string, Promise<any>>();
const SIMPLIFY_USER_INFO_CACHE_TTL = 3000;

const getSimplifyUserInfo = async (uid: string, forceRefresh = false) => {
    try {
        if (!uid) return null;

        const now = Date.now();
        const cached = simplifyUserInfoCache.get(uid);

        if (
            !forceRefresh && cached &&
            (now - cached.timestamp < SIMPLIFY_USER_INFO_CACHE_TTL)
        ) {
            return cached.data;
        }

        if (pendingSimplifyUserInfoRequests.has(uid)) {
            return await pendingSimplifyUserInfoRequests.get(uid);
        }

        const requestPromise = (async () => {
            try {
                const response = await fetch(
                    \`\${API_URL}/api/simplify/user-info/\${encodeURIComponent(uid)}\`,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    },
                );
                const result = await response.json();
                if (!response.ok || !result.success) {
                    if (cached) return cached.data;
                    return null;
                }

                const data = result.data || result;
                simplifyUserInfoCache.set(uid, {
                    timestamp: Date.now(),
                    data: data,
                });
                return data;
            } catch (fetchErr) {
                console.warn("Aviso en getSimplifyUserInfo fetch:", fetchErr);
                if (cached) return cached.data;
                return null;
            } finally {
                pendingSimplifyUserInfoRequests.delete(uid);
            }
        })();

        pendingSimplifyUserInfoRequests.set(uid, requestPromise);
        return await requestPromise;
    } catch (error) {
        console.error("❌ Error en getSimplifyUserInfo:", error);
        return null;
    }
};

`;

    content = content.replace(targetAfter, newHelper + targetAfter);

    // Also add to exports
    if (content.includes("getSimplifyUserData,")) {
      content = content.replace(
        "getSimplifyUserData,",
        "getSimplifyUserData,\n    getSimplifyUserInfo,\n    getSimplifyUserInfo as getSimplifyUserInfoData,",
      );
    }

    await Deno.writeTextFile(filePath, content);
    console.log("✅ historiaEditarAPI.ts actualizado con getSimplifyUserInfo.");
  } else {
    console.log("ℹ️ historiaEditarAPI.ts ya contiene getSimplifyUserInfo.");
  }
}

// 2. Actualizar UserInfoURL.tsx para usar getSimplifyUserInfo y llenar todo en un solo fetch
async function updateUserInfoURL() {
  const filePath = `${frontendPath}/src/components/subComponentesUser/UserInfoURL.tsx`;
  let content = await Deno.readTextFile(filePath);

  // Asegurar import
  if (!content.includes("getSimplifyUserInfo")) {
    content = content.replace(
      "getSimplifyUserData",
      "getSimplifyUserData, getSimplifyUserInfo",
    );
  }

  // Modificar useEffect principal de carga de datos de usuario
  const oldFetchEffect = `  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    setCargandoUser(true);

    getSimplifyUserData(id)
      .then((data: any) => {
        if (!isMounted) return;
        if (data) {
          const sanitized = sanitizeUserData({ ...data, uid: id });
          setUserInfo(sanitized);
          if (data.totalSeguidores !== undefined || data.conteoSeguidores !== undefined || Array.isArray(data.seguidores)) {
            setNumSeguidores(Number(data.totalSeguidores ?? data.conteoSeguidores ?? data.seguidores?.length ?? 0));
          }
        } else {
          getUsuarioByUid(id).then((result) => {
            if (isMounted) setUserInfo(result || null);
          });
        }
      })
      .catch((error) => {
        console.warn("⚠️ [UserInfoURL] Error cargando usuario:", error);
        if (isMounted) {
          getUsuarioByUid(id).then((result) => {
            if (isMounted) setUserInfo(result || null);
          });
        }
      })
      .finally(() => {
        if (isMounted) setCargandoUser(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);`;

  const newFetchEffect = `  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    setCargandoUser(true);
    setCargando(true);

    // Carga unificada en 1 sola llamada de red con /api/simplify/user-info
    getSimplifyUserInfo(id)
      .then((data: any) => {
        if (!isMounted) return;
        if (data) {
          const rawUser = data.user || data;
          const sanitized = sanitizeUserData({ ...rawUser, uid: id });
          setUserInfo(sanitized);

          // Colecciones del autor
          if (Array.isArray(data.colecciones)) {
            setColeccion(data.colecciones);
          }

          // Historias / Posts del autor
          const listaPosts = data.historias || data.posts || [];
          if (Array.isArray(listaPosts)) {
            setHistorias(listaPosts);
            setNumPost(listaPosts.length);
          }

          // Seguidores y gastos
          const totalSeg = Number(data.totalSeguidores ?? data.conteoSeguidores ?? data.seguidores?.length ?? rawUser.totalSeguidores ?? 0);
          setNumSeguidores(totalSeg);

          const totalGast = Number(data.totalGastado ?? data.totalGastos ?? rawUser.totalGastado ?? rawUser.totalGastos ?? 0);
          setTotalGastado(totalGast);
        } else {
          getSimplifyUserData(id).then((result) => {
            if (isMounted && result) setUserInfo(sanitizeUserData({ ...result, uid: id }));
          });
        }
      })
      .catch((error) => {
        console.warn("⚠️ [UserInfoURL] Error cargando user-info simplificado:", error);
        if (isMounted) {
          getSimplifyUserData(id).then((result) => {
            if (isMounted && result) setUserInfo(sanitizeUserData({ ...result, uid: id }));
          });
        }
      })
      .finally(() => {
        if (isMounted) {
          setCargandoUser(false);
          setCargando(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);`;

  if (content.includes("getSimplifyUserData(id)")) {
    content = content.replace(oldFetchEffect, newFetchEffect);
    await Deno.writeTextFile(filePath, content);
    console.log("✅ UserInfoURL.tsx actualizado con getSimplifyUserInfo.");
  }
}

// 3. Actualizar UserInfo.tsx para usar getSimplifyUserInfo
async function updateUserInfo() {
  const filePath = `${frontendPath}/src/components/subComponentesUser/UserInfo.tsx`;
  let content = await Deno.readTextFile(filePath);

  if (!content.includes("getSimplifyUserInfo")) {
    content = content.replace(
      "getSimplifyUserData",
      "getSimplifyUserData, getSimplifyUserInfo",
    );
  }

  const oldFetchEffect = `  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    setCargandoUser(true);

    getSimplifyUserData(id)
      .then((data: any) => {
        if (!isMounted) return;
        if (data) {
          const sanitized = sanitizeUserData({ ...data, uid: id });
          setUserInfo(sanitized);
          if (data.totalSeguidores !== undefined || data.conteoSeguidores !== undefined || Array.isArray(data.seguidores)) {
            setNumSeguidores(Number(data.totalSeguidores ?? data.conteoSeguidores ?? data.seguidores?.length ?? 0));
          }
        } else {
          getUsuarioByUid(id).then((result) => {
            if (isMounted) setUserInfo(result || null);
          });
        }
      })
      .catch((error) => {
        console.warn("⚠️ [UserInfo] Error cargando usuario:", error);
        if (isMounted) {
          getUsuarioByUid(id).then((result) => {
            if (isMounted) setUserInfo(result || null);
          });
        }
      })
      .finally(() => {
        if (isMounted) setCargandoUser(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);`;

  const newFetchEffect = `  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    setCargandoUser(true);
    setCargando(true);

    // Carga unificada en 1 sola llamada de red con /api/simplify/user-info
    getSimplifyUserInfo(id)
      .then((data: any) => {
        if (!isMounted) return;
        if (data) {
          const rawUser = data.user || data;
          const sanitized = sanitizeUserData({ ...rawUser, uid: id });
          setUserInfo(sanitized);

          // Colecciones del autor
          if (Array.isArray(data.colecciones)) {
            setColeccion(data.colecciones);
          }

          // Historias / Posts del autor
          const listaPosts = data.historias || data.posts || [];
          if (Array.isArray(listaPosts)) {
            setHistorias(listaPosts);
            setNumPost(listaPosts.length);
          }

          // Seguidores y gastos
          const totalSeg = Number(data.totalSeguidores ?? data.conteoSeguidores ?? data.seguidores?.length ?? rawUser.totalSeguidores ?? 0);
          setNumSeguidores(totalSeg);

          const totalGast = Number(data.totalGastado ?? data.totalGastos ?? rawUser.totalGastado ?? rawUser.totalGastos ?? 0);
          setTotalGastado(totalGast);
        } else {
          getSimplifyUserData(id).then((result) => {
            if (isMounted && result) setUserInfo(sanitizeUserData({ ...result, uid: id }));
          });
        }
      })
      .catch((error) => {
        console.warn("⚠️ [UserInfo] Error cargando user-info simplificado:", error);
        if (isMounted) {
          getSimplifyUserData(id).then((result) => {
            if (isMounted && result) setUserInfo(sanitizeUserData({ ...result, uid: id }));
          });
        }
      })
      .finally(() => {
        if (isMounted) {
          setCargandoUser(false);
          setCargando(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);`;

  if (content.includes("getSimplifyUserData(id)")) {
    content = content.replace(oldFetchEffect, newFetchEffect);
    await Deno.writeTextFile(filePath, content);
    console.log("✅ UserInfo.tsx actualizado con getSimplifyUserInfo.");
  }
}

// 4. Actualizar TopDonadoresCard.tsx para usar getSimplifyUserInfo(autorUid) directamente
async function updateTopDonadoresCard() {
  const filePath = `${frontendPath}/src/components/subComponentesUser/TopDonadoresCard.tsx`;
  let content = await Deno.readTextFile(filePath);

  if (!content.includes("getSimplifyUserInfo")) {
    content = content.replace(
      "obtenerHistorialAPI,",
      "obtenerHistorialAPI, getSimplifyUserInfo,",
    );
  }

  // Modificar calcularTopDonadores para que cargue directamente de getSimplifyUserInfo
  const oldCalcular = `      try {
        const mapaDonadores: { [key: string]: DonadorTop } = {};

        // 1. Desactivado llamada a historial (0 peticiones HTTP)
        try {
          const movimientos: any[] = [];`;

  const newCalcular = `      try {
        // Cargar Top Donadores listos y enriquecidos directamente del endpoint unificado simplify/user-info
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
          console.warn("Aviso cargando top donadores de simplify:", errSimplify);
        }

        const mapaDonadores: { [key: string]: DonadorTop } = {};

        // 1. Desactivado llamada a historial (0 peticiones HTTP)
        try {
          const movimientos: any[] = [];`;

  if (content.includes("Desactivado llamada a historial") && !content.includes("respUserInfo = await getSimplifyUserInfo(autorUid)")) {
    content = content.replace(oldCalcular, newCalcular);
    await Deno.writeTextFile(filePath, content);
    console.log("✅ TopDonadoresCard.tsx actualizado con getSimplifyUserInfo.");
  }
}

await updateHistoriaEditarAPI();
await updateUserInfoURL();
await updateUserInfo();
await updateTopDonadoresCard();
console.log("🚀 Todos los archivos de frontend actualizados exitosamente.");
