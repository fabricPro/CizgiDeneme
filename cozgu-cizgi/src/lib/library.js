const KEY = "ccd:library";
const APP_TAG = "cozgu-cizgi";
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// paylaşılan meta alanları (densite/en/mod/oryantasyon)
function meta(d) {
  const o = {};
  if (Number.isFinite(d.warpDensity)) o.warpDensity = d.warpDensity;
  if (Number.isFinite(d.weftDensity)) o.weftDensity = d.weftDensity;
  if (Number.isFinite(d.fabricCm)) o.fabricCm = d.fabricCm;
  o.mode = d.mode === "check" ? "check" : "single";
  o.orientation = d.orientation === "v" ? "v" : "h";
  return o;
}

// her kaydı yeni şemaya normalize eder + eski {segments} kaydını göç ettirir; geçersiz → null
function normalize(d) {
  if (!d || typeof d !== "object") return null;
  const base = {
    id: typeof d.id === "string" && d.id ? d.id : newId(),
    date: Number.isFinite(d.date) ? d.date : Date.now(),
    name: (typeof d.name === "string" && d.name.trim()) ? d.name : "Desen",
  };
  // yeni şema: ends + variants
  if (Array.isArray(d.ends) && Array.isArray(d.variants)) {
    const ends = d.ends.map(n => Math.max(0, Math.round(Number(n) || 0)));
    const variants = d.variants
      .filter(v => v && Array.isArray(v.colors) && v.colors.length)
      .map(v => ({
        id: (typeof v.id === "string" && v.id) ? v.id : newId(),
        name: (typeof v.name === "string" && v.name.trim()) ? v.name : "Varyant",
        colors: ends.map((_, i) => String(v.colors[i] ?? v.colors[v.colors.length - 1] ?? "#cccccc")),
      }));
    if (!ends.length || !variants.length) return null;
    const tags = Array.isArray(d.tags) ? ends.map((_, i) => String(d.tags[i] ?? "")) : ends.map(() => "");
    return { ...base, ends, tags, ...meta(d), variants };
  }
  // eski düz şema: segments[{color,ends}] → tek varyantlı desen
  if (Array.isArray(d.segments) && d.segments.length) {
    const segs = d.segments.filter(s => s && typeof s.color === "string" && Number.isFinite(Number(s.ends)));
    if (!segs.length) return null;
    return {
      ...base,
      ends: segs.map(s => Math.max(0, Math.round(Number(s.ends) || 0))),
      tags: segs.map(s => String(s.tag ?? "")),
      ...meta(d),
      variants: [{ id: newId(), name: "Varyant 1", colors: segs.map(s => String(s.color)) }],
    };
  }
  return null;
}

function write(list) { localStorage.setItem(KEY, JSON.stringify(list)); return list; }

export function listDesigns() {
  let raw; try { raw = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  return Array.isArray(raw) ? raw.map(normalize).filter(Boolean) : [];
}

export function saveDesign(design) {
  const rec = normalize({ ...design, id: newId(), date: Date.now() });
  if (!rec) return null;
  const all = listDesigns(); all.unshift(rec); write(all); return rec;
}

export function addVariant(designId, variant) {
  const all = listDesigns();
  const d = all.find(x => x.id === designId);
  if (!d) return all;
  const colors = d.ends.map((_, i) => String(variant.colors?.[i] ?? "#cccccc"));
  d.variants.push({ id: newId(), name: (variant.name && variant.name.trim()) || `Varyant ${d.variants.length + 1}`, colors });
  write(all); return all;
}

export function deleteVariant(designId, variantId) {
  let all = listDesigns();
  const d = all.find(x => x.id === designId);
  if (!d) return all;
  d.variants = d.variants.filter(v => v.id !== variantId);
  if (!d.variants.length) all = all.filter(x => x.id !== designId); // boş desen silinir
  write(all); return all;
}

export function deleteDesign(designId) { const all = listDesigns().filter(d => d.id !== designId); write(all); return all; }
export function renameDesign(designId, name) { const all = listDesigns().map(d => d.id === designId ? { ...d, name } : d); write(all); return all; }
export function renameVariant(designId, variantId, name) {
  const all = listDesigns();
  const d = all.find(x => x.id === designId);
  if (d) { const v = d.variants.find(x => x.id === variantId); if (v) v.name = name; write(all); }
  return all;
}

// --- dışa / içe aktarma (JSON dosyası) ---
export function exportDesigns() {
  return JSON.stringify({ app: APP_TAG, type: "library", version: 2, exportedAt: Date.now(), designs: listDesigns() }, null, 2);
}
export function importDesigns(data, { mode = "merge" } = {}) {
  const arr = Array.isArray(data) ? data : (data && Array.isArray(data.designs) ? data.designs : []);
  const clean = arr.map(normalize).filter(Boolean).map(d => ({
    ...d, id: newId(), variants: d.variants.map(v => ({ ...v, id: newId() })),
  }));
  const base = mode === "replace" ? [] : listDesigns();
  const all = [...clean, ...base]; // içe aktarılanlar başa
  write(all);
  return { added: clean.length, list: all };
}
