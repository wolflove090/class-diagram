const relationshipMarker = {
  inheritance: "inheritance",
  implementation: "inheritance",
  dependency: "arrow",
  association: "arrow",
  aggregation: "aggregation",
  composition: "composition"
};

const ZOOM_WHEEL_SENSITIVITY = 0.5;
const ZOOM_WHEEL_MAX_DELTA = 120;

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

    if (this.drag?.type === "select") {
      this.viewportGroup.append(this.renderSelectionRect(this.drag.start, this.drag.current));
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
    const selected = isClassSelected(selection, classNode.id);
    const { width, height } = this.getClassRenderSize(classNode);
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
    if (selection?.type === "class" && selection.id === classNode.id) {
      group.append(this.renderResizeHandles(classNode, { width, height }));
    }
    return group;
  }

  renderResizeHandles(classNode, size) {
    const handles = createSvgElement("g", { class: "resize-handles" });
    const handleSpecs = [
      {
        direction: "east",
        x: size.width - 5,
        y: size.height / 2 - 14,
        width: 10,
        height: 28,
        className: "resize-handle east"
      },
      {
        direction: "south",
        x: size.width / 2 - 14,
        y: size.height - 5,
        width: 28,
        height: 10,
        className: "resize-handle south"
      },
      {
        direction: "south-east",
        x: size.width - 10,
        y: size.height - 10,
        width: 14,
        height: 14,
        className: "resize-handle south-east"
      }
    ];

    for (const spec of handleSpecs) {
      const handle = createSvgElement("rect", {
        x: spec.x,
        y: spec.y,
        width: spec.width,
        height: spec.height,
        rx: 3,
        class: spec.className
      });
      handle.addEventListener("pointerdown", (event) => this.startResizePointer(event, classNode, spec.direction));
      handles.append(handle);
    }

    return handles;
  }

  renderSelectionRect(start, current) {
    const bounds = rectFromPoints(start, current);
    return createSvgElement("rect", {
      class: "selection-marquee",
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    });
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
      const sourceSize = this.getClassRenderSize(source);
      const x = source.position.x + sourceSize.width;
      const y = source.position.y + 35;
      return {
        d: `M ${x} ${y} C ${x + 80} ${y - 60}, ${x + 90} ${y + 100}, ${x} ${y + 90}`,
        label: { x: x + 70, y: y + 24 }
      };
    }
    const sourceSize = this.getClassRenderSize(source);
    const targetSize = this.getClassRenderSize(target);
    const sourceCenter = centerOf(source, sourceSize);
    const targetCenter = centerOf(target, targetSize);
    const start = edgePoint(source, sourceSize, targetCenter);
    const end = edgePoint(target, targetSize, sourceCenter);
    return {
      d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
      label: { x: (start.x + end.x) / 2 + 8, y: (start.y + end.y) / 2 - 8 }
    };
  }

  measureClassHeight(classNode) {
    return measureClassContentHeight(classNode);
  }

  getClassRenderSize(classNode) {
    return {
      width: Math.max(CLASS_MIN_SIZE.width, Number(classNode.size?.width ?? 230)),
      height: Math.max(
        CLASS_MIN_SIZE.height,
        Number(classNode.size?.height ?? 150),
        this.measureClassHeight(classNode)
      )
    };
  }

  bindPointerEvents() {
    this.svg.addEventListener("pointerdown", (event) => {
      if (event.target !== this.svg) return;
      event.preventDefault();
      if (event.button === 1 || event.altKey) {
        this.drag = {
          type: "pan",
          pointerId: event.pointerId,
          start: { x: event.clientX, y: event.clientY },
          viewport: { ...this.state.viewport }
        };
        clearBrowserSelection();
        this.svg.setPointerCapture(event.pointerId);
        return;
      }
      const start = this.toDiagramPoint({ x: event.clientX, y: event.clientY });
      this.drag = {
        type: "select",
        pointerId: event.pointerId,
        start,
        current: start,
        moved: false
      };
      clearBrowserSelection();
      this.svg.setPointerCapture(event.pointerId);
    });
    this.svg.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    this.svg.addEventListener("pointerup", (event) => this.endPointer(event));
    this.svg.addEventListener("wheel", (event) => {
      event.preventDefault();
      if (!this.state?.viewport) return;
      if (!event.metaKey && !event.ctrlKey) {
        this.handlers.onViewportChange?.({
          x: this.state.viewport.x - event.deltaX,
          y: this.state.viewport.y - event.deltaY
        });
        return;
      }
      const delta = clamp(normalizeWheelDelta(event), -ZOOM_WHEEL_MAX_DELTA, ZOOM_WHEEL_MAX_DELTA);
      const scale = this.state.viewport.scale * Math.exp(-delta / ZOOM_WHEEL_MAX_DELTA * ZOOM_WHEEL_SENSITIVITY);
      this.handlers.onZoom?.({ scale }, { x: event.clientX, y: event.clientY });
    }, { passive: false });
  }

  startClassPointer(event, classNode) {
    event.preventDefault();
    event.stopPropagation();
    clearBrowserSelection();
    const selectedIds = getSelectedClassIds(this.state.selection);
    const draggedIds = selectedIds.includes(classNode.id) ? selectedIds : [classNode.id];
    this.drag = {
      type: "class",
      pointerId: event.pointerId,
      classId: classNode.id,
      classIds: draggedIds,
      start: this.toDiagramPoint({ x: event.clientX, y: event.clientY }),
      positions: new Map(draggedIds.map((id) => {
        const node = this.state.classes.find((item) => item.id === id);
        return [id, { ...node.position }];
      })),
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  startResizePointer(event, classNode, direction) {
    event.preventDefault();
    event.stopPropagation();
    clearBrowserSelection();
    this.drag = {
      type: "resize",
      pointerId: event.pointerId,
      classId: classNode.id,
      direction,
      start: this.toDiagramPoint({ x: event.clientX, y: event.clientY }),
      size: { ...classNode.size },
      moved: false
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  handlePointerMove(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    event.preventDefault();
    clearBrowserSelection();
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
    if (this.drag.type === "select") {
      this.drag.current = point;
      this.render(this.state);
      return;
    }
    if (this.drag.type === "resize") {
      const nextSize = {
        width: this.drag.direction.includes("east")
          ? Math.max(CLASS_MIN_SIZE.width, this.drag.size.width + dx)
          : this.drag.size.width,
        height: this.drag.direction.includes("south")
          ? Math.max(CLASS_MIN_SIZE.height, this.drag.size.height + dy)
          : this.drag.size.height
      };
      this.handlers.onClassResize?.(this.drag.classId, nextSize);
      return;
    }
    this.handlers.onClassDrag?.(this.drag.classIds.map((id) => {
      const position = this.drag.positions.get(id);
      return { id, position: { x: position.x + dx, y: position.y + dy } };
    }));
  }

  endPointer(event) {
    if (!this.drag || event.pointerId !== this.drag.pointerId) return;
    const drag = this.drag;
    this.drag = null;
    if (drag.type === "class" && !drag.moved) {
      if (drag.classIds.length === 1) this.handlers.onClassClick?.(drag.classId);
      return;
    }
    if (drag.type === "class") {
      this.handlers.onClassDragEnd?.(drag.classIds);
      return;
    }
    if (drag.type === "resize") {
      this.handlers.onClassResizeEnd?.(drag.classId, drag.moved);
      return;
    }
    if (drag.type === "select") {
      if (!drag.moved) {
        this.handlers.onCanvasClick?.();
        return;
      }
      const bounds = rectFromPoints(drag.start, drag.current);
      const ids = this.state.classes
        .filter((classNode) => intersects(bounds, classBounds(classNode, this.getClassRenderSize(classNode))))
        .map((classNode) => classNode.id);
      this.handlers.onClassRangeSelect?.(ids);
      this.render(this.state);
    }
  }

  toDiagramPoint(point) {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: (point.x - rect.left - this.state.viewport.x) / this.state.viewport.scale,
      y: (point.y - rect.top - this.state.viewport.y) / this.state.viewport.scale
    };
  }
}

function clearBrowserSelection() {
  const selection = window.getSelection?.();
  if (selection && selection.rangeCount > 0) selection.removeAllRanges();
}

function normalizeWheelDelta(event) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * window.innerHeight;
  return event.deltaY;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatProperty(property) {
  return formatClassProperty(property);
}

function isClassSelected(selection, classId) {
  if (selection?.type === "class") return selection.id === classId;
  if (selection?.type === "classes") return selection.ids.includes(classId);
  return false;
}

function getSelectedClassIds(selection) {
  if (selection?.type === "class") return [selection.id];
  if (selection?.type === "classes") return selection.ids;
  return [];
}

function rectFromPoints(start, current) {
  const x = Math.min(start.x, current.x);
  const y = Math.min(start.y, current.y);
  return {
    x,
    y,
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y)
  };
}

function classBounds(classNode, size) {
  return {
    x: classNode.position.x,
    y: classNode.position.y,
    width: size.width,
    height: size.height
  };
}

function intersects(a, b) {
  return a.x <= b.x + b.width
    && a.x + a.width >= b.x
    && a.y <= b.y + b.height
    && a.y + a.height >= b.y;
}

function formatMethod(method) {
  return formatClassMethod(method);
}

function centerOf(classNode, size) {
  return {
    x: classNode.position.x + size.width / 2,
    y: classNode.position.y + size.height / 2
  };
}

function edgePoint(classNode, size, toward) {
  const center = centerOf(classNode, size);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const scale = Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight, 1);
  return {
    x: center.x + dx / scale,
    y: center.y + dy / scale
  };
}
