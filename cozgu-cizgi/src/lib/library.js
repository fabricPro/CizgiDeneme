const KEY = "ccd:library";
export function listDesigns() { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
export function saveDesign(item) {
  const all = listDesigns();
  const rec = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: Date.now(), ...item };
  all.unshift(rec); localStorage.setItem(KEY, JSON.stringify(all)); return rec;
}
export function deleteDesign(id) { const all = listDesigns().filter(d => d.id !== id); localStorage.setItem(KEY, JSON.stringify(all)); return all; }
export function renameDesign(id, name) { const all = listDesigns().map(d => d.id === id ? { ...d, name } : d); localStorage.setItem(KEY, JSON.stringify(all)); return all; }
