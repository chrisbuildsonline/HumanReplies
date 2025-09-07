// Centralized logging utility that buffers logs to storage for post-mortem inspection
(function () {
  const MAX_LOGS = 500;
  const KEY = "HR_LOG_BUFFER";
  function ts() {
    return new Date().toISOString();
  }
  async function append(entry) {
    try {
      const existing = await new Promise((r) =>
        chrome.storage.local.get([KEY], r)
      );
      const arr = existing[KEY] || [];
      arr.push(entry);
      while (arr.length > MAX_LOGS) arr.shift();
      chrome.storage.local.set({ [KEY]: arr });
    } catch (e) {
      // ignore
    }
  }
  function wrap(method) {
    const orig = console[method].bind(console);
    console[method] = function (...args) {
      try {
        append({
          t: ts(),
          level: method,
          msg: args
            .map((a) => {
              try {
                return typeof a === "object" ? JSON.stringify(a) : String(a);
              } catch {
                return String(a);
              }
            })
            .join(" "),
        });
      } catch (e) {}
      orig(...args);
    };
  }
  ["log", "info", "warn", "error"].forEach(wrap);
  window.HRLogger = {
    dump: () =>
      new Promise((r) =>
        chrome.storage.local.get([KEY], (res) => r(res[KEY] || []))
      ),
  };
})();
