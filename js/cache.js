// ╔══════════════════════════════════════════════════════════════╗
// ║  FútbolStats AI — cache.js                                 ║
// ║  Persistent LRU cache with in-memory layer                 ║
// ╚══════════════════════════════════════════════════════════════╝

window.FStats = window.FStats || {};

FStats.CacheManager = {
  MAX_ENTRIES: 50,
  TTL_MS: 24 * 60 * 60 * 1000, // 24h
  STORAGE_KEY: 'fstats_cache_v3',
  _memCache: null,
  _saveTimer: null,

  _normalize(q) {
    return q.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip accents
      .replace(/[¿?¡!.,;:'"()]/g, '')                     // strip punctuation
      .replace(/\b(el|la|los|las|de|del|en|un|una|por|con|que|y|o|a)\b/g, '') // strip stopwords
      .replace(/\s+/g, ' ').trim();
  },

  _key(query, leagues) {
    const norm = this._normalize(query);
    const ln = Array.isArray(leagues) ? leagues.sort().join('+') : (leagues || '');
    return (norm + '||' + ln).substring(0, 150);
  },

  _load() {
    if (this._memCache) return this._memCache;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) { this._memCache = {}; return {}; }
      const parsed = JSON.parse(raw);
      const now = Date.now();
      for (const k of Object.keys(parsed)) {
        if (now - (parsed[k].ts || 0) > this.TTL_MS) delete parsed[k];
      }
      this._memCache = parsed;
      return parsed;
    } catch (err) {
      console.warn('[CacheManager] Error loading cache:', err);
      this._memCache = {};
      return {};
    }
  },

  _save(cache) {
    this._memCache = cache;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      try {
        const entries = Object.entries(cache).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
        const trimmed = Object.fromEntries(entries.slice(0, this.MAX_ENTRIES));
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
      } catch (err) {
        console.warn('[CacheManager] Error saving cache:', err);
        try { localStorage.removeItem(this.STORAGE_KEY); } catch (e2) {
          console.warn('[CacheManager] Could not clear cache:', e2);
        }
      }
    }, 300);
  },

  get(query, leagues) {
    const cache = this._load();
    const k = this._key(query, leagues);
    const entry = cache[k];
    if (entry && (Date.now() - (entry.ts || 0) < this.TTL_MS)) {
      entry.ts = Date.now(); // refresh access time
      this._save(cache);
      return entry.v;
    }
    return null;
  },

  set(query, leagues, value) {
    const cache = this._load();
    const k = this._key(query, leagues);
    cache[k] = { v: value, ts: Date.now() };
    this._save(cache);
  }
};
