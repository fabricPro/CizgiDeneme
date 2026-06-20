const KEY = "ccd:library";
const APP_TAG = "cozgu-cizgi";
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function listDesigns() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
export function saveDesign(item) {
  const all = listDesigns();
  const rec = { id: newId(), date: Date.now(), ...item };
  all.unshift(rec); localStorage.setItem(KEY, JSON.stringify(all)); return rec;
}
export function deleteDesign(id) { const all = listDesigns().filter(d => d.id !== id); localStorage.setItem(KEY, JSON.stringify(all)); return all; }
export function renameDesign(id, name) { const all = listDesigns().map(d => d.id === id ? { ...d, name } : d); localStorage.setItem(KEY, JSON.stringify(all)); return all; }

// --- dışa / içe aktarma (JSON dosyası) ---
export function exportDesigns() {
  return JSON.stringify({ app: APP_TAG, type: "library", version: 1, exportedAt: Date.now(), designs: listDesigns() }, null, 2);
}
function isValid(d) {
  return d && Array.isArray(d.segments) && d.segments.length > 0 &&
    d.segments.every(s => s && typeof s.color === "string" && Number.isFinite(Number(s.ends)));
}
export function importDesigns(data, { mode = "merge" } = {}) {
  const arr = Array.isArray(data) ? data : (data && Array.isArray(data.designs) ? data.designs : []);
  const clean = arr.filter(isValid).map(d => ({
    id: newId(),
    date: Number.isFinite(d.date) ? d.date : Date.now(),
    name: (typeof d.name === "string" && d.name.trim()) ? d.name : "İçe aktarılan",
    segments: d.segments.map(s => ({ color: String(s.color), ends: Math.max(0, Math.round(Number(s.ends) || 0)) })),
    ...(Number.isFinite(d.warpDensity) ? { warpDensity: d.warpDensity } : {}),
    ...(Number.isFinite(d.weftDensity) ? { weftDensity: d.weftDensity } : {}),
    ...(Number.isFinite(d.fabricCm) ? { fabricCm: d.fabricCm } : {}),
    mode: d.mode === "check" ? "check" : "single",
    orientation: d.orientation === "v" ? "v" : "h",
  }));
  const base = mode === "replace" ? [] : listDesigns();
  const all = [...clean, ...base]; // içe aktarılanlar başa
  localStorage.setItem(KEY, JSON.stringify(all));
  return { added: clean.length, list: all };
}
