const visibilityOptions = [
  ["public", "public"],
  ["protected", "protected"],
  ["private", "private"],
  ["package", "package"]
];

const classKindOptions = [
  ["class", "class"],
  ["abstract", "abstract"],
  ["interface", "interface"],
  ["enum", "enum"]
];

const relationshipOptions = [
  ["inheritance", "継承"],
  ["implementation", "実装"],
  ["dependency", "依存"],
  ["association", "関連"],
  ["aggregation", "集約"],
  ["composition", "コンポジション"],
  ["link", "実線リンク"],
  ["dashedLink", "破線リンク"]
];

class InspectorView {
  constructor(rootElement) {
    this.root = rootElement;
    this.handlers = {};
    this.isCollapsed = false;
    this.lastState = null;
  }

  bindEvents(handlers) {
    this.handlers = handlers;
  }

  render(state) {
    this.lastState = state;
    this.syncCollapsedClass();
    clearChildren(this.root);
    this.root.append(this.renderHeader(this.getTitle(state)));
    if (this.isCollapsed) return;

    const selection = state.selection;
    if (!selection) {
      this.root.append(createElement("p", { class: "muted" }, ["クラスまたは接続線を選択してください。"]));
      return;
    }
    if (selection.type === "class") {
      const classNode = state.classes.find((item) => item.id === selection.id);
      if (classNode) this.renderClass(classNode);
      return;
    }
    if (selection.type === "classes") {
      this.renderClassGroup(selection.ids, state.classes);
      return;
    }
    if (selection.type === "relationship") {
      const relationship = state.relationships.find((item) => item.id === selection.id);
      if (relationship) this.renderRelationship(relationship, state.classes);
    }
  }

  renderClassGroup(classIds, classes) {
    const selected = classes.filter((classNode) => classIds.includes(classNode.id));
    this.root.append(
      createElement("p", { class: "muted" }, [`${selected.length} 件のクラスを選択中です。ドラッグでまとめて移動できます。`])
    );
  }

  renderClass(classNode) {
    const form = createElement("form", { class: "inspector-form" });
    form.append(
      field("名前", createElement("input", { name: "name", value: classNode.name })),
      field("種別", select("kind", classKindOptions, classNode.kind)),
      field("ステレオタイプ", createElement("input", { name: "stereotype", value: classNode.stereotype })),
      field("可視性", select("visibility", visibilityOptions, classNode.visibility)),
      checkboxField("抽象", "isAbstract", classNode.isAbstract),
      createElement("button", { type: "submit" }, ["クラスを更新"])
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      this.handlers.onClassUpdate?.(classNode.id, {
        name: data.get("name").trim() || "Class",
        kind: data.get("kind"),
        stereotype: data.get("stereotype").trim(),
        visibility: data.get("visibility"),
        isAbstract: data.get("isAbstract") === "on"
      });
    });

