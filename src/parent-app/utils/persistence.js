const PREFIX = "parentApp:";

export function loadPersisted(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function savePersisted(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage can fail (private browsing, quota, etc.) — the app should
    // keep working in-memory even if persistence silently doesn't happen.
  }
}

export function removePersisted(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Same as above — never let storage failures break the app.
  }
}
