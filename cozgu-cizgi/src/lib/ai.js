// Sağlayıcı-bağımsız tek fonksiyon: prompt ver, düz metin (model çıktısı) al.
// Anahtar yalnızca çağıran tarafından (localStorage) verilir; burada saklanmaz.
export async function generateText(prompt, { provider, apiKey, model } = {}) {
  if (!apiKey) throw new Error("API anahtarı yok (Ayarlar'dan gir)");

  if (provider === "gemini") {
    const m = model || "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1200, temperature: 0.9 },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || "HTTP " + res.status);
    return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  }

  // Anthropic (Claude) — tarayıcıdan doğrudan çağrı için özel header gerekir.
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: model || "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok || data.type === "error") throw new Error(data?.error?.message || "HTTP " + res.status);
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}
