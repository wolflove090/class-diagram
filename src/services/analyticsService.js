class AnalyticsService {
  constructor({
    endpointUrl = "",
    clientIdKey = "design-maker-analytics-client-id",
    sentDateKey = "design-maker-analytics-last-sent-date",
    timeZone = "Asia/Tokyo"
  } = {}) {
    this.endpointUrl = endpointUrl;
    this.clientIdKey = clientIdKey;
    this.sentDateKey = sentDateKey;
    this.timeZone = timeZone;
  }

  trackPageView() {
    if (!this.endpointUrl) return;

    const today = this.getToday();
    if (localStorage.getItem(this.sentDateKey) === today) return;

    const payload = { clientId: this.getClientId() };

    fetch(this.endpointUrl, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then(() => localStorage.setItem(this.sentDateKey, today))
      .catch(() => {
        // KPI送信に失敗しても、ツール本体の操作は妨げない。
      });
  }

  getClientId() {
    const currentId = localStorage.getItem(this.clientIdKey);
    if (currentId) return currentId;

    const nextId = this.createClientId();
    localStorage.setItem(this.clientIdKey, nextId);
    return nextId;
  }

  createClientId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();

    const randomValues = new Uint32Array(4);
    window.crypto?.getRandomValues?.(randomValues);
    const randomPart = Array.from(randomValues, (value) => value.toString(16)).join("-");
    return `client-${Date.now().toString(16)}-${randomPart || Math.random().toString(16).slice(2)}`;
  }

  getToday() {
    const parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: this.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  }
}
