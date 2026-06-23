import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Plus, Trash2, Copy, ArrowUp, ArrowDown, Download, Check, RotateCcw, ZoomIn, ZoomOut, Maximize, Ruler, Sparkles, Loader2, ArrowRight, Settings, X, Eye, EyeOff, Save, FolderOpen, Upload, Pencil, FilePlus, Layers, ChevronDown, ChevronRight, Search, FlipHorizontal2, FlipVertical2, Maximize2 } from "lucide-react";
import { storage } from "../lib/storage";
import { generateText } from "../lib/ai";
import { listDesigns, saveDesign, addVariant, updateVariant, deleteVariant, deleteDesign, renameDesign, renameVariant, exportDesigns, importDesigns } from "../lib/library";

// DOM (inline style) renkleri — CSS değişkenleri (tema ile değişir)
const GOLD = "var(--gold)";
const TEAL = "var(--teal)";
const NAVY = "var(--bg)";
const PANEL = "var(--panel)";
const SUNK = "var(--sunk)";
const LINE = "var(--line)";
const TEXT = "var(--text)";
const MUTE = "var(--mute)";
const RED = "var(--red)";

// Canvas için gerçek hex/rgba (canvas CSS değişkeni okuyamaz) — tema token'ları
const CANVAS = {
  dark:  { bg: "#0D1B2A", ruler: "rgba(11,23,38,0.78)", tick: "rgba(232,238,245,0.8)", tickLine: "rgba(232,238,245,0.55)", dash: "rgba(255,255,255,0.45)" },
  light: { bg: "#FFFFFF", ruler: "rgba(240,236,226,0.92)", tick: "rgba(60,66,72,0.85)", tickLine: "rgba(60,66,72,0.5)", dash: "rgba(0,0,0,0.4)" },
};

const RULER_CM = 10; // kalibrasyon referansı: ekrandaki cetvel uzunluğu (cm)

const WARP_START = [
  { id: 1, color: "#EFE6D3", ends: 40 },
  { id: 2, color: "#1F2A40", ends: 10 },
  { id: 3, color: "#EFE6D3", ends: 6 },
  { id: 4, color: "#C9A24B", ends: 6 },
  { id: 5, color: "#EFE6D3", ends: 30 },
  { id: 6, color: "#1F2A40", ends: 4 },
];
const WEFT_START = [
  { id: 11, color: "#EFE6D3", ends: 36 },
  { id: 12, color: "#1F2A40", ends: 6 },
  { id: 13, color: "#EFE6D3", ends: 20 },
  { id: 14, color: "#C9A24B", ends: 6 },
];

let nextId = 100;
const clone = (a) => a.map((x) => ({ ...x }));
const trimNum = (v, d) => parseFloat(Number(v).toFixed(d)).toString();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ls = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };

