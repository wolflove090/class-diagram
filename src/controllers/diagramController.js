class DiagramController {
  constructor(elements) {
    this.elements = elements;
    this.model = new DiagramModel();
    this.storage = new StorageService();
    this.parser = new MermaidParser();
    this.serializer = new MermaidSerializer();
    this.layout = new LayoutService();
    this.renderer = new SvgRenderer(elements.svg);
    this.inspector = new InspectorView(elements.inspector);
    this.modal = new ModalView(elements.modalRoot);
    this.state = this.model.createInitialState();
    this.connectMode = false;
    this.connectSourceId = null;
    this.undoStack = [];
    this.pendingHistoryState = null;
  }

  init() {
    const loaded = this.storage.load();
    if (loaded.state) {
      this.state = this.model.normalizeState(loaded.state);
    } else {
      this.state = this.seedInitialState();
    }
    if (loaded.error) this.modal.showError("保存データを復元できませんでした。新しい図で開始します。");
    this.bindToolbar();
    this.bindViews();
    this.render();
  }

  seedInitialState() {
    let state = this.model.createInitialState();
    state = this.model.addClass(state, { name: "User", position: { x: 100, y: 90 } });
    state = this.model.addClass(state, { name: "Order", position: { x: 420, y: 260 } });
    const user = state.classes[0];
    const order = state.classes[1];
    state = this.model.updateClass(state, user.id, {
      properties: [this.model.createProperty({ name: "id", type: "string", isReadonly: true })],
      methods: [this.model.createMethod({ name: "getName", returnType: "string" })]
    });
    state = this.model.addRelationship(state, {
      sourceClassId: user.id,
      targetClassId: order.id,
      type: "association",
      label: "places"
    });
    return this.model.select(state, { type: "class", id: user.id });
  }

  bindToolbar() {
    this.elements.addClassButton.addEventListener("click", () => this.addClass());
    this.elements.connectModeButton.addEventListener("click", () => this.toggleConnectMode());
    this.elements.undoButton.addEventListener("click", () => this.undo());
    this.elements.deleteButton.addEventListener("click", () => this.deleteSelected());
    this.elements.importButton.addEventListener("click", () => this.modal.showImport());
    this.elements.exportButton.addEventListener("click", () => this.modal.showExport(this.serializer.serialize(this.state)));
    this.elements.resetViewButton.addEventListener("click", () => this.updateState(this.model.updateViewport(this.state, { x: 0, y: 0, scale: 1 })));
    this.elements.zoomInButton.addEventListener("click", () => this.zoom(1));
    this.elements.zoomOutButton.addEventListener("click", () => this.zoom(-1));
    this.elements.clearButton.addEventListener("click", () => {
      this.modal.confirm("現在の編集状態をクリアします。", () => {
        this.storage.clear();
        this.connectSourceId = null;
        this.connectMode = false;
        this.updateState(this.model.createInitialState());
        this.notice("クリアしました");
      });
    });
    window.addEventListener("keydown", (event) => {
      const isUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey;
      if (isUndo && !isTextEditingElement(document.activeElement)) {
        event.preventDefault();
        this.undo();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (!["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
          this.deleteSelected();
        }
      }
    });
  }

  bindViews() {
    this.renderer.bindEvents({
      onClassClick: (classId) => this.handleClassClick(classId),
      onRelationshipClick: (relationshipId) => this.updateState(this.model.select(this.state, { type: "relationship", id: relationshipId }), false),
      onCanvasClick: () => this.updateState(this.model.select(this.state, null), false),
      onClassRangeSelect: (classIds) => this.selectClasses(classIds),
      onClassDrag: (positions) => this.updateClassPositions(positions),
      onClassDragEnd: (classIds) => {
        this.selectClasses(classIds);
        this.commitPendingHistory();
      },
      onClassResize: (classId, size) => this.updateClassSize(classId, size),
      onClassResizeEnd: (classId, moved) => this.finishClassResize(classId, moved),
      onViewportChange: (viewport) => this.updateState(this.model.updateViewport(this.state, viewport), false),
      onZoom: (request, center) => this.zoom(request, center)
    });
    this.inspector.bindEvents({
      onClassUpdate: (id, patch) => this.updateState(this.model.updateClass(this.state, id, patch)),
      onRelationshipUpdate: (id, patch) => this.updateState(this.model.updateRelationship(this.state, id, patch)),
      onPropertyAdd: (classId) => this.updateClassList(classId, "properties", (items) => [...items, this.model.createProperty()]),
      onPropertyUpdate: (classId, propertyId, patch) => this.updateClassList(classId, "properties", (items) => items.map((item) => item.id === propertyId ? { ...item, ...patch } : item)),
      onPropertyDelete: (classId, propertyId) => this.updateClassList(classId, "properties", (items) => items.filter((item) => item.id !== propertyId)),
      onPropertyMove: (classId, propertyId, direction) => this.updateClassList(classId, "properties", (items) => moveItem(items, propertyId, direction)),
      onMethodAdd: (classId) => this.updateClassList(classId, "methods", (items) => [...items, this.model.createMethod()]),
      onMethodUpdate: (classId, methodId, patch) => this.updateClassList(classId, "methods", (items) => items.map((item) => (
        item.id === methodId ? { ...item, ...patch, parameters: patch.parameters.map((parameter) => this.model.createParameter(parameter)) } : item
      ))),
      onMethodDelete: (classId, methodId) => this.updateClassList(classId, "methods", (items) => items.filter((item) => item.id !== methodId)),
      onMethodMove: (classId, methodId, direction) => this.updateClassList(classId, "methods", (items) => moveItem(items, methodId, direction))
    });
    this.modal.bindEvents({
      onImportSubmit: (text) => this.importMermaid(text),
      onNotice: (message) => this.notice(message)
    });
  }

  addClass() {
    const x = (160 - this.state.viewport.x) / this.state.viewport.scale + this.state.classes.length * 18;
    const y = (120 - this.state.viewport.y) / this.state.viewport.scale + this.state.classes.length * 18;
    this.updateState(this.model.addClass(this.state, { position: { x, y } }));
  }

  toggleConnectMode() {
    this.connectMode = !this.connectMode;
    this.connectSourceId = null;
    this.elements.connectModeButton.setAttribute("aria-pressed", String(this.connectMode));
    this.notice(this.connectMode ? "接続元のクラスを選択してください" : "");
    this.render();
  }

  handleClassClick(classId) {
    if (!this.connectMode) {
      this.updateState(this.model.select(this.state, { type: "class", id: classId }), false);
      return;
    }
    if (!this.connectSourceId) {
      this.connectSourceId = classId;
      this.notice("接続先のクラスを選択してください");
      this.render();
      return;
    }
    const type = this.elements.relationshipTypeSelect.value;
    this.updateState(this.model.addRelationship(this.state, {
      sourceClassId: this.connectSourceId,
      targetClassId: classId,
      type
    }));
    this.connectSourceId = null;
    this.connectMode = false;
    this.elements.connectModeButton.setAttribute("aria-pressed", "false");
    this.notice("関係を追加しました");
  }

  deleteSelected() {
    if (!this.state.selection) return;
    if (this.state.selection.type === "class") {
      this.updateState(this.model.removeClass(this.state, this.state.selection.id));
    } else if (this.state.selection.type === "classes") {
      this.updateState(this.state.selection.ids.reduce((state, classId) => this.model.removeClass(state, classId), this.state));
    } else {
      this.updateState(this.model.removeRelationship(this.state, this.state.selection.id));
    }
  }

  selectClasses(classIds) {
    if (classIds.length === 0) {
      this.updateState(this.model.select(this.state, null), false);
      return;
    }
    if (classIds.length === 1) {
      this.updateState(this.model.select(this.state, { type: "class", id: classIds[0] }), false);
      return;
    }
    this.updateState(this.model.select(this.state, { type: "classes", ids: classIds }), false);
  }

  updateClassPositions(positions) {
    this.capturePendingHistory();
    const nextState = positions.reduce((state, item) => (
      this.model.updateClass(state, item.id, { position: item.position })
    ), this.state);
    this.updateState(nextState, false, false);
  }

  updateClassSize(classId, size) {
    this.capturePendingHistory();
    this.updateState(this.model.updateClass(this.state, classId, { size }), false, false);
  }

  finishClassResize(classId, moved) {
    this.updateState(this.model.select(this.state, { type: "class", id: classId }), moved, true, false);
    if (moved) {
      this.commitPendingHistory();
    } else {
      this.pendingHistoryState = null;
    }
  }

  updateClassList(classId, key, updater) {
    const classNode = this.state.classes.find((item) => item.id === classId);
    if (!classNode) return;
    this.updateState(this.model.updateClass(this.state, classId, { [key]: updater(classNode[key]) }));
  }

  importMermaid(text) {
    try {
      const parsed = this.parser.parse(text);
      const normalized = this.model.normalizeState(parsed);
      const state = parsed.hasLayoutMetadata
        ? normalized
        : this.layout.applyInitialLayout(normalized);
      this.updateState(state);
      this.modal.close();
      this.notice("インポートしました");
    } catch (error) {
      this.modal.showError(error.message || "Mermaid を読み取れませんでした。");
    }
  }

  zoom(request, center = null) {
    const currentViewport = this.state.viewport;
    const requestedScale = typeof request === "number"
      ? currentViewport.scale + request * 0.1
      : Number(request?.scale ?? currentViewport.scale);
    const nextScale = Math.min(2.5, Math.max(0.35, requestedScale));
    const viewportPatch = { scale: nextScale };

    if (center) {
      const rect = this.elements.svg.getBoundingClientRect();
      const localX = center.x - rect.left;
      const localY = center.y - rect.top;
      const diagramX = (localX - currentViewport.x) / currentViewport.scale;
      const diagramY = (localY - currentViewport.y) / currentViewport.scale;
      viewportPatch.x = localX - diagramX * nextScale;
      viewportPatch.y = localY - diagramY * nextScale;
    }

    this.updateState(this.model.updateViewport(this.state, viewportPatch), false);
  }

  updateState(nextState, shouldSave = true, renderInspector = true, trackHistory = shouldSave) {
    const previousState = this.state;
    this.state = this.model.normalizeState(nextState);
    if (trackHistory && !this.areStatesEqual(previousState, this.state)) {
      this.undoStack.push(this.cloneState(previousState));
      this.pendingHistoryState = null;
    }
    this.render(renderInspector);
    if (shouldSave) this.save();
  }

  undo() {
    const previousState = this.undoStack.pop();
    if (!previousState) return;
    this.connectMode = false;
    this.connectSourceId = null;
    this.pendingHistoryState = null;
    this.elements.connectModeButton.setAttribute("aria-pressed", "false");
    this.state = this.model.normalizeState(previousState);
    this.render();
    this.save();
    this.notice("元に戻しました");
  }

  capturePendingHistory() {
    if (!this.pendingHistoryState) {
      this.pendingHistoryState = this.cloneState(this.state);
    }
  }

  commitPendingHistory() {
    if (!this.pendingHistoryState) {
      this.save();
      return;
    }
    if (!this.areStatesEqual(this.pendingHistoryState, this.state)) {
      this.undoStack.push(this.pendingHistoryState);
    }
    this.pendingHistoryState = null;
    this.render(false);
    this.save();
  }

  cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  areStatesEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  save() {
    const result = this.storage.save(this.state);
    if (!result.ok) this.notice("保存できませんでした");
    this.updateUndoButton();
  }

  render(renderInspector = true) {
    this.renderer.render(this.state, { connectSourceId: this.connectSourceId });
    if (renderInspector) this.inspector.render(this.state);
    this.updateUndoButton();
  }

  updateUndoButton() {
    this.elements.undoButton.disabled = this.undoStack.length === 0;
  }

  notice(message) {
    this.elements.statusMessage.textContent = message;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    if (message) this.noticeTimer = setTimeout(() => {
      this.elements.statusMessage.textContent = "";
    }, 2400);
  }
}

function moveItem(items, itemId, direction) {
  const next = [...items];
  const index = next.findIndex((item) => item.id === itemId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) return items;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function isTextEditingElement(element) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName) || element?.isContentEditable;
}
