// localStorage tabanlı, eski window.storage API'sini taklit eden basit adaptör.
// Tüm anahtarlar "ccd:" ön ekiyle saklanır.
const KEY = (k) => `ccd:${k}`;

export const storage = {
  async get(k) {
    const v = localStorage.getItem(KEY(k));
    return v == null ? null : { key: k, value: v };
  },
  async set(k, v) {
    localStorage.setItem(KEY(k), String(v));
    return { key: k, value: String(v) };
  },
  async delete(k) {
    localStorage.removeItem(KEY(k));
    return { key: k, deleted: true };
  },
};
