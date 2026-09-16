// Script para actualizar automáticamente los archivos del frontend y eliminar las llamadas de red
const updateUserInfoURL = async () => {
  const filePath = "c:/Users/LENOVO/Documents/CODIGO/NODEJS/Homero_api/src/components/subComponentesUser/UserInfoURL.tsx";
  let content = await Deno.readTextFile(filePath);

  // 1. Reemplazar el bloque de fetchSeguidores, fetchSiguiendo y cargarGastos
  const targetOldCode = `  const fetchSeguidores = async (miUid: string) => {
    try {
      const targetUid = miUid || userInfo?.uid || userInfo?.id;
      if (!targetUid) return;
      const uids = await getSeguidores(targetUid);
      setNumSeguidores(uids.length);
    } catch (error) {
      console.error("Error al cargar seguidores:", error);
    }
  };
  useEffect(() => {
    const targetId = userInfo?.uid || userInfo?.id;
    if (targetId) {
      const fetchHistorias = async () => {
        try {
          const result = await getColeccionesPorAutor(targetId);
          setColeccion(result || []);
        } catch (error) {
          console.error("❌ Error cargando historias del usuario:", error);
        } finally {
          setCargando(false);
        }
      };

      fetchHistorias();
    }
  }, [userInfo?.uid, userInfo?.id]);

  useEffect(() => {
    const miUid = user?.uid || "";
    const perfilId = userInfo?.uid || userInfo?.id;
    if (miUid && perfilId) {
      fetchSiguiendo(miUid, perfilId);
    }
  }, [userInfo?.uid, userInfo?.id, user?.uid]);

  useEffect(() => {
    const targetId = userInfo?.uid || userInfo?.id;
    if (targetId) {
      fetchSeguidores(targetId);

      const cargarGastos = async () => {
        try {
          setCargandoGastos(true);
          const resp = await obtenerHistorialAPI(targetId, { limite: 50 });
          const items = resp.historial || resp.data || [];
          let gastado = 0;
          items.forEach((item: any) => {
            const monto = Number(item.cantidadMonedas || item.monedas || item.monto || item.cantidadOtorgada || 0);
            const tipo = String(item.tipo || "").toLowerCase();
            const tipoMov = String(item.tipoMovimiento || "").toLowerCase();
            if (
              tipoMov === "gasto" ||
              tipoMov === "egreso" ||
              tipo.includes("gasto") ||
              tipo.includes("enviada") ||
              tipo.includes("propina") ||
              tipo.includes("regalo")
            ) {
              gastado += monto;
            }
          });
          const gastadoFinal = Number(resp.resumen?.totalGastado ?? userInfo?.totalGastado ?? userInfo?.totalGastos ?? gastado);
          setTotalGastado(gastadoFinal);
        } catch (error) {
          console.error("❌ Error cargando gastos de usuario en UserInfoURL:", error);
          setTotalGastado(Number(userInfo?.totalGastado ?? userInfo?.totalGastos ?? 0));
        } finally {
          setCargandoGastos(false);
        }
      };
      cargarGastos();
    }
  }, [userInfo?.uid, userInfo?.id]);`;

  const targetNewCode = `  // 1. Cargar colecciones del autor
  useEffect(() => {
    const targetId = userInfo?.uid || userInfo?.id;
    if (targetId) {
      const fetchHistorias = async () => {
        try {
          const result = await getColeccionesPorAutor(targetId);
          setColeccion(result || []);
        } catch (error) {
          console.error("❌ Error cargando historias del usuario:", error);
        } finally {
          setCargando(false);
        }
      };
      fetchHistorias();
    }
  }, [userInfo?.uid, userInfo?.id]);

  // 2. Sincronizar seguidores, estado Seguir y gastos directamente desde userInfo (0 peticiones HTTP)
  useEffect(() => {
    if (userInfo) {
      const listaSeguidores = userInfo.seguidores || [];
      const total = userInfo.totalSeguidores ?? listaSeguidores.length;
      setNumSeguidores(total);

      const miUid = user?.uid || "";
      const yaLoSigo =
        listaSeguidores.includes(miUid) ||
        Boolean(user?.siguiendo?.includes(userInfo.uid || userInfo.id));

      setSiguiendo(yaLoSigo);
      setBtname(yaLoSigo ? "Dejar de Seguir" : "Seguir");
      setTotalGastado(Number(userInfo.totalGastado ?? userInfo.totalGastos ?? 0));
    }
  }, [userInfo, user?.uid, user?.siguiendo]);`;

  if (content.includes("const fetchSeguidores = async (miUid: string)")) {
    content = content.replace(targetOldCode, targetNewCode);
    await Deno.writeTextFile(filePath, content);
    console.log("✅ UserInfoURL.tsx actualizado exitosamente.");
  } else {
    console.log("ℹ️ UserInfoURL.tsx ya estaba actualizado.");
  }
};

