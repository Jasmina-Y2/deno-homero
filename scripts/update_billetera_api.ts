// scripts/update_billetera_api.ts
const frontendPath = "c:/Users/LENOVO/Documents/CODIGO/NODEJS/Homero_api";

async function updateHistoriaEditarAPI() {
  const filePath = `${frontendPath}/src/API/historiaEditarAPI.ts`;
  let content = await Deno.readTextFile(filePath);

  if (!content.includes("getSimplifyBilleteraData")) {
    const targetAfter = "const getSimplifyUserInfo = async (uid: string, forceRefresh = false) => {";
    const newHelper = `const simplifyBilleteraCache = new Map<
    string,
    { timestamp: number; data: any }
>();
const pendingSimplifyBilleteraRequests = new Map<string, Promise<any>>();
const SIMPLIFY_BILLETERA_CACHE_TTL = 3000;

export const getSimplifyBilleteraData = async (
    uid: string,
    deviceId?: string,
    forceRefresh = false,
) => {
    try {
        if (!uid) return null;

        const cacheKey = \`\${uid}_\${deviceId || ""}\`;
        const now = Date.now();
        const cached = simplifyBilleteraCache.get(cacheKey);

        if (
            !forceRefresh && cached &&
            (now - cached.timestamp < SIMPLIFY_BILLETERA_CACHE_TTL)
        ) {
            return cached.data;
        }

        if (pendingSimplifyBilleteraRequests.has(cacheKey)) {
            return await pendingSimplifyBilleteraRequests.get(cacheKey);
        }

        const requestPromise = (async () => {
            try {
                const deviceQuery = deviceId ? \`&deviceId=\${encodeURIComponent(deviceId)}\` : "";
                const response = await fetch(
                    \`\${API_URL}/api/simplify/billetera/\${encodeURIComponent(uid)}?\${deviceQuery}\`,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    },
                );
                const result = await response.json();
                if (!response.ok || (!result.success && result.success !== undefined)) {
                    console.warn("⚠️ Error en respuesta de simplify/billetera:", result?.message);
                    if (cached) return cached.data;
                    return null;
                }

                const data = result.data || result;
                simplifyBilleteraCache.set(cacheKey, {
                    timestamp: Date.now(),
                    data: data,
                });
                return data;
            } catch (fetchErr) {
                console.error("❌ Error al llamar a /api/simplify/billetera:", fetchErr);
                if (cached) return cached.data;
                return null;
            } finally {
                pendingSimplifyBilleteraRequests.delete(cacheKey);
            }
        })();

        pendingSimplifyBilleteraRequests.set(cacheKey, requestPromise);
        return await requestPromise;
    } catch (error) {
        console.error("❌ Error en getSimplifyBilleteraData:", error);
        return null;
    }
};

`;

    content = content.replace(targetAfter, newHelper + targetAfter);

    if (content.includes("getSimplifyUserInfo,")) {
      content = content.replace(
        "getSimplifyUserInfo,",
        "getSimplifyUserInfo,\n    getSimplifyBilleteraData,",
      );
    }

    await Deno.writeTextFile(filePath, content);
    console.log("✅ historiaEditarAPI.ts actualizado con getSimplifyBilleteraData.");
  } else {
    console.log("ℹ️ historiaEditarAPI.ts ya contenía getSimplifyBilleteraData.");
  }
}

await updateHistoriaEditarAPI();
