class ModalView {
  constructor(rootElement) {
    this.root = rootElement;
    this.handlers = {};
  }

  bindEvents(handlers) {
    this.handlers = handlers;
  }

  close() {
    this.root.hidden = true;
    clearChildren(this.root);
  }

  showImport() {
    this.root.hidden = false;
    const textarea = createElement("textarea", {
      rows: 16,
      placeholder: "classDiagram\n  User --> Order"
    });
    const form = createElement("form", { class: "modal-panel" }, [
      createElement("h2", {}, ["Mermaidインポート"]),
      textarea,
      createElement("div", { class: "modal-actions" }, [
        createElement("button", { type: "submit" }, ["取り込む"]),
        createElement("button", { type: "button", onclick: () => this.close() }, ["キャンセル"])
      ])
    ]);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handlers.onImportSubmit?.(textarea.value);
    });
    clearChildren(this.root);
    this.root.append(form);
  }

  showExport(text) {
    this.root.hidden = false;
    const textarea = createElement("textarea", { rows: 18, readonly: true }, [text]);
    clearChildren(this.root);
    this.root.append(createElement("div", { class: "modal-panel" }, [
      createElement("h2", {}, ["Mermaidエクスポート"]),
      textarea,
      createElement("div", { class: "modal-actions" }, [
        createElement("button", {
          type: "button",
          onclick: async () => {
            await navigator.clipboard?.writeText(text);
            this.handlers.onNotice?.("コピーしました");
          }
        }, ["コピー"]),
        createElement("button", { type: "button", onclick: () => this.close() }, ["閉じる"])
      ])
    ]));
    textarea.select();
  }

  showError(message) {
    this.root.hidden = false;
    clearChildren(this.root);
    this.root.append(createElement("div", { class: "modal-panel" }, [
      createElement("h2", {}, ["エラー"]),
      createElement("p", { class: "error-message" }, [message]),
      createElement("div", { class: "modal-actions" }, [
        createElement("button", { type: "button", onclick: () => this.close() }, ["閉じる"])
      ])
    ]));
  }

  confirm(message, onConfirm) {
    this.root.hidden = false;
    clearChildren(this.root);
    this.root.append(createElement("div", { class: "modal-panel" }, [
      createElement("h2", {}, ["確認"]),
      createElement("p", {}, [message]),
      createElement("div", { class: "modal-actions" }, [
        createElement("button", {
          type: "button",
          class: "danger",
          onclick: () => {
            this.close();
            onConfirm();
          }
        }, ["実行"]),
        createElement("button", { type: "button", onclick: () => this.close() }, ["キャンセル"])
      ])
    ]));
  }
}