export default function CozguCizgiDenemesi() {
  const [mode, setMode] = useState("single");
  const [orientation, setOrientation] = useState("v");
  const [warp, setWarp] = useState([]);
  const [weft, setWeft] = useState([]);
  const [warpDensity, setWarpDensity] = useState(24);
  const [weftDensity, setWeftDensity] = useState(22);
  const [fabricCm, setFabricCm] = useState(50);
  const [editTab, setEditTab] = useState("warp");
  const [selectedId, setSelectedId] = useState(null);
  const [checkedIds, setCheckedIds] = useState(() => new Set()); // toplu renk için çoklu seçim
  const [palette, setPalette] = useState(["#F4F1E8", "#EFE6D3", "#E5D9C3", "#DEC9A6", "#CFC3AE", "#BCAF99", "#A8967C", "#D6D8DA", "#C2C6C9", "#A6AAAD", "#7C8388", "#3C4248", "#1A1C1E", "#C9A24B", "#1F2A40", "#6E2230", "#1E5A62", "#8FA08A"]);
  const [copied, setCopied] = useState(false);
  const [savedList, setSavedList] = useState(() => listDesigns()); // mount'ta localStorage'dan yükle (tema/ai state'leriyle aynı desen)
  const [libMsg, setLibMsg] = useState("");
  const [activeDesignId, setActiveDesignId] = useState(null); // editörde yüklü/oluşturulmuş kayıtlı desen
  const [activeVariantId, setActiveVariantId] = useState(null); // üzerine kaydetmek için yüklü varyant
  const [view, setView] = useState("editor"); // "editor" | "library" (üst sekme)
  const [libraryOpen, setLibraryOpen] = useState(false); // editörde sağ açılır kütüphane çekmecesi
  const [librarySearch, setLibrarySearch] = useState("");
  const [openDesigns, setOpenDesigns] = useState(() => new Set()); // akordiyonda açık desenler

  // tema + ayarlar
  const [theme, setTheme] = useState(() => ls("ccd:theme", "dark"));
  const cv = CANVAS[theme] || CANVAS.dark;
  const [showSettings, setShowSettings] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showGenerator, setShowGenerator] = useState(() => ls("ccd:showGenerator", "0") === "1"); // üretici varsayılan gizli
  useEffect(() => { try { localStorage.setItem("ccd:showGenerator", showGenerator ? "1" : "0"); } catch (e) { /* */ } }, [showGenerator]);
  const [aiProvider, setAiProvider] = useState(() => ls("ccd:aiProvider", "gemini"));
  const [aiKey, setAiKey] = useState(() => ls("ccd:aiKey", ""));
  const [aiModel, setAiModel] = useState(() => ls("ccd:aiModel", ""));
  const defModel = (p) => (p === "gemini" ? "gemini-2.0-flash" : "claude-haiku-4-5-20251001");
  const aiSettings = useMemo(() => ({ provider: aiProvider, apiKey: aiKey.trim(), model: aiModel.trim() || defModel(aiProvider) }), [aiProvider, aiKey, aiModel]);

  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem("ccd:theme", theme); } catch (e) { /* kalıcı kayıt yok */ } }, [theme]);
  useEffect(() => { try { localStorage.setItem("ccd:aiProvider", aiProvider); } catch (e) { /* */ } }, [aiProvider]);
  useEffect(() => { try { aiKey ? localStorage.setItem("ccd:aiKey", aiKey) : localStorage.removeItem("ccd:aiKey"); } catch (e) { /* */ } }, [aiKey]);
  useEffect(() => { try { aiModel ? localStorage.setItem("ccd:aiModel", aiModel) : localStorage.removeItem("ccd:aiModel"); } catch (e) { /* */ } }, [aiModel]);

  // akıllı desen üretici
  const [genTargetCm, setGenTargetCm] = useState(14);
  const [genStyle, setGenStyle] = useState("tonal");
  const [genBands, setGenBands] = useState(2);   // bant (aksan) rengi sayısı (K)
  const [genGround, setGenGround] = useState(1); // zemin rengi sayısı (G)
  const [genGroundColors, setGenGroundColors] = useState(["#EFE6D3", "#E5D9C3"]); // seçilen zemin renkleri
  const [genDesigns, setGenDesigns] = useState(3);   // farklı desen sayısı (N)
  const [genVariants, setGenVariants] = useState(3); // her desen için varyant sayısı (M)
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [designs, setDesigns] = useState([]); // [{ struct:[{role,ends}], G, K, ways:[{name,colors}] }]

  // gerçek ölçek / görüntüleme
  const [pxPerCm, setPxPerCm] = useState(38);     // kalibre edilmiş CSS px/cm (1:1)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [reportMode, setReportMode] = useState("repeat"); // "repeat" | "unit" (tekrarlı / birim rapor)
  const [fullscreen, setFullscreen] = useState(false); // simülatör tam ekran
  const [flipX, setFlipX] = useState(false); // simülatör görsel ayna (yatay) — sadece görüntü
  const [flipY, setFlipY] = useState(false); // simülatör görsel ayna (dikey) — sadece görüntü
  useEffect(() => {
    if (!fullscreen) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [fullscreen]);
  const [calibrating, setCalibrating] = useState(false);
  const [calPx, setCalPx] = useState(38);

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const drag = useRef(null);
  const importRef = useRef(null);

  const activeKey = mode === "single" ? "warp" : editTab;
  const list = activeKey === "warp" ? warp : weft;
  const setList = activeKey === "warp" ? setWarp : setWeft;
  // asılı (railroad) görünüm: dikey çizgi = atkı bandı, yatay çizgi = çözgü bandı
  const isWeftStripe = mode === "single" && orientation === "v";
  const designDensity = isWeftStripe ? weftDensity : warpDensity;
  const sysLabel = isWeftStripe ? "Atkı" : "Çözgü";   // tasarlanan bandın iplik sistemi
  const unitLabel = mode === "single" ? (isWeftStripe ? "atkı" : "tel") : (activeKey === "warp" ? "tel" : "atkı");
  const density = mode === "single" ? designDensity : (activeKey === "warp" ? warpDensity : weftDensity);
  const unit = pxPerCm * zoom; // CSS px / cm (ekranda)

  // kalibrasyonu yükle/kaydet
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get("cozgu_pxPerCm");
        if (r && r.value) { const v = parseFloat(r.value); if (v > 0) { setPxPerCm(v); setCalPx(v); } }
      } catch (e) { /* ilk kullanım */ }
    })();
  }, []);
  const saveCalibration = async () => {
    setPxPerCm(calPx); setCalibrating(false); setZoom(1); setPan({ x: 0, y: 0 });
    try { await storage.set("cozgu_pxPerCm", String(calPx)); } catch (e) { /* kalıcı kayıt başarısız */ }
  };

  const repeatEnds = useMemo(() => warp.reduce((s, x) => s + (x.ends || 0), 0), [warp]);
  const repeatCm = designDensity > 0 ? repeatEnds / designDensity : 0;
  const repeats = repeatCm > 0 ? fabricCm / repeatCm : 0;
  const totalEnds = Math.round(fabricCm * designDensity);
  const colorRows = useMemo(() => {
    const by = {};
    warp.forEach((s) => { by[s.color] = (by[s.color] || 0) + (s.ends || 0); });
    return Object.entries(by).map(([color, e]) => ({
      color, perRepeat: e,
      cm: designDensity > 0 ? e / designDensity : 0,
      total: Math.round(e * repeats),
      pct: repeatEnds > 0 ? (e / repeatEnds) * 100 : 0,
    })).sort((a, b) => b.total - a.total);
  }, [warp, repeats, repeatEnds, designDensity]);

  // pan sınırları
  const contentStripeCm = fabricCm;
  const maxPanX = (axis) => {
    if (mode === "check") return Math.max(0, fabricCm * unit - axis);
    if (orientation === "v") return Math.max(0, contentStripeCm * unit - axis);
    return 0;
  };
  const maxPanY = (axis) => {
    if (mode === "check") return Math.max(0, 400 * unit - axis);
    if (orientation === "h") return Math.max(0, contentStripeCm * unit - axis);
    return 0;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = wrap.clientWidth, H = wrap.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = cv.bg; ctx.fillRect(0, 0, W, H);
    if (unit <= 0) return;
    const unitMode = reportMode === "unit"; // birim rapor: tek tekrar göster

    // görsel aynalama (yalnız desen katmanı; cetvel okunur kalsın diye save/restore içinde)
    ctx.save();
    if (flipX) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    if (flipY) { ctx.translate(0, H); ctx.scale(1, -1); }

    // bant ekseninde döşeme (modulo ile sanal): pan kadar kaydır
    const tileX = (segs, repPx, panX, drawSeg) => {
      if (repPx <= 0) return;
      let start = unitMode ? -panX : -((panX % repPx + repPx) % repPx);
      for (let base = start; base < W; base += repPx) {
        let p = base;
        for (const s of segs) { const w = (s.ends || 0) * unit / (segs === weft ? weftDensity : warpDensity); if (w > 0) { drawSeg(s, p, w); p += w; } }
        if (unitMode) break;
      }
    };

    const warpRepPx = repeatEnds * unit / warpDensity;
    const weftRepEnds = weft.reduce((s, x) => s + (x.ends || 0), 0);
    const weftRepPx = weftRepEnds * unit / weftDensity;

    if (mode === "check") {
      // çözgü (dikey bantlar) — eni fabricCm kadar kırp
      const fabX0 = -pan.x, fabX1 = fabX0 + fabricCm * unit;
      ctx.save();
      if (!unitMode) { ctx.beginPath(); ctx.rect(Math.max(0, fabX0), 0, Math.max(0, Math.min(W, fabX1) - Math.max(0, fabX0)), H); ctx.clip(); }
      tileX(warp, warpRepPx, pan.x, (s, p, w) => { ctx.fillStyle = s.color; ctx.fillRect(p, 0, w + 0.5, H); });
      // atkı (yatay bantlar, %50 karışım)
      ctx.globalAlpha = 0.5;
      if (weftRepPx > 0) {
        let start = unitMode ? -pan.y : -((pan.y % weftRepPx + weftRepPx) % weftRepPx);
        for (let base = start; base < H; base += weftRepPx) {
          let p = base;
          for (const s of weft) { const h = (s.ends || 0) * unit / weftDensity; if (h > 0) { ctx.fillStyle = s.color; ctx.fillRect(0, p, W, h + 0.5); p += h; } }
          if (unitMode) break;
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      drawDashed(ctx, warpRepPx, pan.x, false, W, H, cv);
      drawDashed(ctx, weftRepPx, pan.y, true, W, H, cv);
    } else {
      const horizontal = orientation === "h";
      const dd = designDensity;
      const repPx = repeatEnds * unit / dd;
      const fab0 = horizontal ? -pan.y : -pan.x, fab1 = fab0 + fabricCm * unit;
      ctx.save();
      if (!unitMode) {
        if (horizontal) { ctx.beginPath(); ctx.rect(0, Math.max(0, fab0), W, Math.max(0, Math.min(H, fab1) - Math.max(0, fab0))); ctx.clip(); }
        else { ctx.beginPath(); ctx.rect(Math.max(0, fab0), 0, Math.max(0, Math.min(W, fab1) - Math.max(0, fab0)), H); ctx.clip(); }
      }
      const panV = horizontal ? pan.y : pan.x;
      if (repPx > 0) {
        let start = unitMode ? -panV : -((panV % repPx + repPx) % repPx);
        const lim = horizontal ? H : W;
        for (let base = start; base < lim; base += repPx) {
          let p = base;
          for (const s of warp) { const w = (s.ends || 0) * unit / dd; if (w > 0) { ctx.fillStyle = s.color; if (horizontal) ctx.fillRect(0, p, W, w + 0.5); else ctx.fillRect(p, 0, w + 0.5, H); p += w; } }
          if (unitMode) break;
        }
      }
      ctx.restore();
      drawDashed(ctx, repPx, panV, horizontal, W, H, cv);
    }

    ctx.restore(); // aynalama bitti; cetvel normal çizilir
    drawRuler(ctx, W, H, unit, pan.x, cv);
  }, [warp, weft, warpDensity, weftDensity, designDensity, fabricCm, mode, orientation, unit, pan, repeatEnds, cv, reportMode, flipX, flipY]);

  useEffect(() => {
    draw();
    const r = () => draw();
    window.addEventListener("resize", r);
    // wrap boyutu değişince (tam ekran geçişi dahil) yeniden çiz
    let ro;
    if (wrapRef.current && "ResizeObserver" in window) { ro = new ResizeObserver(r); ro.observe(wrapRef.current); }
    return () => { window.removeEventListener("resize", r); if (ro) ro.disconnect(); };
  }, [draw]);

  // pan (sürükleme)
  const onDown = (e) => {
    if (calibrating) return;
    const p = "touches" in e ? e.touches[0] : e;
    drag.current = { sx: p.clientX, sy: p.clientY, px: pan.x, py: pan.y };
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const p = "touches" in e ? e.touches[0] : e;
    const W = wrapRef.current.clientWidth, H = wrapRef.current.clientHeight;
    const nx = clamp(drag.current.px - (p.clientX - drag.current.sx), 0, maxPanX(W));
    const ny = clamp(drag.current.py - (p.clientY - drag.current.sy), 0, maxPanY(H));
    setPan({ x: nx, y: ny });
  };
  const onUp = () => { drag.current = null; };

  const fitWidth = () => {
    const W = wrapRef.current?.clientWidth || 300;
    const z = (W / (fabricCm * pxPerCm)) * 0.98;
    setZoom(Math.max(0.05, z)); setPan({ x: 0, y: 0 });
  };
  const setZoomKeep = (z) => { setZoom(clamp(z, 0.05, 4)); };

  const updateSeg = (id, patch) => { setWarp((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x))); setWeft((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x))); };
  const updateMany = (ids, patch) => { setWarp((s) => s.map((x) => ids.has(x.id) ? { ...x, ...patch } : x)); setWeft((s) => s.map((x) => ids.has(x.id) ? { ...x, ...patch } : x)); };
  const removeSeg = (id) => { setList((s) => s.filter((x) => x.id !== id)); setCheckedIds((c) => { if (!c.has(id)) return c; const n = new Set(c); n.delete(id); return n; }); };
  const dupSeg = (id) => setList((s) => { const i = s.findIndex((x) => x.id === id); const arr = [...s]; arr.splice(i + 1, 0, { ...s[i], id: nextId++ }); return arr; });
  const moveSeg = (id, d) => setList((s) => { const i = s.findIndex((x) => x.id === id), j = i + d; if (j < 0 || j >= s.length) return s; const arr = [...s]; [arr[i], arr[j]] = [arr[j], arr[i]]; return arr; });
  const reverseList = () => setList((s) => [...s].reverse()); // çizgi sırasını ters çevir (aynalama)
  const addSeg = () => { const nid = nextId++; setList((s) => [...s, { id: nid, color: palette[1] || "#CCCCCC", ends: 8, tag: "" }]); setSelectedId(nid); };
  const setEnds = (id, n) => updateSeg(id, { ends: Math.max(0, Math.round(n)) });
  const setCm = (id, cm) => updateSeg(id, { ends: Math.max(0, Math.round((cm || 0) * density)) });
  const setTag = (id, tag) => updateSeg(id, { tag });
  const applyColor = (hex) => { if (checkedIds.size > 0) updateMany(checkedIds, { color: hex }); else if (selectedId != null) updateSeg(selectedId, { color: hex }); };
  const toggleCheck = (id) => setCheckedIds((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectByTag = (tag) => { if (!tag) return; const ids = list.filter((s) => (s.tag || "") === tag).map((s) => s.id); setCheckedIds((c) => { const n = new Set(c); ids.forEach((i) => n.add(i)); return n; }); };
  const clearChecks = () => setCheckedIds(new Set());
  const addToPalette = () => { const cur = [...warp, ...weft].find((x) => x.id === selectedId)?.color; if (cur && !palette.includes(cur)) setPalette((p) => [...p, cur]); };
  const reset = () => { setWarp(clone(WARP_START)); setWeft(clone(WEFT_START)); setSelectedId(null); setCheckedIds(new Set()); };
  const newDesign = () => { setWarp([]); setWeft([]); setSelectedId(null); setCheckedIds(new Set()); setMode("single"); setOrientation("v"); setActiveDesignId(null); setActiveVariantId(null); };

  // --- akıllı desen üretici ---
  const fitTo = (segs, N) => {
    let s = segs.map((x) => ({ color: x.color, ends: Math.max(1, Math.round(x.ends || 1)) }));
    let sum = s.reduce((a, b) => a + b.ends, 0);
    if (sum === 0) return s;
    s = s.map((x) => ({ color: x.color, ends: Math.max(1, Math.round((x.ends * N) / sum)) }));
    let diff = N - s.reduce((a, b) => a + b.ends, 0);
    let guard = 0;
    while (diff !== 0 && guard < 5000) {
      let idx = 0; for (let i = 1; i < s.length; i++) if (s[i].ends > s[idx].ends) idx = i;
      if (diff < 0 && s[idx].ends <= 1) { let m = -1, mi = -1; for (let i = 0; i < s.length; i++) if (s[i].ends > m) { m = s[i].ends; mi = i; } idx = mi; }
      s[idx].ends += diff > 0 ? 1 : -1;
      if (s[idx].ends < 1) s[idx].ends = 1;
      diff = N - s.reduce((a, b) => a + b.ends, 0); guard++;
    }
    return s;
  };

  const STYLE = {
    tonal: "Tonal / nötr: nötr bir zemin (krem, keten, greige, kum, taş, yumuşak gri) üzerine aynı aileden ton-üstüne-ton ince aksanlar. Sofistike, sakin.",
    pinstripe: "Pinstripe: geniş sakin zemin üzerine çok ince (birkaç mm) tek veya gruplanmış çizgiler. Klasik perdelik zarafet.",
    ticking: "Ticking: açık zemin üzerine düzenli, ince-orta kalınlıkta iki renkli klasik çizgi ritmi.",
    awning: "Awning / tente: geniş, dengeli, cesur 2-3 renk bantlar. Daha grafik ve modern.",
    ombre: "Degrade: tek bir renk ailesinin açıktan koyuya kademeli bantları; yumuşak geçiş hissi.",
    contrast: "Kontrast aksan: sakin geniş zemin + 1-2 belirgin kontrast bant; dengeli ama dikkat çekici.",
  };

  const segmentsOf = (struct, colors) => struct.map((s) => ({ color: colors[s.role] ?? colors[0], ends: s.ends }));

  // --- kayıtlı desen kütüphanesi (localStorage): desen > varyant ---
  const flash = (m, ms = 3500) => { setLibMsg(m); setTimeout(() => setLibMsg(""), ms); };
  // editördeki warp'tan yeni desen (tek varyant)
  const saveCurrent = () => {
    if (!warp.length) return;
    const name = prompt("Desen adı:", "Desen"); if (name === null) return;
    const rec = saveDesign({
      name: name || "Desen", ends: warp.map(s => s.ends), tags: warp.map(s => s.tag || ""),
      warpDensity, weftDensity, fabricCm, mode, orientation,
      variants: [{ name: "Varyant 1", colors: warp.map(s => s.color) }],
    });
    setSavedList(listDesigns());
    if (rec) { setActiveDesignId(rec.id); setActiveVariantId(rec.variants[0]?.id || null); flash("Desen kaydedildi."); }
  };
  // editör renklerini bir desene varyant olarak ekle (aynı yapı şartı)
  const addVariantTo = (d) => {
    if (!d) return;
    if (warp.length !== d.ends.length) {
      flash(`"${d.name}" ${d.ends.length} çizgili; varyant için editörde aynı sayıda çizgi olmalı (şu an ${warp.length}).`, 5000);
      return;
    }
    const list = addVariant(d.id, { colors: warp.map(s => s.color) });
    setSavedList(list);
    setActiveDesignId(d.id);
    setActiveVariantId(list.find(x => x.id === d.id)?.variants.slice(-1)[0]?.id || null);
    flash("Varyant eklendi.");
  };
  // yüklü varyantın üzerine kaydet (yeni varyant açmadan)
  const saveOverVariant = () => {
    const d = savedList.find(x => x.id === activeDesignId);
    const v = d?.variants.find(x => x.id === activeVariantId);
    if (!d || !v || !warp.length) return;
    setSavedList(updateVariant(d.id, v.id, { ends: warp.map(s => s.ends), tags: warp.map(s => s.tag || ""), colors: warp.map(s => s.color) }));
    flash("Üzerine kaydedildi.");
  };
  // AI üretici: tek yol → tek-varyantlı desen
  const saveWay = (d, way) => {
    const rec = saveDesign({
      name: way.name || "Desen", ends: d.struct.map(s => s.ends),
      tags: d.struct.map(s => s.role < d.G ? "z" + (s.role + 1) : "b" + (s.role - d.G + 1)),
      warpDensity, weftDensity, fabricCm, mode, orientation,
      variants: [{ name: way.name || "Varyant 1", colors: segmentsOf(d.struct, way.colors).map(s => s.color) }],
    });
    setSavedList(listDesigns());
    if (rec) { setActiveDesignId(rec.id); setActiveVariantId(rec.variants[0]?.id || null); flash("Desen kaydedildi."); }
  };
  // AI üretici: tüm yollar → tek desen, yollar varyant
  const saveDesignAll = (d, di) => {
    const rec = saveDesign({
      name: `Desen ${di + 1}`, ends: d.struct.map(s => s.ends),
      tags: d.struct.map(s => s.role < d.G ? "z" + (s.role + 1) : "b" + (s.role - d.G + 1)),
      warpDensity, weftDensity, fabricCm, mode, orientation,
      variants: d.ways.map(w => ({ name: w.name, colors: segmentsOf(d.struct, w.colors).map(s => s.color) })),
    });
    setSavedList(listDesigns());
    if (rec) { setActiveDesignId(rec.id); setActiveVariantId(rec.variants[0]?.id || null); flash(`${d.ways.length} varyantlı desen kaydedildi.`); }
  };
  const loadVariant = (d, v) => {
    setMode(d.mode || "single"); setOrientation(d.orientation || "v");
    if (d.warpDensity) setWarpDensity(d.warpDensity);
    if (d.weftDensity) setWeftDensity(d.weftDensity);
    if (d.fabricCm) setFabricCm(d.fabricCm);
    setWarp(d.ends.map((e, i) => ({ id: nextId++, color: v.colors[i], ends: e, tag: (d.tags && d.tags[i]) || "" })));
    setSelectedId(null); setCheckedIds(new Set());
    setActiveDesignId(d.id); setActiveVariantId(v.id);
    setView("editor"); // yükleyince editöre dön
  };
  const toggleOpen = (id) => setOpenDesigns((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const shownDesigns = librarySearch.trim() ? savedList.filter((d) => (d.name || "").toLowerCase().includes(librarySearch.trim().toLowerCase())) : savedList;
  const renameDesignUI = (d) => { const n = prompt("Desen adı:", d.name); if (n != null && n.trim()) setSavedList(renameDesign(d.id, n.trim())); };
  const renameVariantUI = (d, v) => { const n = prompt("Varyant adı:", v.name); if (n != null && n.trim()) setSavedList(renameVariant(d.id, v.id, n.trim())); };
  const removeDesign = (id) => { setSavedList(deleteDesign(id)); if (activeDesignId === id) { setActiveDesignId(null); setActiveVariantId(null); } };
  const removeVariant = (designId, vId) => {
    const list = deleteVariant(designId, vId);
    setSavedList(list);
    if (activeVariantId === vId) setActiveVariantId(null);
    if (activeDesignId === designId && !list.find(x => x.id === designId)) setActiveDesignId(null);
  };
  const exportLibrary = () => {
    const blob = new Blob([exportDesigns()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cozgu-desenler-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };
  const importLibrary = async (file) => {
    try {
      const { added, list } = importDesigns(JSON.parse(await file.text()));
      setSavedList(list);
      setLibMsg(added > 0 ? `${added} desen içe aktarıldı.` : "Dosyada geçerli desen bulunamadı.");
    } catch { setLibMsg("Dosya okunamadı veya geçersiz JSON."); }
    setTimeout(() => setLibMsg(""), 4000);
  };

  const buildDesignFromParsed = (parsed, N, G, K, grounds) => {
    if (!parsed || !parsed.str || !parsed.ways) return null;
    const rolesRaw = parsed.str.filter((x) => Array.isArray(x) && x.length >= 2 && x[1] > 0);
    if (!rolesRaw.length) return null;
    const fitted = fitTo(rolesRaw.map(([role, ends]) => ({ color: String(role), ends })), N);
    const struct = fitted.map((s) => ({ role: Math.max(0, parseInt(s.color) || 0), ends: s.ends }));
    const totalRoles = G + K;
    const norm = (hex) => { const h = String(hex || "").trim(); return /^#?[0-9a-fA-F]{6}$/.test(h) ? (h[0] === "#" ? h : "#" + h) : null; };
    const ways = parsed.ways.map((w, i) => {
      const cols = (w.c || w.colors || []).map(norm);
      const colors = [];
      for (let r = 0; r < totalRoles; r++) {
        if (r < G) colors[r] = grounds[r] || grounds[0] || cols[r] || "#cccccc"; // zemin SABİT: seçilen zemin
        else colors[r] = cols[r] || cols[0] || grounds[0] || "#cccccc";
      }
      return { name: w.n || w.name || (i === 0 ? "Ana" : `Kolorvari ${i}`), colors };
    }).filter((w) => w.colors.length);
    if (!ways.length) return null;
    return { struct, G, K, ways };
  };

  const COMPOSITIONS = [
    "dengeli simetrik ritim",
    "bilinçli asimetrik ritim",
    "geniş zemin + tek ince çizgi grubu",
    "kalın blok bant + ince çizgi karışımı",
    "çoklu ince çizgi grupları (pencil grouping)",
    "merkezde güçlü aksan, kenarlarda ince çizgiler",
  ];

  const generate = async () => {
    setGenerating(true); setGenError(""); setDesigns([]);
    if (!aiSettings.apiKey) { setGenError("AI için Ayarlar'dan API anahtarı gir."); setGenerating(false); return; }
    const N = Math.max(2, Math.round(genTargetCm * warpDensity));
    const K = Math.max(1, genBands);
    const G = Math.max(1, Math.min(genGround, 2));
    const grounds = genGroundColors.slice(0, G);
    const groundsTxt = grounds.map((h) => `${nameOf(h)} ${h}`).join(", ");
    const neutralTxt = GROUND_CANDIDATES.map((c) => `${c.name} ${c.hex}`).join(", ");
    const accentTxt = ACCENT_CANDIDATES.map((c) => `${c.name} ${c.hex}`).join(", ");
    const V = Math.max(0, genVariants);
    const D = Math.max(1, genDesigns);

    const promptFor = (di) => `Sen perdelik DOKUMA kumaş tasarımında uzman kıdemli bir tekstil tasarımcısısın. Tek bir çözgü çizgisi rapor YAPISI ve onun ticari renk varyasyonlarını (kolorvari) üreteceksin.

Yapı:
- Rapor TAM ${N} çözgü teli. Roller: 0..${G - 1} = ZEMİN (açık/nötr, baskın alan ~%40-70), ${G}..${G + K - 1} = AKSAN (zemin üzerine farklı kalınlıkta bant/çizgi).
- Tek yapı; tüm kolorvariler aynı yapıyı (segment sırası + telleri) paylaşır, sadece renkler değişir.
- Stil: ${STYLE[genStyle]}
- Kompozisyon: ${COMPOSITIONS[di % COMPOSITIONS.length]}. Bu desen (${di + 1}/${D}) diğer desenlerden FARKLI bir oran/ritim taşısın. Cırtlak kombinasyon yok; çok ince tek çizgiler yerine grupla.

Renkler SADECE şu listelerden seçilir (hex'i birebir kopyala):
ZEMİN adayları: ${neutralTxt}
AKSAN adayları: ${accentTxt}

Renk kombinasyonları "ways":
- ways[0] = ANA. Zemin(ler)i TAM şu olacak: ${groundsTxt}. Aksanları bu zemine uyumlu seç.
- ways[1..${V}] = ${V} kolorvari. Zemin(ler) TÜM kolorvarilerde AYNI kalır (${groundsTxt}); SADECE aksanlar değişir ve hepsi bu zemine uyumlu, perdelik-ticari olur.
- Her "c" dizisi rol sırasıyla ${G + K} renk: önce ${G} zemin (hep aynı), sonra ${K} aksan.

SADECE minified JSON döndür; markdown/açıklama YOK. İsim en fazla 3 kelime.
Şema: {"str":[[rol,tel],[rol,tel]],"ways":[{"n":"isim","c":["#RRGGBB","#RRGGBB"]}]}`;

    const callOne = async (di) => {
      try {
        const text = await generateText(promptFor(di), aiSettings);
        return buildDesignFromParsed(parseDesign(text), N, G, K, grounds);
      } catch (e) { console.error("desen", di, e); return { _err: e.message || "hata" }; }
    };

    try {
      const results = await Promise.all(Array.from({ length: D }, (_, di) => callOne(di)));
      const ok = results.filter((r) => r && !r._err);
      if (!ok.length) {
        const msg = results.find((r) => r && r._err)?._err || "bilinmeyen";
        throw new Error(msg);
      }
      setDesigns(ok);
      if (ok.length < D) setGenError(`${D - ok.length} desen üretilemedi; tekrar deneyebilirsin.`);
    } catch (e) {
      setGenError("Üretim başarısız (" + (e.message || "bilinmeyen") + "). Tekrar dene; desen/varyant sayısını azaltmak veya rapor enini küçültmek yardımcı olabilir.");
    }
    setGenerating(false);
  };

  const loadDesign = (d, way) => {
    setMode("single"); setOrientation("v"); // varsayılan dikey (istenirse Yatay'a çevrilir)
    const segs = d.struct.map((s) => ({ id: nextId++, color: way.colors[s.role] ?? way.colors[0], ends: s.ends }));
    setWarp(segs); setSelectedId(segs[0]?.id ?? null);
    setFabricCm(Math.max(fabricCm, Math.round((d.struct.reduce((t, x) => t + x.ends, 0) / warpDensity) * 100) / 100));
    setActiveDesignId(null); // üretici önizlemesi; henüz kayıtlı bir desen değil
  };

  const renderWayCard = (d, way, key, big) => {
    const segs = segmentsOf(d.struct, way.colors);
    const totalEndsW = d.struct.reduce((t, x) => t + x.ends, 0);
    return (
      <div key={key} style={{ background: SUNK, border: `1px solid ${big ? GOLD : LINE}`, borderRadius: 12, padding: 12 }}>
        <MiniStripe segments={segs} height={big ? 64 : 48} />
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, marginTop: 10 }}>{way.name}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
          {way.colors.map((c, r) => {
            const isGround = r < d.G;
            return (
              <span key={r} title={c + (isGround ? " (zemin)" : "")} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: MUTE, border: `1px solid ${isGround ? GOLD : LINE}`, borderRadius: 5, padding: "2px 5px 2px 3px" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: c, border: `1px solid ${LINE}` }} />
                {nameOf(c)}{isGround ? " · zemin" : ""}
              </span>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: MUTE, marginTop: 6 }}>{totalEndsW} tel · {d.K} bant · {d.G} zemin</div>
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button onClick={() => loadDesign(d, way)} style={{ ...btn, flex: 1, borderColor: TEAL, color: TEAL }}>Yükle <ArrowRight size={14} /></button>
          <button onClick={() => saveWay(d, way)} style={{ ...btn, flex: 1 }}><Save size={14} /> Kaydet</button>
        </div>
      </div>
    );
  };

  const seqText = warp.map((s) => `${nameOf(s.color)} (${s.color}) x${s.ends}`).join("  |  ");
  const copySeq = () => { navigator.clipboard?.writeText(`Cozgu rapor (${repeatEnds} tel / ${trimNum(repeatCm, 2)} cm @ ${warpDensity} tel/cm): ${seqText}`); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const downloadPng = () => { const c = canvasRef.current; if (!c) return; const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "cozgu-cizgi-denemesi.png"; a.click(); };

  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("tr-TR");
  const btn = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid ${LINE}`, color: TEXT, background: "transparent", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13 };
  const iconBtn = { ...btn, padding: 7 };
  const selStyle = { display: "block", width: "100%", marginTop: 5, background: SUNK, border: `1px solid ${LINE}`, color: TEXT, borderRadius: 8, padding: "8px 10px", fontSize: 14, boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100%", background: NAVY, color: TEXT, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.3 }}>Çizgi Simülatör</h1>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: GOLD }} />
          </div>
          <button onClick={() => setShowSettings(true)} title="Ayarlar" aria-label="Ayarlar" style={{ ...iconBtn, padding: 9 }}><Settings size={18} /></button>
        </div>
        <p style={{ color: MUTE, fontSize: 13, margin: "4px 0 16px" }}>Tel veya cm gir; master sıklık çevirir. Kalibre edince önizleme ekranda gerçek 1:1 ölçekte — kaydır, zoom yap, cetvelle ölç.</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {[["editor", "Editör"], ["library", `Kayıtlı desenler (${savedList.length})`]].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{ ...btn, borderColor: view === v ? GOLD : LINE, color: view === v ? GOLD : TEXT, background: view === v ? "rgba(232,160,48,0.08)" : "transparent" }}>{l}</button>
          ))}
        </div>
        {libMsg && <div style={{ fontSize: 12, color: TEAL, marginBottom: 12 }}>{libMsg}</div>}
        {(() => {
          const ad = activeDesignId && activeVariantId && savedList.find(x => x.id === activeDesignId);
          const av = ad && ad.variants.find(v => v.id === activeVariantId);
          if (!ad || !av) return null;
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "rgba(232,160,48,0.08)", border: `1px solid ${GOLD}`, borderRadius: 8, padding: "6px 10px", marginBottom: 12 }}>
              <Pencil size={13} color={GOLD} />
              <span style={{ fontSize: 12, color: MUTE }}>Düzenlenen:</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{ad.name}</span>
              <span style={{ fontSize: 12, color: MUTE }}>·</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{av.name}</span>
            </div>
          );
        })()}

        {view === "editor" && (<>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[["single", "Tek yön (çizgi)"], ["check", "Dama / Ekose"]].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)} style={{ ...btn, borderColor: mode === v ? GOLD : LINE, color: mode === v ? GOLD : TEXT, background: mode === v ? "rgba(232,160,48,0.08)" : "transparent" }}>{l}</button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 18 }} className="cd-grid">
          {/* sol kontrol */}
          <div className="cd-controls" style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
            {mode === "check" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[["warp", "Çözgü (dikey)"], ["weft", "Atkı (yatay)"]].map(([v, l]) => (
                  <button key={v} onClick={() => setEditTab(v)} style={{ ...btn, flex: 1, borderColor: editTab === v ? TEAL : LINE, color: editTab === v ? TEAL : TEXT, background: editTab === v ? "rgba(45,212,191,0.08)" : "transparent" }}>{l}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: MUTE, marginRight: 2 }}>Palet</span>
              {palette.map((c) => (<button key={c} onClick={() => applyColor(c)} title={nameOf(c)} style={{ width: 24, height: 24, borderRadius: 6, background: c, border: `1px solid ${LINE}`, cursor: "pointer", padding: 0 }} />))}
              <button onClick={addToPalette} title="Seçili rengi palete ekle" style={{ ...iconBtn, width: 24, height: 24, padding: 0 }}><Plus size={13} /></button>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: MUTE, textTransform: "uppercase", letterSpacing: 1 }}>{mode === "check" ? (activeKey === "warp" ? "Çözgü renk sırası" : "Atkı renk sırası") : `${sysLabel} renk sırası`}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={newDesign} style={{ ...btn, padding: "5px 9px" }} title="Boş çalışma sayfası aç"><FilePlus size={14} /> Yeni desen</button>
                <button onClick={reverseList} disabled={!list.length} style={{ ...iconBtn, opacity: list.length ? 1 : 0.4 }} title="Çizgi sırasını ters çevir"><FlipHorizontal2 size={15} /></button>
                <button onClick={reset} style={iconBtn} title="Örnek deseni yükle"><RotateCcw size={15} /></button>
              </div>
            </div>
            {checkedIds.size > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "rgba(45,212,191,0.08)", border: `1px solid ${TEAL}`, borderRadius: 8, padding: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: TEAL, fontWeight: 600 }}>{checkedIds.size} satır seçili</span>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: TEXT, cursor: "pointer" }}>
                  Toplu renk
                  <input type="color" onChange={(e) => applyColor(e.target.value)} title="Seçili satırlara uygula" style={{ width: 30, height: 30, border: "none", borderRadius: 6, background: "none", cursor: "pointer" }} />
                </label>
                <span style={{ fontSize: 11, color: MUTE }}>(palet de seçililere uygular)</span>
                <button onClick={clearChecks} style={{ ...btn, padding: "5px 9px", marginLeft: "auto" }}>Seçimi temizle</button>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map((s, i) => {
                const sel = s.id === selectedId;
                return (
                  <div key={s.id} onClick={() => setSelectedId(s.id)} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: SUNK, border: `1px solid ${sel ? GOLD : LINE}`, borderRadius: 10, padding: 8, cursor: "pointer", boxShadow: sel ? `0 0 0 1px ${GOLD}` : "none" }}>
                    <input type="checkbox" checked={checkedIds.has(s.id)} onChange={() => toggleCheck(s.id)} onClick={(e) => e.stopPropagation()} title="Toplu seçim" style={{ width: 18, height: 18, flexShrink: 0, cursor: "pointer", accentColor: TEAL }} />
                    <input type="color" value={s.color} onChange={(e) => updateSeg(s.id, { color: e.target.value })} onClick={(e) => e.stopPropagation()} style={{ width: 36, height: 36, border: "none", borderRadius: 8, background: "none", cursor: "pointer", flexShrink: 0 }} />
                    <span title={s.color} onClick={(e) => { e.stopPropagation(); e.currentTarget.previousSibling?.click(); }} style={{ width: 76, fontSize: 12, color: TEXT, border: `1px solid ${LINE}`, borderRadius: 6, padding: "7px 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}>{nameOf(s.color)}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <input value={s.tag || ""} onChange={(e) => setTag(s.id, e.target.value)} placeholder="b1" title="Bant etiketi (grup adı)" style={{ width: 42, fontSize: 12, color: TEXT, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 6, padding: "7px 4px", textAlign: "center" }} />
                      <button onClick={() => selectByTag(s.tag)} disabled={!s.tag} title="Aynı etiketli satırları seç" style={{ ...iconBtn, opacity: s.tag ? 1 : 0.3 }}><Layers size={13} /></button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 230 }}>
                      <NumInput value={s.ends} decimals={0} onCommit={(n) => setEnds(s.id, n)} suffix={unitLabel} width={104} />
                      <NumInput value={density > 0 ? s.ends / density : 0} decimals={2} onCommit={(n) => setCm(s.id, n)} suffix="cm" width={120} />
                    </div>
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => moveSeg(s.id, -1)} disabled={i === 0} style={{ ...iconBtn, opacity: i === 0 ? 0.3 : 1 }}><ArrowUp size={14} /></button>
                      <button onClick={() => moveSeg(s.id, 1)} disabled={i === list.length - 1} style={{ ...iconBtn, opacity: i === list.length - 1 ? 0.3 : 1 }}><ArrowDown size={14} /></button>
                      <button onClick={() => dupSeg(s.id)} style={iconBtn}><Copy size={14} /></button>
                      <button onClick={() => removeSeg(s.id)} style={{ ...iconBtn, color: RED }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={addSeg} style={{ ...btn, width: "100%", marginTop: 10, borderColor: GOLD, color: GOLD }}><Plus size={16} /> Çizgi ekle</button>
            <div style={{ display: "grid", gridTemplateColumns: mode === "check" ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10, marginTop: 16 }}>
              {mode === "check" ? (
                <>
                  <FieldNum label="Çözgü sıklığı (tel/cm)" value={warpDensity} decimals={1} onCommit={(v) => setWarpDensity(Math.max(1, v))} />
                  <FieldNum label="Atkı sıklığı (atkı/cm)" value={weftDensity} decimals={1} onCommit={(v) => setWeftDensity(Math.max(1, v))} />
                </>
              ) : (
                isWeftStripe
                  ? <FieldNum label="Atkı sıklığı (atkı/cm)" value={weftDensity} decimals={1} onCommit={(v) => setWeftDensity(Math.max(1, v))} />
                  : <FieldNum label="Çözgü sıklığı (tel/cm)" value={warpDensity} decimals={1} onCommit={(v) => setWarpDensity(Math.max(1, v))} />
              )}
              <FieldNum label="Kumaş eni (cm)" value={fabricCm} decimals={1} onCommit={(v) => setFabricCm(Math.max(1, v))} />
            </div>
            {mode === "single" && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {[["v", "Dikey"], ["h", "Yatay"]].map(([v, l]) => (<button key={v} onClick={() => setOrientation(v)} style={{ ...btn, flex: 1, borderColor: orientation === v ? TEAL : LINE, color: orientation === v ? TEAL : TEXT, background: orientation === v ? "rgba(45,212,191,0.08)" : "transparent" }}>{l}</button>))}
              </div>
            )}
          </div>

          {/* sağ: gerçek ölçek önizleme */}
          <div className="cd-preview" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
              <div style={fullscreen
                ? { position: "fixed", inset: 0, zIndex: 55, background: cv.bg, overflow: "hidden" }
                : { position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${LINE}` }}>
                <div ref={wrapRef}
                  onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
                  onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
                  style={{ width: "100%", height: fullscreen ? "100%" : 360, touchAction: "none", cursor: drag.current ? "grabbing" : "grab" }}>
                  <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
                </div>
                {fullscreen && (
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", gap: 8, padding: 12, flexWrap: "wrap", background: "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))" }}>
                    <button onClick={() => setZoomKeep(zoom / 1.25)} style={{ ...iconBtn, background: PANEL }} title="Uzaklaş"><ZoomOut size={16} /></button>
                    <span style={{ fontSize: 13, minWidth: 52, textAlign: "center", color: "#fff" }}>{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoomKeep(zoom * 1.25)} style={{ ...iconBtn, background: PANEL }} title="Yakınlaş"><ZoomIn size={16} /></button>
                    <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ ...btn, background: PANEL }} title="Gerçek boyut">1:1</button>
                    <button onClick={fitWidth} style={{ ...btn, background: PANEL }} title="Tümünü sığdır"><Maximize size={15} /> Sığdır</button>
                    {[["repeat", "Tekrarlı"], ["unit", "Birim"]].map(([v, l]) => (
                      <button key={v} onClick={() => setReportMode(v)} style={{ ...btn, padding: "6px 12px", background: reportMode === v ? "rgba(232,160,48,0.18)" : PANEL, borderColor: reportMode === v ? GOLD : LINE, color: reportMode === v ? GOLD : TEXT }}>{l}</button>
                    ))}
                    <button onClick={() => setFlipX((f) => !f)} style={{ ...iconBtn, background: PANEL, borderColor: flipX ? GOLD : LINE, color: flipX ? GOLD : "#fff" }} title="Görseli yatay aynala"><FlipHorizontal2 size={16} /></button>
                    <button onClick={() => setFlipY((f) => !f)} style={{ ...iconBtn, background: PANEL, borderColor: flipY ? GOLD : LINE, color: flipY ? GOLD : "#fff" }} title="Görseli dikey aynala"><FlipVertical2 size={16} /></button>
                    <button onClick={() => setFullscreen(false)} style={{ ...btn, marginLeft: "auto", background: PANEL, borderColor: GOLD, color: GOLD }}><X size={16} /> Kapat</button>
                  </div>
                )}
                {calibrating && (
                  <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "var(--scrim)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, textAlign: "center", overflow: "auto" }}>
                    <p style={{ fontSize: 14, color: TEXT, maxWidth: 420, margin: "0 0 18px", lineHeight: 1.5 }}>
                      Ekrana gerçek bir <b>cetvel</b> (ya da şerit metre) koy. Cetvelin <b>0–10 cm</b> arası aşağıdaki cetvelle <b>birebir</b> oturana kadar kaydırıcıyı ayarla.
                    </p>
                    <div style={{ maxWidth: "100%", overflowX: "auto", padding: "0 8px" }}>
                      <div style={{ position: "relative", width: RULER_CM * calPx, height: 46, margin: "0 auto" }}>
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: GOLD }} />
                        {Array.from({ length: RULER_CM + 1 }, (_, i) => {
                          const major = i % 5 === 0;
                          return (
                            <div key={i} style={{ position: "absolute", top: 0, left: i * calPx, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <div style={{ width: major ? 2 : 1, height: major ? 22 : 13, background: GOLD }} />
                              {major && <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, marginTop: 3 }}>{i}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: GOLD, fontWeight: 700, marginTop: 10 }}>10 cm</div>
                    <input type="range" min={24} max={120} step={0.2} value={calPx} onChange={(e) => setCalPx(parseFloat(e.target.value))} style={{ width: "80%", maxWidth: 360, marginTop: 16, accentColor: GOLD }} />
                    <div style={{ fontSize: 12, color: MUTE, marginTop: 8 }}>{fmt(calPx)} px/cm · 10 cm = {fmt(RULER_CM * calPx)} px</div>
                    <div style={{ fontSize: 11, color: MUTE, marginTop: 6, maxWidth: 360 }}>İpucu: cetvel ekrana sığmıyorsa telefonu yatay çevir.</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                      <button onClick={() => setCalibrating(false)} style={btn}>İptal</button>
                      <button onClick={saveCalibration} style={{ ...btn, borderColor: GOLD, color: GOLD }}><Check size={15} /> Kaydet</button>
                    </div>
                  </div>
                )}
              </div>

              {/* zoom / ölçek araçları */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button onClick={() => setZoomKeep(zoom / 1.25)} style={iconBtn} title="Uzaklaş"><ZoomOut size={16} /></button>
                <span style={{ fontSize: 13, minWidth: 56, textAlign: "center", color: TEXT }}>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoomKeep(zoom * 1.25)} style={iconBtn} title="Yakınlaş"><ZoomIn size={16} /></button>
                <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={btn} title="Gerçek boyut">1:1</button>
                <button onClick={fitWidth} style={btn} title="Tümünü sığdır"><Maximize size={15} /> Sığdır</button>
                <button onClick={() => setFullscreen(true)} style={btn} title="Simülatörü tam ekran aç"><Maximize2 size={15} /> Tam ekran</button>
                <button onClick={() => setFlipX((f) => !f)} style={{ ...iconBtn, borderColor: flipX ? GOLD : LINE, color: flipX ? GOLD : TEXT }} title="Görseli yatay aynala"><FlipHorizontal2 size={16} /></button>
                <button onClick={() => setFlipY((f) => !f)} style={{ ...iconBtn, borderColor: flipY ? GOLD : LINE, color: flipY ? GOLD : TEXT }} title="Görseli dikey aynala"><FlipVertical2 size={16} /></button>
                <button onClick={() => { setCalPx(pxPerCm); setCalibrating(true); }} style={{ ...btn, marginLeft: "auto", borderColor: TEAL, color: TEAL }}><Ruler size={15} /> Cetveli ayarla</button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: MUTE }}>Görünüm</span>
                {[["repeat", "Tekrarlı rapor"], ["unit", "Birim rapor"]].map(([v, l]) => (
                  <button key={v} onClick={() => setReportMode(v)} style={{ ...btn, padding: "6px 12px", borderColor: reportMode === v ? GOLD : LINE, color: reportMode === v ? GOLD : TEXT, background: reportMode === v ? "rgba(232,160,48,0.08)" : "transparent" }}>{l}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: MUTE, marginTop: 8 }}>
                1:1 ölçek: 1 cm = {fmt(pxPerCm)} px · şu an 1 cm = {fmt(unit)} px (zoom %{Math.round(zoom * 100)}) · kumaş eni {fmt(fabricCm)} cm
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
                <Stat label={`${sysLabel} rapor`} value={`${repeatEnds} ${unitLabel}`} accent={GOLD} />
                <Stat label="Rapor eni" value={`${fmt(repeatCm)} cm`} accent={TEAL} />
                <Stat label="Ende rapor" value={`${fmt(repeats)}×`} accent={TEXT} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <button onClick={copySeq} style={{ ...btn, flex: 1, minWidth: 120 }}>{copied ? <Check size={15} color={TEAL} /> : <Copy size={15} />} {copied ? "Kopyalandı" : "Renk sırası"}</button>
                <button onClick={downloadPng} style={{ ...btn, flex: 1, minWidth: 120, borderColor: GOLD, color: GOLD }}><Download size={15} /> PNG indir</button>
                <button onClick={saveCurrent} style={{ ...btn, flex: 1, minWidth: 120 }}><Save size={15} /> Deseni kaydet</button>
                {activeDesignId && activeVariantId && savedList.find(x => x.id === activeDesignId)?.variants.some(v => v.id === activeVariantId) && (
                  <button onClick={saveOverVariant} style={{ ...btn, flex: 1, minWidth: 120, borderColor: GOLD, color: NAVY, background: GOLD, fontWeight: 700 }}><Save size={15} /> Üzerine kaydet</button>
                )}
                {activeDesignId && savedList.some(x => x.id === activeDesignId) && (
                  <button onClick={() => addVariantTo(savedList.find(x => x.id === activeDesignId))} style={{ ...btn, flex: 1, minWidth: 120, borderColor: TEAL, color: TEAL }}><Plus size={15} /> Varyant olarak kaydet</button>
                )}
              </div>
            </div>

            <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: MUTE, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>{sysLabel} hazırlık</div>
              <div style={{ fontSize: 12, color: MUTE, marginBottom: 12 }}>{fmt(fabricCm)} cm × {designDensity} {unitLabel}/cm = <b style={{ color: TEXT }}>{totalEnds.toLocaleString("tr-TR")}</b> toplam {unitLabel} · <b style={{ color: TEXT }}>{Math.floor(repeats)}</b> tam rapor</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "20px 1fr auto auto auto auto", gap: 8, fontSize: 11, color: MUTE, padding: "0 2px" }}>
                  <span /><span>Renk</span><span style={{ textAlign: "right" }}>{unitLabel === "atkı" ? "Atkı" : "Tel"}/rapor</span><span style={{ textAlign: "right" }}>cm/rapor</span><span style={{ textAlign: "right" }}>Toplam {unitLabel}</span><span style={{ textAlign: "right", width: 40 }}>%</span>
                </div>
                {colorRows.map((r) => (
                  <div key={r.color} style={{ display: "grid", gridTemplateColumns: "20px 1fr auto auto auto auto", gap: 8, alignItems: "center", background: SUNK, border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px" }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: r.color, border: `1px solid ${LINE}` }} />
                    <span title={r.color} style={{ fontSize: 12, color: TEXT }}>{nameOf(r.color)}</span>
                    <span style={{ fontSize: 13, textAlign: "right" }}>{r.perRepeat}</span>
                    <span style={{ fontSize: 13, textAlign: "right", color: TEAL }}>{fmt(r.cm)}</span>
                    <span style={{ fontSize: 13, textAlign: "right", color: GOLD, fontWeight: 600 }}>{r.total.toLocaleString("tr-TR")}</span>
                    <span style={{ fontSize: 12, textAlign: "right", color: MUTE, width: 40 }}>{fmt(r.pct)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* akıllı desen üretici (Ayarlar'dan aç/kapat) */}
        {showGenerator && (
        <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 16, marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Sparkles size={17} color={GOLD} />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Akıllı desen üretici</span>
          </div>
          <p style={{ fontSize: 12, color: MUTE, margin: "0 0 14px" }}>Zemini sen seç; AI bu zemine uyumlu ticari aksanlarla birden fazla desen üretir. Varyantlarda zemin sabit kalır, sadece aksanlar değişir. Beğendiğini yükle, üstte düzenle.</p>

          <div style={{ display: "grid", gap: 12 }} className="gen-grid">
            <FieldNum label="Rapor eni (cm)" value={genTargetCm} decimals={1} onCommit={(v) => setGenTargetCm(Math.max(1, v))} />
            <label style={{ fontSize: 12, color: MUTE }}>Stil
              <select value={genStyle} onChange={(e) => setGenStyle(e.target.value)} style={selStyle}>
                <option value="tonal">Tonal / nötr</option>
                <option value="pinstripe">Pinstripe (ince çizgi)</option>
                <option value="ticking">Ticking (klasik)</option>
                <option value="awning">Awning (geniş bant)</option>
                <option value="ombre">Degrade</option>
                <option value="contrast">Kontrast aksan</option>
              </select>
            </label>
            <label style={{ fontSize: 12, color: MUTE }}>Bant rengi sayısı
              <select value={genBands} onChange={(e) => setGenBands(parseInt(e.target.value))} style={selStyle}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} bant rengi</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: MUTE }}>Zemin sayısı
              <select value={genGround} onChange={(e) => setGenGround(parseInt(e.target.value))} style={selStyle}>
                {[1, 2].map((n) => <option key={n} value={n}>{n === 1 ? "1 (tek zemin)" : "2 (çok renkli zemin)"}</option>)}
              </select>
            </label>
            {Array.from({ length: genGround }, (_, i) => (
              <label key={i} style={{ fontSize: 12, color: MUTE }}>{genGround === 1 ? "Zemin rengi" : `Zemin ${i + 1}`}
                <select value={genGroundColors[i] || GROUND_CANDIDATES[0].hex} onChange={(e) => { const v = [...genGroundColors]; v[i] = e.target.value; setGenGroundColors(v); }} style={selStyle}>
                  {GROUND_CANDIDATES.map((c) => <option key={c.hex} value={c.hex}>{c.name}</option>)}
                </select>
              </label>
            ))}
            <label style={{ fontSize: 12, color: MUTE }}>Desen sayısı
              <select value={genDesigns} onChange={(e) => setGenDesigns(parseInt(e.target.value))} style={selStyle}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} desen</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: MUTE }}>Varyant / desen
              <select value={genVariants} onChange={(e) => setGenVariants(parseInt(e.target.value))} style={selStyle}>
                {[0, 2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n === 0 ? "Yok" : `${n} varyant`}</option>)}
              </select>
            </label>
          </div>

          <button onClick={generate} disabled={generating} style={{ ...btn, width: "100%", marginTop: 14, borderColor: GOLD, color: NAVY, background: GOLD, fontWeight: 700, opacity: generating ? 0.7 : 1 }}>
            {generating ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} {generating ? "Üretiliyor…" : `${genDesigns} desen${genVariants > 0 ? ` × ${genVariants} varyant` : ""} üret`}
          </button>
          <div style={{ fontSize: 11, color: MUTE, marginTop: 8 }}>{genTargetCm} cm × {warpDensity} tel/cm ≈ {Math.round(genTargetCm * warpDensity)} tel/rapor · {genGround} zemin + {genBands} bant = {genGround + genBands} renk{!aiSettings.apiKey ? " · AI için Ayarlar'dan anahtar gir" : ""}</div>

          {genError && <div style={{ marginTop: 12, fontSize: 13, color: RED, background: "rgba(255,90,90,0.08)", border: "1px solid rgba(255,90,90,0.3)", borderRadius: 8, padding: "10px 12px" }}>{genError}</div>}

          {designs.map((d, di) => (
            <div key={di} style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${LINE}` }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>Desen {di + 1}</div>
                <button onClick={() => saveDesignAll(d, di)} style={{ ...btn, marginLeft: 8 }}><Save size={14} /> Tümünü kaydet</button>
              </div>
              {renderWayCard(d, d.ways[0], "main", true)}
              {d.ways.length > 1 && (
                <>
                  <div style={{ fontSize: 11, color: MUTE, textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 8px" }}>Varyantlar · {d.ways.length - 1} kolorvari</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                    {d.ways.slice(1).map((w, i) => renderWayCard(d, w, i, false))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        )}
        </>)}

        {/* kayıtlı desenler (ayrı sekme + akordiyon + arama) */}
        {view === "library" && (
        <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 16, marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FolderOpen size={17} color={GOLD} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Kayıtlı desenler ({savedList.length})</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={exportLibrary} disabled={!savedList.length} style={{ ...btn, padding: "6px 10px", opacity: savedList.length ? 1 : 0.5 }}><Download size={14} /> Dışa aktar</button>
              <button onClick={() => importRef.current?.click()} style={{ ...btn, padding: "6px 10px" }}><Upload size={14} /> İçe aktar</button>
              <input ref={importRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importLibrary(f); e.target.value = ""; }} />
            </div>
          </div>
          {savedList.length > 0 && (
            <div style={{ position: "relative", marginBottom: 12 }}>
              <Search size={14} color={MUTE} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} placeholder="Desen adıyla ara…" style={{ width: "100%", boxSizing: "border-box", background: SUNK, border: `1px solid ${LINE}`, color: TEXT, borderRadius: 8, padding: "8px 32px", fontSize: 13 }} />
              {librarySearch && <button onClick={() => setLibrarySearch("")} aria-label="Aramayı temizle" style={{ ...iconBtn, position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", padding: 4, border: "none", background: "transparent" }}><X size={14} /></button>}
            </div>
          )}
          {savedList.length === 0 && <div style={{ fontSize: 12, color: MUTE }}>Henüz kayıt yok. Editörden "Deseni kaydet" ile ekle.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shownDesigns.map((d) => {
              const totalEnds = d.ends.reduce((t, e) => t + e, 0);
              const active = activeDesignId === d.id;
              const open = openDesigns.has(d.id);
              const v0 = d.variants[0];
              return (
                <div key={d.id} style={{ background: SUNK, border: `1px solid ${active ? GOLD : LINE}`, borderRadius: 12, overflow: "hidden" }}>
                  <div onClick={() => toggleOpen(d.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, cursor: "pointer", flexWrap: "wrap" }}>
                    {open ? <ChevronDown size={16} color={MUTE} /> : <ChevronRight size={16} color={MUTE} />}
                    <div style={{ width: 70, flexShrink: 0 }}><MiniStripe segments={d.ends.map((e, i) => ({ ends: e, color: v0.colors[i] }))} height={26} /></div>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{d.name}{active && <span style={{ fontSize: 10, color: GOLD, marginLeft: 6 }}>● aktif</span>}</div>
                      <div style={{ fontSize: 11, color: MUTE, marginTop: 2 }}>{new Date(d.date).toLocaleDateString("tr-TR")} · {totalEnds} tel · {d.variants.length} varyant</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => renameDesignUI(d)} title="Deseni yeniden adlandır" style={{ ...iconBtn, padding: 7 }}><Pencil size={13} /></button>
                      <button onClick={() => addVariantTo(d)} title="Editördeki renkleri bu desene varyant olarak ekle" style={{ ...btn, padding: "6px 10px" }}><Plus size={14} /> Varyant ekle</button>
                      <button onClick={() => removeDesign(d.id)} title="Deseni sil" style={{ ...btn, padding: "6px 10px", color: RED }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {open && (
                    <div style={{ padding: "0 12px 12px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px,1fr))", gap: 10 }}>
                        {d.variants.map((v) => (
                          <div key={v.id} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: 10 }}>
                            <MiniStripe segments={d.ends.map((e, i) => ({ ends: e, color: v.colors[i] }))} height={40} />
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{v.name}</div>
                              <button onClick={() => renameVariantUI(d, v)} title="Varyantı yeniden adlandır" style={{ ...iconBtn, padding: 4 }}><Pencil size={12} /></button>
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                              <button onClick={() => loadVariant(d, v)} style={{ ...btn, flex: 1, padding: "6px 8px", borderColor: TEAL, color: TEAL }}>Yükle</button>
                              <button onClick={() => removeVariant(d.id, v.id)} title="Varyantı sil" style={{ ...btn, padding: "6px 8px", color: RED }}><Trash2 size={13} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {savedList.length > 0 && shownDesigns.length === 0 && <div style={{ fontSize: 12, color: MUTE }}>“{librarySearch}” için desen yok.</div>}
          </div>
        </div>
        )}
      </div>

      {/* editör: hızlı kütüphane çekmecesi (önizlemeyi daraltmaz) */}
      {view === "editor" && !libraryOpen && (
        <button onClick={() => setLibraryOpen(true)} title="Kayıtlı desenler" style={{ position: "fixed", right: 0, top: 150, zIndex: 54, display: "flex", alignItems: "center", gap: 6, background: PANEL, border: `1px solid ${LINE}`, borderRight: "none", borderRadius: "10px 0 0 10px", padding: "10px 12px", cursor: "pointer", color: GOLD, boxShadow: "-2px 2px 12px rgba(0,0,0,0.35)" }}>
          <FolderOpen size={16} /><span style={{ fontSize: 12, fontWeight: 700 }}>{savedList.length}</span>
        </button>
      )}
      {libraryOpen && (
        <div onClick={() => setLibraryOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 56, background: "rgba(0,0,0,0.4)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(330px, 92vw)", background: PANEL, borderLeft: `1px solid ${LINE}`, padding: 14, overflowY: "auto", boxShadow: "-8px 0 28px rgba(0,0,0,0.45)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FolderOpen size={16} color={GOLD} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>Kayıtlı desenler ({savedList.length})</span>
              </div>
              <button onClick={() => setLibraryOpen(false)} aria-label="Kapat" style={iconBtn}><X size={16} /></button>
            </div>
            <button onClick={() => { setView("library"); setLibraryOpen(false); }} style={{ ...btn, width: "100%", padding: "6px 10px", fontSize: 12, marginBottom: 10 }}>Tüm yönetim (sekme) <ArrowRight size={13} /></button>
            {savedList.length > 3 && (
              <div style={{ position: "relative", marginBottom: 10 }}>
                <Search size={13} color={MUTE} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} placeholder="Desen adıyla ara…" style={{ width: "100%", boxSizing: "border-box", background: SUNK, border: `1px solid ${LINE}`, color: TEXT, borderRadius: 8, padding: "7px 8px 7px 28px", fontSize: 12 }} />
              </div>
            )}
            {savedList.length === 0 && <div style={{ fontSize: 12, color: MUTE }}>Henüz kayıt yok. Editörden "Deseni kaydet" ile ekle.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {shownDesigns.map((d) => {
                const v0 = d.variants[0];
                const active = activeDesignId === d.id;
                return (
                  <div key={d.id} onClick={() => { loadVariant(d, v0); setLibraryOpen(false); }} title="Bu deseni yükle (ilk varyant)" style={{ display: "flex", alignItems: "center", gap: 8, background: SUNK, border: `1px solid ${active ? GOLD : LINE}`, borderRadius: 10, padding: 8, cursor: "pointer" }}>
                    <div style={{ width: 60, flexShrink: 0 }}><MiniStripe segments={d.ends.map((e, i) => ({ ends: e, color: v0.colors[i] }))} height={26} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                      <div style={{ fontSize: 10, color: MUTE }}>{d.variants.length} varyant{active ? " · aktif" : ""}</div>
                    </div>
                  </div>
                );
              })}
              {savedList.length > 0 && shownDesigns.length === 0 && <div style={{ fontSize: 11, color: MUTE }}>Eşleşen desen yok.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ayarlar paneli */}
      {showSettings && (
        <div onClick={() => setShowSettings(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, zIndex: 50, overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, width: "100%", maxWidth: 420, marginTop: "8vh", boxShadow: "0 20px 60px rgba(0,0,0,0.45)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Settings size={18} color={GOLD} />
                <span style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>Ayarlar</span>
              </div>
              <button onClick={() => setShowSettings(false)} aria-label="Kapat" style={iconBtn}><X size={16} /></button>
            </div>

            <div style={{ fontSize: 12, color: MUTE, marginBottom: 6 }}>Tema</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {[["dark", "Koyu"], ["light", "Açık"]].map(([v, l]) => (
                <button key={v} onClick={() => setTheme(v)} style={{ ...btn, flex: 1, borderColor: theme === v ? GOLD : LINE, color: theme === v ? GOLD : TEXT, background: theme === v ? "rgba(232,160,48,0.08)" : "transparent" }}>{l}</button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: MUTE, marginBottom: 6 }}>Akıllı desen üretici</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {[[true, "Göster"], [false, "Gizle"]].map(([v, l]) => (
                <button key={l} onClick={() => setShowGenerator(v)} style={{ ...btn, flex: 1, borderColor: showGenerator === v ? GOLD : LINE, color: showGenerator === v ? GOLD : TEXT, background: showGenerator === v ? "rgba(232,160,48,0.08)" : "transparent" }}>{l}</button>
              ))}
            </div>

            <label style={{ fontSize: 12, color: MUTE }}>AI sağlayıcı
              <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)} style={selStyle}>
                <option value="gemini">Gemini (Google)</option>
                <option value="claude">Claude (Anthropic)</option>
              </select>
            </label>

            <label style={{ fontSize: 12, color: MUTE, display: "block", marginTop: 12 }}>Model
              <input type="text" value={aiModel} placeholder={defModel(aiProvider)} onChange={(e) => setAiModel(e.target.value)} style={selStyle} />
            </label>
            <div style={{ fontSize: 11, color: MUTE, marginTop: 4 }}>Boş bırakırsan varsayılan: {defModel(aiProvider)}</div>

            <label style={{ fontSize: 12, color: MUTE, display: "block", marginTop: 12 }}>API anahtarı
              <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                <input type={showKey ? "text" : "password"} value={aiKey} onChange={(e) => setAiKey(e.target.value)} placeholder={aiProvider === "gemini" ? "AIza…" : "sk-ant-…"} autoComplete="off" spellCheck={false} style={{ ...selStyle, marginTop: 0, flex: 1 }} />
                <button onClick={() => setShowKey((s) => !s)} style={iconBtn} title={showKey ? "Gizle" : "Göster"} aria-label={showKey ? "Gizle" : "Göster"}>{showKey ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 11, color: MUTE }}>Anahtar yalnızca bu cihazda saklanır.</span>
              <button onClick={() => { setAiKey(""); setShowKey(false); }} style={{ ...btn, padding: "6px 10px", borderColor: RED, color: RED, flexShrink: 0 }}>Temizle</button>
            </div>

            <button onClick={() => setShowSettings(false)} style={{ ...btn, width: "100%", marginTop: 18, borderColor: GOLD, color: NAVY, background: GOLD, fontWeight: 700 }}>Tamam</button>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 880px){ .gen-grid{ grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); } }
        .cd-preview{ order: -1; }
        button:focus-visible, input:focus-visible, select:focus-visible{ outline:2px solid ${TEAL}; outline-offset:1px; }
        .spin{ animation: spin 0.9s linear infinite; } @keyframes spin{ to{ transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function drawDashed(ctx, repPx, pan, horizontal, W, H, cv) {
  if (!(repPx > 4)) return;
  ctx.strokeStyle = cv.dash; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  let start = -((pan % repPx + repPx) % repPx);
  const lim = horizontal ? H : W;
  for (let p = start; p < lim; p += repPx) {
    if (p < 0) continue;
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(0, p); ctx.lineTo(W, p); } else { ctx.moveTo(p, 0); ctx.lineTo(p, H); }
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawRuler(ctx, W, H, unit, panX, cv) {
  const band = 16;
  ctx.fillStyle = cv.ruler; ctx.fillRect(0, 0, W, band);
  ctx.strokeStyle = cv.tickLine; ctx.fillStyle = cv.tick;
  ctx.lineWidth = 1; ctx.font = "9px ui-sans-serif, system-ui, sans-serif"; ctx.textBaseline = "top";
  const mm = unit / 10;                 // px / mm
  if (mm <= 0) return;
  const showMm = mm >= 5;               // mm tikleri ancak yeterince aralıklıysa
  const labelEvery = unit > 34 ? 1 : 5; // cm yeterince genişse her cm, değilse her 5 cm
  let i = Math.floor(panX / mm);        // mm indeksi
  for (let x = -((panX % mm + mm) % mm); x < W; x += mm, i++) {
    const isCm = i % 10 === 0, isHalf = i % 5 === 0;
    if (!isCm && !isHalf && !showMm) continue;            // ara mm'leri sıkışıksa atla
    const h = isCm ? band : (isHalf ? band * 0.62 : band * 0.4);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    if (isCm) { const cm = Math.round(i / 10); if (cm % labelEvery === 0 && unit > 14) ctx.fillText(String(cm), x + 2, 3); }
  }
}

function hexToRgb(h) {
  h = String(h).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length < 6) h = h.padEnd(6, "0");
  const n = parseInt(h.slice(0, 6), 16);
  if (isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function colorDist(a, b) { const x = hexToRgb(a), y = hexToRgb(b); return (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2; }
// segmentleri en çok kullanılan K renge indirger; yakın tonları en yakına birleştirir
function quantize(segs, K) {
  const area = {}; segs.forEach((s) => { area[s.color] = (area[s.color] || 0) + s.ends; });
  const colors = Object.keys(area).sort((a, b) => area[b] - area[a]);
  if (colors.length <= K) return { segs, keep: colors };
  const keep = colors.slice(0, K);
  const map = {};
  colors.forEach((c) => {
    if (keep.includes(c)) { map[c] = c; return; }
    let best = keep[0], bd = Infinity;
    keep.forEach((k) => { const d = colorDist(c, k); if (d < bd) { bd = d; best = k; } });
    map[c] = best;
  });
  const merged = segs.map((s) => ({ color: map[s.color], ends: s.ends }));
  const out = [];
  for (const s of merged) { const last = out[out.length - 1]; if (last && last.color === s.color) last.ends += s.ends; else out.push({ ...s }); }
  return { segs: out, keep };
}

// ticari perdelik renk koleksiyonu (arka planda hex/Lab, görünürde ad)
const NAMED_COLORS = [
  // nötr zeminler (açık → koyu)
  { name: "Kar beyazı", hex: "#FCFAF5" }, { name: "Kırık beyaz", hex: "#F4F1E8" }, { name: "Fildişi", hex: "#F0E9DA" },
  { name: "Krem", hex: "#EFE6D3" }, { name: "Ekru", hex: "#E9DFC9" }, { name: "Keten", hex: "#E5D9C3" },
  { name: "Şampanya", hex: "#E7D6B0" }, { name: "Kum", hex: "#DEC9A6" }, { name: "Bej", hex: "#D7C2A0" },
  { name: "Taş", hex: "#CFC3AE" }, { name: "Greige", hex: "#BCAF99" }, { name: "Vizon", hex: "#A8967C" },
  { name: "Açık gri", hex: "#D6D8DA" }, { name: "Gümüş gri", hex: "#C2C6C9" }, { name: "Güvercin grisi", hex: "#A6AAAD" },
  { name: "Çelik grisi", hex: "#7C8388" }, { name: "Antrasit", hex: "#3C4248" }, { name: "Onyx", hex: "#1A1C1E" },
  // sıcak aksanlar
  { name: "Altın", hex: "#C9A24B" }, { name: "Hardal", hex: "#B8862B" }, { name: "Karamel", hex: "#A9743D" },
  { name: "Taba", hex: "#8C5E33" }, { name: "Kiremit", hex: "#B05539" }, { name: "Tarçın", hex: "#8A4B33" },
  { name: "Pudra", hex: "#E3C7C2" }, { name: "Gül kurusu", hex: "#B98B89" }, { name: "Bordo", hex: "#6E2230" },
  // soğuk / yeşil
  { name: "Lacivert", hex: "#1F2A40" }, { name: "Gece mavisi", hex: "#142235" }, { name: "Denim", hex: "#5E7C99" },
  { name: "Petrol", hex: "#1E5A62" }, { name: "Adaçayı", hex: "#8FA08A" }, { name: "Zeytin", hex: "#6E6E45" },
  { name: "Haki", hex: "#7C744E" }, { name: "Orman yeşili", hex: "#2F4733" },
];
function rgb2lab([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const f = (v) => (v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92);
  r = f(r); g = f(g); b = f(b);
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722);
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  x = t(x); y = t(y); z = t(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
NAMED_COLORS.forEach((c) => { c._lab = rgb2lab(hexToRgb(c.hex)); });
// zemin adayları (açık/nötr) ve aksan adayları (tüm ticari koleksiyon)
const GROUND_NAMES = ["Kar beyazı", "Kırık beyaz", "Fildişi", "Krem", "Ekru", "Keten", "Şampanya", "Kum", "Bej", "Taş", "Greige", "Vizon", "Açık gri", "Gümüş gri", "Güvercin grisi"];
const GROUND_CANDIDATES = NAMED_COLORS.filter((c) => GROUND_NAMES.includes(c.name));
const ACCENT_CANDIDATES = NAMED_COLORS;
const _nameCache = {};
function nameOf(hex) {
  if (!hex) return "";
  const key = String(hex).toLowerCase();
  if (_nameCache[key]) return _nameCache[key];
  const lab = rgb2lab(hexToRgb(hex));
  let best = NAMED_COLORS[0], bd = Infinity;
  for (const c of NAMED_COLORS) { const d = (lab[0] - c._lab[0]) ** 2 + (lab[1] - c._lab[1]) ** 2 + (lab[2] - c._lab[2]) ** 2; if (d < bd) { bd = d; best = c; } }
  _nameCache[key] = best.name;
  return best.name;
}

function closeJson(s) {
  let cur = 0, sq = 0, inStr = false, esc = false;
  for (const c of s) {
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") cur++; else if (c === "}") cur--; else if (c === "[") sq++; else if (c === "]") sq--;
  }
  let out = s;
  while (sq-- > 0) out += "]";
  while (cur-- > 0) out += "}";
  return out;
}
function parseDesign(text) {
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const tp = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
  let p = tp(t); if (p) return p;
  const lb = t.lastIndexOf("}"); if (lb < 0) return null;
  let s = t.slice(0, lb + 1).replace(/,\s*$/, "");
  return tp(closeJson(s));
}

function parseAlts(text) {
  let t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const tryParse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
  let p = tryParse(t);
  if (p) return p.a || p.alternatives || [];
  const aStart = t.indexOf("[");
  if (aStart < 0) return [];
  // yarıda kesilmiş JSON: son tam '}' konumuna kadar al, diziyi/objeyi kapat
  for (let end = t.lastIndexOf("}"); end > aStart; end = t.lastIndexOf("}", end - 1)) {
    p = tryParse(t.slice(0, end + 1) + "]}");
    if (p && (p.a || p.alternatives)) return p.a || p.alternatives;
  }
  return [];
}

function MiniStripe({ segments, height = 52 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = c.clientWidth, H = height;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const total = segments.reduce((t, x) => t + (x.ends || 0), 0) || 1;
    const ppe = W / total;
    let x = 0;
    for (const s of segments) { const w = (s.ends || 0) * ppe; ctx.fillStyle = s.color; ctx.fillRect(x, 0, w + 0.6, H); x += w; }
  }, [segments, height]);
  return <div style={{ width: "100%", borderRadius: 8, overflow: "hidden", border: `1px solid ${LINE}` }}><canvas ref={ref} style={{ display: "block", width: "100%", height }} /></div>;
}

function NumInput({ value, onCommit, decimals = 0, suffix, width = 60, block = false }) {
  const fmtV = (v) => (decimals > 0 ? trimNum(v, decimals) : String(Math.round(v)));
  const [txt, setTxt] = useState(fmtV(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTxt(fmtV(value)); }, [value]); // eslint-disable-line
  return (
    <span style={{ display: block ? "flex" : "inline-flex", width: block ? "100%" : "auto", alignItems: "center", gap: 3 }} onClick={(e) => e.stopPropagation()}>
      <input type="number" inputMode="decimal" value={txt}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; setTxt(fmtV(value)); }}
        onChange={(e) => { setTxt(e.target.value); const n = parseFloat(e.target.value); if (!isNaN(n)) onCommit(n); }}
        style={{ width: block ? "100%" : width, background: SUNK, border: `1px solid ${LINE}`, color: TEXT, borderRadius: 6, padding: "8px 10px", fontSize: 14, textAlign: block ? "left" : "right", boxSizing: "border-box" }} />
      {suffix && <span style={{ fontSize: 11, color: MUTE }}>{suffix}</span>}
    </span>
  );
}

function FieldNum({ label, value, onCommit, decimals = 0 }) {
  return (<label style={{ fontSize: 12, color: MUTE }}>{label}<div style={{ marginTop: 5 }}><NumInput value={value} onCommit={onCommit} decimals={decimals} block /></div></label>);
}

function Stat({ label, value, accent }) {
  return (<div style={{ background: SUNK, border: `1px solid ${LINE}`, borderRadius: 10, padding: "10px 12px" }}><div style={{ fontSize: 10.5, color: MUTE, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div><div style={{ fontSize: 18, fontWeight: 700, color: accent, marginTop: 3 }}>{value}</div></div>);
}