    this.root.append(form);
    this.root.append(this.renderProperties(classNode));
    this.root.append(this.renderMethods(classNode));
  }

  renderProperties(classNode) {
    const section = createElement("section", { class: "inspector-section" }, [
      createElement("h3", {}, ["プロパティ"]),
      createElement("button", {
        type: "button",
        onclick: () => this.handlers.onPropertyAdd?.(classNode.id)
      }, ["追加"])
    ]);
    for (const property of classNode.properties) {
      const form = createElement("form", { class: "member-form" });
      form.append(
        field("名前", createElement("input", { name: "name", value: property.name })),
        field("型", createElement("input", { name: "type", value: property.type })),
        field("可視性", select("visibility", visibilityOptions, property.visibility)),
        field("初期値", createElement("input", { name: "defaultValue", value: property.defaultValue })),
        checkboxField("static", "isStatic", property.isStatic),
        checkboxField("readonly", "isReadonly", property.isReadonly),
        checkboxField("abstract", "isAbstract", property.isAbstract),
        memberButtons(
          () => this.submitProperty(form, classNode.id, property.id),
          () => this.handlers.onPropertyMove?.(classNode.id, property.id, -1),
          () => this.handlers.onPropertyMove?.(classNode.id, property.id, 1),
          () => this.handlers.onPropertyDelete?.(classNode.id, property.id)
        )
      );
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.submitProperty(form, classNode.id, property.id);
      });
      section.append(form);
    }
    return section;
  }

  renderMethods(classNode) {
    const section = createElement("section", { class: "inspector-section" }, [
      createElement("h3", {}, ["メソッド"]),
      createElement("button", {
        type: "button",
        onclick: () => this.handlers.onMethodAdd?.(classNode.id)
      }, ["追加"])
    ]);
    for (const method of classNode.methods) {
      const form = createElement("form", { class: "member-form" });
      form.append(
        field("名前", createElement("input", { name: "name", value: method.name })),
        field("戻り値", createElement("input", { name: "returnType", value: method.returnType })),
        field("可視性", select("visibility", visibilityOptions, method.visibility)),
        field("パラメータ", createElement("input", {
          name: "parameters",
          value: method.parameters.map((param) => `${param.name}${param.isOptional ? "?" : ""}${param.type ? `: ${param.type}` : ""}`).join(", "),
          placeholder: "id: string, count?: number"
        })),
        checkboxField("static", "isStatic", method.isStatic),
        checkboxField("abstract", "isAbstract", method.isAbstract),
        checkboxField("async", "isAsync", method.isAsync),
        memberButtons(
          () => this.submitMethod(form, classNode.id, method.id),
          () => this.handlers.onMethodMove?.(classNode.id, method.id, -1),
          () => this.handlers.onMethodMove?.(classNode.id, method.id, 1),
          () => this.handlers.onMethodDelete?.(classNode.id, method.id)
        )
      );
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.submitMethod(form, classNode.id, method.id);
      });
      section.append(form);
    }
    return section;
  }

  renderRelationship(relationship, classes) {
    const form = createElement("form", { class: "inspector-form" });
    form.append(
      field("種別", select("type", relationshipOptions, relationship.type)),
      field("接続元", select("sourceClassId", classes.map((classNode) => [classNode.id, classNode.name]), relationship.sourceClassId)),
      field("接続先", select("targetClassId", classes.map((classNode) => [classNode.id, classNode.name]), relationship.targetClassId)),
      field("ラベル", createElement("input", { name: "label", value: relationship.label })),
      field("元多重度", createElement("input", { name: "sourceMultiplicity", value: relationship.sourceMultiplicity })),
      field("先多重度", createElement("input", { name: "targetMultiplicity", value: relationship.targetMultiplicity })),
      createElement("button", { type: "submit" }, ["関係を更新"])
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      this.handlers.onRelationshipUpdate?.(relationship.id, {
        type: data.get("type"),
        sourceClassId: data.get("sourceClassId"),
        targetClassId: data.get("targetClassId"),
        label: data.get("label").trim(),
        sourceMultiplicity: data.get("sourceMultiplicity").trim(),
        targetMultiplicity: data.get("targetMultiplicity").trim()
      });
    });
    this.root.append(form);
  }

  renderHeader(title) {
    const label = this.isCollapsed ? "▶︎" : `◀︎ ${title}`;
    return createElement("h2", { class: "inspector-heading" }, [
      createElement("button", {
        type: "button",
        class: "inspector-toggle",
        "aria-expanded": String(!this.isCollapsed),
        "aria-label": this.isCollapsed ? "インスペクターを展開" : "インスペクターを折りたたみ",
        onclick: () => this.toggleCollapsed()
      }, [label])
    ]);
  }

  getTitle(state) {
    const selection = state.selection;
    if (!selection) return "インスペクター";
    if (selection.type === "class") return "クラス";
    if (selection.type === "classes") return "クラス複数選択";
    if (selection.type === "relationship") return "関係";
    return "インスペクター";
  }

  toggleCollapsed() {
    this.isCollapsed = !this.isCollapsed;
    if (this.lastState) this.render(this.lastState);
  }

  syncCollapsedClass() {
    this.root.classList.toggle("is-collapsed", this.isCollapsed);
    this.root.parentElement?.classList.toggle("inspector-collapsed", this.isCollapsed);
  }

  submitProperty(form, classId, propertyId) {
    const data = new FormData(form);
    this.handlers.onPropertyUpdate?.(classId, propertyId, {
      name: data.get("name").trim() || "property",
      type: data.get("type").trim(),
      visibility: data.get("visibility"),
      defaultValue: data.get("defaultValue").trim(),
      isStatic: data.get("isStatic") === "on",
      isReadonly: data.get("isReadonly") === "on",
      isAbstract: data.get("isAbstract") === "on"
    });
  }

  submitMethod(form, classId, methodId) {
    const data = new FormData(form);
    this.handlers.onMethodUpdate?.(classId, methodId, {
      name: data.get("name").trim() || "method",
      returnType: data.get("returnType").trim(),
      visibility: data.get("visibility"),
      parameters: parseParameterInput(data.get("parameters")),
      isStatic: data.get("isStatic") === "on",
      isAbstract: data.get("isAbstract") === "on",
      isAsync: data.get("isAsync") === "on"
    });
  }
}

function field(labelText, control) {
  return createElement("label", { class: "field" }, [
    createElement("span", {}, [labelText]),
    control
  ]);
}

function checkboxField(labelText, name, checked) {
  return createElement("label", { class: "checkbox-field" }, [
    createElement("input", { type: "checkbox", name, checked }),
    createElement("span", {}, [labelText])
  ]);
}

function select(name, options, selected) {
  return createElement("select", { name }, options.map(([value, label]) => (
    createElement("option", { value, selected: value === selected }, [label])
  )));
}

function memberButtons(onSave, onUp, onDown, onDelete) {
  return createElement("div", { class: "member-buttons" }, [
    createElement("button", { type: "button", onclick: onSave }, ["更新"]),
    createElement("button", { type: "button", onclick: onUp }, ["↑"]),
    createElement("button", { type: "button", onclick: onDown }, ["↓"]),
    createElement("button", { type: "button", class: "danger", onclick: onDelete }, ["削除"])
  ]);
}

function parseParameterInput(raw) {
  if (!String(raw).trim()) return [];
  return String(raw).split(",").map((part) => {
    const [namePart, type = ""] = part.trim().split(/\s*:\s*/, 2);
    return {
      name: namePart.replace(/\?$/, "").trim() || "value",
      type: type.trim(),
      defaultValue: "",
      isOptional: namePart.trim().endsWith("?")
    };
  });
}
