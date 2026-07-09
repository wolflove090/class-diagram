const relationshipMarker = {
  inheritance: "inheritance",
  implementation: "inheritance",
  dependency: "arrow",
  association: "arrow",
  aggregation: "aggregation",
  composition: "composition"
};

class SvgRenderer {
  constructor(svgElement) {
    this.svg = svgElement;
    this.handlers = {};
    this.viewportGroup = createSvgElement("g");
    this.svg.append(this.viewportGroup);
    this.drag = null;
    this.connectSourceId = null;
    this.state = null;
    this.bindPointerEvents();
  }

  bindEvents(handlers) {
    this.handlers = handlers;
  }

  setConnectSource(classId) {
    this.connectSourceId = classId;
  }

  render(state, options = {}) {
    this.state = state;
    this.connectSourceId = options.connectSourceId ?? this.connectSourceId;
    clearChildren(this.svg);
    this.svg.append(this.createDefs(), this.viewportGroup);
    clearChildren(this.viewportGroup);
    this.viewportGroup.setAttribute(
      "transform",
      `translate(${state.viewport.x} ${state.viewport.y}) scale(${state.viewport.scale})`
    );

    for (const relationship of state.relationships) {
      const source = state.classes.find((classNode) => classNode.id === relationship.sourceClassId);
      const target = state.classes.find((classNode) => classNode.id === relationship.targetClassId);
      if (source && target) this.viewportGroup.append(this.renderRelationship(relationship, source, target, state.selection));
    }

    for (const classNode of state.classes) {
      this.viewportGroup.append(this.renderClassNode(classNode, state.selection));
    }
  }

  createDefs() {
    const defs = createSvgElement("defs");
    defs.append(
      createSvgElement("marker", {
        id: "marker-arrow",
        viewBox: "0 0 10 10",
        refX: 9,
        refY: 5,
        markerWidth: 8,
        markerHeight: 8,
        orient: "auto-start-reverse"
      }, [createSvgElement("path", { d: "M 0 0 L 10 5 L 0 10 z", class: "marker-fill" })]),
      createSvgElement("marker", {
        id: "marker-inheritance",
        viewBox: "0 0 12 12",
        refX: 11,
        refY: 6,
        markerWidth: 10,
        markerHeight: 10,
        orient: "auto-start-reverse"
      }, [createSvgElement("path", { d: "M 1 1 L 11 6 L 1 11 z", class: "marker-hollow" })]),
      createSvgElement("marker", {
        id: "marker-aggregation",
        viewBox: "0 0 16 10",
        refX: 15,
        refY: 5,
        markerWidth: 14,
        markerHeight: 10,
        orient: "auto-start-reverse"
      }, [createSvgElement("path", { d: "M 1 5 L 8 1 L 15 5 L 8 9 z", class: "marker-hollow" })]),
      createSvgElement("marker", {
        id: "marker-composition",
        viewBox: "0 0 16 10",
        refX: 15,
        refY: 5,
        markerWidth: 14,
        markerHeight: 10,
        orient: "auto-start-reverse"
      }, [createSvgElement("path", { d: "M 1 5 L 8 1 L 15 5 L 8 9 z", class: "marker-fill" })])
    );
    return defs;
  }

  renderClassNode(classNode, selection) {
    const selected = selection?.type === "class" && selection.id === classNode.id;
    const width = Math.max(220, classNode.size.width);
    const height = this.measureClassHeight(classNode);
    const group = createSvgElement("g", {
      class: `class-node${selected ? " selected" : ""}${this.connectSourceId === classNode.id ? " connect-source" : ""}`,
      transform: `translate(${classNode.position.x} ${classNode.position.y})`,
      tabindex: 0,
      dataset: { classId: classNode.id }
    });
    group.append(createSvgElement("rect", { width, height, rx: 6 }));
    let y = 22;
    if (classNode.stereotype || classNode.kind !== "class") {
      const text = classNode.stereotype || `<<${classNode.kind}>>`;
      group.append(createSvgElement("text", { x: width / 2, y, "text-anchor": "middle", class: "stereotype" }, [text]));
      y += 22;
    }
    group.append(createSvgElement("text", {
      x: width / 2,
      y,
      "text-anchor": "middle",
      class: classNode.kind === "abstract" || classNode.isAbstract ? "class-title abstract" : "class-title"
    }, [classNode.name]));
    y += 12;
    group.append(createSvgElement("line", { x1: 0, x2: width, y1: y, y2: y, class: "section-divider" }));
    y += 20;
    if (classNode.properties.length === 0) {
      group.append(createSvgElement("text", { x: 14, y, class: "empty-member" }, ["プロパティなし"]));
      y += 20;
    } else {
      for (const property of classNode.properties) {
        group.append(createSvgElement("text", { x: 14, y, class: "member-text" }, [formatProperty(property)]));
        y += 20;
      }
    }
    group.append(createSvgElement("line", { x1: 0, x2: width, y1: y - 6, y2: y - 6, class: "section-divider" }));
    if (classNode.methods.length === 0) {
      group.append(createSvgElement("text", { x: 14, y: y + 12, class: "empty-member" }, ["メソッドなし"]));
    } else {
      for (const method of classNode.methods) {
        group.append(createSvgElement("text", { x: 14, y: y + 12, class: "member-text" }, [formatMethod(method)]));
        y += 20;
      }
    }
    group.addEventListener("pointerdown", (event) => this.startClassPointer(event, classNode));
    group.addEventListener("click", (event) => {
      event.stopPropagation();
      this.handlers.onClassClick?.(classNode.id);
    });
    return group;
  }

