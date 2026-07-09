class StorageService {
  constructor(storageKey = "class-diagram-maker-state") {
    this.storageKey = storageKey;
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return { state: null, error: null };
      return { state: JSON.parse(raw), error: null };
    } catch (error) {
      return { state: null, error };
    }
  }

  save(state) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(state));
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error };
    }
  }

  clear() {
    localStorage.removeItem(this.storageKey);
  }
}
