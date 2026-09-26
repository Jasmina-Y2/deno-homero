import "jsr:@std/dotenv/load";

async function testEndpoint() {
  try {
    const res = await fetch("http://localhost:8000/api/ia/gemini-voz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        HISTORIA: [
          {
            personaje: "Aoede",
            texto: "(gritando furiosa) ¡No te atrevas a mentirme!",
          },
          {
            personaje: "Puck",
            texto: "(susurrando asustado) Te estoy diciendo la verdad...",
          }
        ]
      })
    });

    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Respuesta /api/ia/gemini-voz:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Error probando endpoint:", err.message);
  }
}

testEndpoint();