  renderRelationship(relationship, source, target, selection) {
    const selected = selection?.type === "relationship" && selection.id === relationship.id;
    const group = createSvgElement("g", { class: `relationship${selected ? " selected" : ""}` });
    const path = this.relationshipPath(source, target);
    const marker = relationshipMarker[relationship.type] ?? "arrow";
    const lineAttrs = {
      d: path.d,
      class: `relationship-line ${relationship.type}${selected ? " selected" : ""}`,
      "marker-end": `url(#marker-${marker})`
    };
    group.append(createSvgElement("path", lineAttrs));
    group.append(createSvgElement("path", { d: path.d, class: "relationship-hit" }));
    const label = [relationship.sourceMultiplicity, relationship.label, relationship.targetMultiplicity].filter(Boolean).join("  ");
    if (label) {
      group.append(createSvgElement("text", { x: path.label.x, y: path.label.y, class: "relationship-label" }, [label]));
    }
    group.addEventListener("click", (event) => {
      event.stopPropagation();
      this.handlers.onRelationshipClick?.(relationship.id);
    });
    return group;
  }

  relationshipPath(source, target) {
    if (source.id === target.id) {
      const x = source.position.x + source.size.width;
      const y = source.position.y + 35;
      return {
        d: `M ${x} ${y} C ${x + 80} ${y - 60}, ${x + 90} ${y + 100}, ${x} ${y + 90}`,
        label: { x: x + 70, y: y + 24 }
      };
    }
    const sourceCenter = centerOf(source);
    const targetCenter = centerOf(target);
    const start = edgePoint(source, targetCenter);
    const end = edgePoint(target, sourceCenter);
    return {
      d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
      label: { x: (start.x + end.x) / 2 + 8, y: (start.y + end.y) / 2 - 8 }
    };
  }

  measureClassHeight(classNode) {
    return 88 + Math.max(1, classNode.properties.length) * 20 + Math.max(1, classNode.methods.length) * 20;
  }

  bindPointerEvents() {
    this.svg.addEventListener("pointerdown", (event) => {
      if (event.target !== this.svg) return;
      this.drag = {
        type: "pan",
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        viewport: { ...this.state.viewport }
      };
      this.svg.setPointerCapture(event.pointerId);
      this.handlers.onCanvasClick?.();
    });
    this.svg.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    this.svg.addEventListener("pointerup", (event) => this.endPointer(event));
    this.svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      this.handlers.onZoom?.(direction, { x: event.clientX, y: event.clientY });
    }, { passive: false });
  }

  startClassPointer(event, classNode) {
    event.stopPropagation();
    this.drag = {
      type: "class",
      pointerId: event.pointerId,
      classId: classNode.id,
      start: this.toDiagramPoint({ x: event.clientX, y: event.clientY }),
      position: { ...classNode.position },
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  handlePointerMove(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    if (this.drag.type === "pan") {
      const dx = event.clientX - this.drag.start.x;
      const dy = event.clientY - this.drag.start.y;
      this.handlers.onViewportChange?.({ x: this.drag.viewport.x + dx, y: this.drag.viewport.y + dy });
      return;
    }
    const point = this.toDiagramPoint({ x: event.clientX, y: event.clientY });
    const dx = point.x - this.drag.start.x;
    const dy = point.y - this.drag.start.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) this.drag.moved = true;
    this.handlers.onClassDrag?.(this.drag.classId, {
      x: this.drag.position.x + dx,
      y: this.drag.position.y + dy
    });
  }

  endPointer(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    if (this.drag.type === "class" && !this.drag.moved) {
      this.handlers.onClassClick?.(this.drag.classId);
    }
    this.drag = null;
  }

  toDiagramPoint(point) {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: (point.x - rect.left - this.state.viewport.x) / this.state.viewport.scale,
      y: (point.y - rect.top - this.state.viewport.y) / this.state.viewport.scale
    };
  }
}

function formatProperty(property) {
  const visibility = visibilitySymbols[property.visibility] ?? "+";
  const flags = [property.isStatic ? "$" : "", property.isAbstract ? "*" : "", property.isReadonly ? "readonly " : ""].join("");
  const type = property.type ? `: ${property.type}` : "";
  const defaultValue = property.defaultValue ? ` = ${property.defaultValue}` : "";
  return `${visibility} ${flags}${property.name}${type}${defaultValue}`;
}

function formatMethod(method) {
  const visibility = visibilitySymbols[method.visibility] ?? "+";
  const params = method.parameters.map((parameter) => (
    `${parameter.name}${parameter.isOptional ? "?" : ""}${parameter.type ? `: ${parameter.type}` : ""}`
  )).join(", ");
  const type = method.returnType ? `: ${method.returnType}` : "";
  const flags = [method.isStatic ? "$" : "", method.isAbstract ? "*" : "", method.isAsync ? "async " : ""].join("");
  return `${visibility} ${flags}${method.name}(${params})${type}`;
}

function centerOf(classNode) {
  return {
    x: classNode.position.x + classNode.size.width / 2,
    y: classNode.position.y + classNode.size.height / 2
  };
}

function edgePoint(classNode, toward) {
  const center = centerOf(classNode);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const halfWidth = classNode.size.width / 2;
  const halfHeight = classNode.size.height / 2;
  const scale = Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight, 1);
  return {
    x: center.x + dx / scale,
    y: center.y + dy / scale
  };
}