const updateTopDonadores = async () => {
  const filePath = "c:/Users/LENOVO/Documents/CODIGO/NODEJS/Homero_api/src/components/subComponentesUser/TopDonadoresCard.tsx";
  let content = await Deno.readTextFile(filePath);

  const oldCall = `        // 1. Obtener historial de transacciones recibidas por el creador
        try {
          const respHistorial = await obtenerHistorialAPI(autorUid, {
            limite: 100,
          });
          const movimientos = respHistorial?.historial || respHistorial?.data || [];`;

  const newCall = `        // 1. Desactivado llamada a historial (0 peticiones HTTP)
        try {
          const movimientos: any[] = [];`;

  if (content.includes("limite: 100")) {
    content = content.replace(oldCall, newCall);
    await Deno.writeTextFile(filePath, content);
    console.log("✅ TopDonadoresCard.tsx actualizado exitosamente.");
  } else {
    console.log("ℹ️ TopDonadoresCard.tsx ya estaba actualizado.");
  }
};

const updateUserInfo = async () => {
  const filePath = "c:/Users/LENOVO/Documents/CODIGO/NODEJS/Homero_api/src/components/subComponentesUser/UserInfo.tsx";
  let content = await Deno.readTextFile(filePath);

  const oldCode = `  const fetchSeguidores = async (miUid: string) => {
    try {
      const targetUid = miUid || userInfo?.uid || userInfo?.id;
      if (!targetUid) return;
      const uids = await getSeguidores(targetUid);
      setNumSeguidores(uids.length);
    } catch (error) {
      console.error("Error al cargar seguidores:", error);
    }
  };
  useEffect(() => {
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
  }, [userInfo?.id, userInfo?.uid]);

  useEffect(() => {
    const miUid = user?.uid || "";
    const perfilId = userInfo?.uid || userInfo?.id;
    if (miUid && perfilId) {
      fetchSiguiendo(miUid, perfilId);
    }
  }, [userInfo?.id, userInfo?.uid, user?.uid]);

  useEffect(() => {
    const perfilId = userInfo?.uid || userInfo?.id;
    if (perfilId) {
      fetchSeguidores(perfilId);
    }
  }, [userInfo?.id, userInfo?.uid]);`;

  const newCode = `  useEffect(() => {
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
  }, [userInfo?.id, userInfo?.uid]);

  useEffect(() => {
    if (userInfo) {
      const listaSeguidores = userInfo.seguidores || [];
      const total = userInfo.totalSeguidores ?? listaSeguidores.length;
      setNumSeguidores(total);

      const miUid = user?.uid || "";
      const yaLoSigo =
        listaSeguidores.includes(miUid) ||
        Boolean(user?.siguiendo?.includes(userInfo.uid || userInfo.id));

      setSiguiendo(yaLoSigo);
      setBtname(yaLoSigo ? t("Comment.unfollow") : t("Comment.follow"));
    }
  }, [userInfo, user?.uid, user?.siguiendo]);`;

  if (content.includes("const fetchSeguidores = async (miUid: string)")) {
    content = content.replace(oldCode, newCode);
    await Deno.writeTextFile(filePath, content);
    console.log("✅ UserInfo.tsx actualizado exitosamente.");
  } else {
    console.log("ℹ️ UserInfo.tsx ya estaba actualizado.");
  }
};

await updateUserInfoURL();
await updateTopDonadores();
await updateUserInfo();
