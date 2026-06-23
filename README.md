# Çizgi Simülatör

Perdelik **çözgü çizgi** tasarım ve **1:1 simülatör** aracı — tamamen bağımsız, backend'siz bir
PWA. Tüm mantık tarayıcıda çalışır, veriler cihazda (`localStorage`) saklanır.

- **Manuel araç** internetsiz çalışır: çizgi editörü, kalibrasyon (gerçek 1:1 ölçek), çözgü
  hazırlık tabloları, renk adlandırma, PNG dışa aktarma.
- **Akıllı desen üretici (opsiyonel AI):** kendi API anahtarını **Ayarlar**'dan girersin
  (Gemini veya Claude). Anahtar yalnızca bu cihazda saklanır; yoksa üretici uyarı verir, gerisi
  çalışır.
- **Açık / koyu tema**, tablet düzeni ve **ana ekrana eklenebilir** PWA.

## Geliştirme

Proje `cozgu-cizgi/` klasöründedir.

```bash
cd cozgu-cizgi
npm install
npm run dev      # geliştirme sunucusu
npm run build    # üretim derlemesi → cozgu-cizgi/dist
npm run preview  # derlemeyi yerelde önizle (PWA testi)
```

İkonları yeniden üretmek (marka logonu `public/icon-192.png` & `public/icon-512.png` ile
değiştirebilirsin):

```bash
node scripts/gen-icons.mjs
```

## AI anahtarı

Ayarlar (dişli ikonu) → sağlayıcı (Gemini/Claude) + model + API anahtarı. Anahtar `localStorage`
içinde (`ccd:aiKey`) tutulur, koda gömülmez. Anahtarı Google/Anthropic panelinden origin/referrer
kısıtlı yapman önerilir.

## Dağıtım (Netlify)

Repo kökündeki `netlify.toml` ayarı subklasörü hedefler (`base = "cozgu-cizgi"`, `publish = dist`).
Netlify'da **New site from Git → bu repo** seç; derleme otomatik çalışır. Yayınlanan adresi
tablette aç → tarayıcı menüsü → **Ana ekrana ekle**.
