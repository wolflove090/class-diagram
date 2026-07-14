let nextId = Date.now();

const CLASS_MIN_SIZE = {
  width: 180,
  height: 110
};
const DIAGRAM_GRID_SIZE = 24;

function createId(prefix) {
  nextId += 1;
  return `${prefix}_${nextId.toString(36)}`;
}

const visibilitySymbols = {
  public: "+",
  protected: "#",
  private: "-",
  package: "~"
};

class DiagramModel {
  createInitialState() {
    return {
      version: 1,
      classes: [],
      groups: [],
      relationships: [],
      viewport: { x: 0, y: 0, scale: 1 },
      selection: null
    };
  }

  normalizeState(input) {
    const base = this.createInitialState();
    const state = {
      ...base,
      ...input,
      classes: Array.isArray(input?.classes) ? input.classes : [],
      groups: Array.isArray(input?.groups) ? input.groups : [],
      relationships: Array.isArray(input?.relationships) ? input.relationships : [],
      viewport: { ...base.viewport, ...(input?.viewport ?? {}) },
      selection: input?.selection ?? null
    };
    state.classes = state.classes.map((classNode) => ({
      id: classNode.id ?? createId("class"),
      name: classNode.name || "Class",
      kind: classNode.kind || "class",
      stereotype: classNode.stereotype ?? "",
      visibility: classNode.visibility || "public",
      isAbstract: Boolean(classNode.isAbstract),
      position: { x: Number(classNode.position?.x ?? 120), y: Number(classNode.position?.y ?? 100) },
      size: this.normalizeClassSize(classNode.size),
      properties: Array.isArray(classNode.properties) ? classNode.properties.map((property) => this.createProperty(property)) : [],
      methods: Array.isArray(classNode.methods) ? classNode.methods.map((method) => this.createMethod(method)) : []
    }));
    const ids = new Set(state.classes.map((classNode) => classNode.id));
    state.groups = state.groups.map((group) => ({
      id: group.id ?? createId("group"),
      name: group.name || "Group",
      label: group.label || group.name || "Group",
      parentId: group.parentId ?? null,
      classIds: Array.isArray(group.classIds) ? [...new Set(group.classIds.filter((id) => ids.has(id)))] : []
    }));
    const groupIds = new Set(state.groups.map((group) => group.id));
    state.groups = state.groups.map((group) => ({
      ...group,
      parentId: group.parentId && group.parentId !== group.id && groupIds.has(group.parentId) ? group.parentId : null
    }));
    state.relationships = state.relationships
      .filter((relationship) => ids.has(relationship.sourceClassId) && ids.has(relationship.targetClassId))
      .map((relationship) => this.createRelationship(relationship));
    if (state.selection?.type === "class" && !ids.has(state.selection.id)) {
      state.selection = null;
    }
    if (state.selection?.type === "classes") {
      const selectionIds = Array.isArray(state.selection.ids) ? state.selection.ids.filter((id) => ids.has(id)) : [];
      state.selection = selectionIds.length > 1
        ? { type: "classes", ids: selectionIds }
        : selectionIds.length === 1
          ? { type: "class", id: selectionIds[0] }
          : null;
    }
    if (state.selection?.type === "relationship" && !state.relationships.some((relationship) => relationship.id === state.selection.id)) {
      state.selection = null;
    }
    if (state.selection?.type === "group" && !groupIds.has(state.selection.id)) state.selection = null;
    return state;
  }

  createClass(input = {}, state = null) {
    return {
      id: input.id ?? createId("class"),
      name: input.name ?? (state ? this.createUniqueClassName(state) : "NewClass"),
      kind: input.kind ?? "class",
      stereotype: input.stereotype ?? "",
      visibility: input.visibility ?? "public",
      isAbstract: Boolean(input.isAbstract),
      position: input.position ?? { x: 120, y: 100 },
      size: this.normalizeClassSize(input.size ?? { width: 230, height: 150 }),
      properties: (input.properties ?? []).map((property) => this.createProperty(property)),
      methods: (input.methods ?? []).map((method) => this.createMethod(method))
    };
  }

  createGroup(input = {}) {
    return {
      id: input.id ?? createId("group"),
      name: input.name ?? "Group",
      label: input.label ?? input.name ?? "Group",
      parentId: input.parentId ?? null,
      classIds: Array.isArray(input.classIds) ? [...new Set(input.classIds)] : []
    };
  }

  normalizeClassSize(size = {}) {
    return {
      width: Math.max(CLASS_MIN_SIZE.width, Number(size.width ?? 230)),
      height: Math.max(CLASS_MIN_SIZE.height, Number(size.height ?? 150))
    };
  }

  snapNumberToGrid(value, gridSize = DIAGRAM_GRID_SIZE) {
    return Math.round(Number(value ?? 0) / gridSize) * gridSize;
  }

  snapPointToGrid(point, gridSize = DIAGRAM_GRID_SIZE) {
    return {
      x: this.snapNumberToGrid(point?.x, gridSize),
      y: this.snapNumberToGrid(point?.y, gridSize)
    };
  }

  snapSizeToGrid(size, gridSize = DIAGRAM_GRID_SIZE) {
    const normalized = this.normalizeClassSize(size);
    return this.normalizeClassSize({
      width: this.snapNumberToGrid(normalized.width, gridSize),
      height: this.snapNumberToGrid(normalized.height, gridSize)
    });
  }

  snapClassToGrid(classNode, gridSize = DIAGRAM_GRID_SIZE) {
    return {
      ...classNode,
      position: this.snapPointToGrid(classNode.position, gridSize),
      size: this.snapSizeToGrid(classNode.size, gridSize)
    };
  }

  snapClassesToGrid(state, classIds = null, gridSize = DIAGRAM_GRID_SIZE) {
    const targetIds = classIds ? new Set(classIds) : null;
    return {
      ...state,
      classes: state.classes.map((classNode) => (
        !targetIds || targetIds.has(classNode.id)
          ? this.snapClassToGrid(classNode, gridSize)
          : classNode
      ))
    };
  }

  createProperty(input = {}) {
    return {
      id: input.id ?? createId("prop"),
      name: input.name ?? "property",
      type: input.type ?? "string",
      visibility: input.visibility ?? "private",
      isStatic: Boolean(input.isStatic),
      isReadonly: Boolean(input.isReadonly),
      isAbstract: Boolean(input.isAbstract),
      defaultValue: input.defaultValue ?? "",
      description: input.description ?? ""
    };
  }

  createMethod(input = {}) {
    return {
      id: input.id ?? createId("method"),
      name: input.name ?? "method",
      returnType: input.returnType ?? "void",
      visibility: input.visibility ?? "public",
      isStatic: Boolean(input.isStatic),
      isAbstract: Boolean(input.isAbstract),
      isAsync: Boolean(input.isAsync),
      parameters: (input.parameters ?? []).map((parameter) => this.createParameter(parameter)),
      description: input.description ?? ""
    };
  }

  createParameter(input = {}) {
    return {
      id: input.id ?? createId("param"),
      name: input.name ?? "value",
      type: input.type ?? "",
      defaultValue: input.defaultValue ?? "",
      isOptional: Boolean(input.isOptional)
    };
  }

  createRelationship(input = {}) {
    return {
      id: input.id ?? createId("rel"),
      sourceClassId: input.sourceClassId,
      targetClassId: input.targetClassId,
      type: input.type ?? "association",
      label: input.label ?? "",
      sourceMultiplicity: input.sourceMultiplicity ?? "",
      targetMultiplicity: input.targetMultiplicity ?? ""
    };
  }

  addClass(state, input = {}) {
    const classNode = this.createClass(input, state);
    return {
      ...state,
      classes: [...state.classes, classNode],
      selection: { type: "class", id: classNode.id }
    };
  }

  updateClass(state, classId, patch) {
    return {
      ...state,
      classes: state.classes.map((classNode) => (
        classNode.id === classId ? { ...classNode, ...patch } : classNode
      ))
    };
  }

  removeClass(state, classId) {
    return {
      ...state,
      classes: state.classes.filter((classNode) => classNode.id !== classId),
      groups: state.groups.map((group) => ({ ...group, classIds: group.classIds.filter((id) => id !== classId) })),
      relationships: state.relationships.filter((relationship) => (
        relationship.sourceClassId !== classId && relationship.targetClassId !== classId
      )),
      selection: null
    };
  }

  addGroup(state, input = {}) {
    const group = this.createGroup(input);
    return { ...state, groups: [...state.groups, group], selection: { type: "group", id: group.id } };
  }

  updateGroup(state, groupId, patch) {
    return { ...state, groups: state.groups.map((group) => group.id === groupId ? { ...group, ...patch } : group) };
  }

  removeGroup(state, groupId) {
    const removedIds = new Set([groupId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const group of state.groups) {
        if (group.parentId && removedIds.has(group.parentId) && !removedIds.has(group.id)) {
          removedIds.add(group.id);
          changed = true;
        }
      }
    }
    return { ...state, groups: state.groups.filter((group) => !removedIds.has(group.id)), selection: null };
  }

  addRelationship(state, input) {
    const exists = state.classes.some((classNode) => classNode.id === input.sourceClassId)
      && state.classes.some((classNode) => classNode.id === input.targetClassId);
    if (!exists) return state;
    const relationship = this.createRelationship(input);
    return {
      ...state,
      relationships: [...state.relationships, relationship],
      selection: { type: "relationship", id: relationship.id }
    };
  }

  updateRelationship(state, relationshipId, patch) {
    return {
      ...state,
      relationships: state.relationships.map((relationship) => (
        relationship.id === relationshipId ? { ...relationship, ...patch } : relationship
      ))
    };
  }

  reverseRelationship(state, relationshipId) {
    return {
      ...state,
      relationships: state.relationships.map((relationship) => (
        relationship.id !== relationshipId ? relationship : {
          ...relationship,
          sourceClassId: relationship.targetClassId,
          targetClassId: relationship.sourceClassId,
          sourceMultiplicity: relationship.targetMultiplicity,
          targetMultiplicity: relationship.sourceMultiplicity
        }
      ))
    };
  }

  removeRelationship(state, relationshipId) {
    return {
      ...state,
      relationships: state.relationships.filter((relationship) => relationship.id !== relationshipId),
      selection: null
    };
  }

  updateViewport(state, viewport) {
    return { ...state, viewport: { ...state.viewport, ...viewport } };
  }

  select(state, selection) {
    return { ...state, selection };
  }

  validate(state) {
    const classIds = new Set(state.classes.map((classNode) => classNode.id));
    const invalidRelationships = state.relationships.filter((relationship) => (
      !classIds.has(relationship.sourceClassId) || !classIds.has(relationship.targetClassId)
    ));
    return {
      valid: invalidRelationships.length === 0,
      invalidRelationships
    };
  }

  createUniqueClassName(state) {
    const names = new Set(state.classes.map((classNode) => classNode.name));
    let index = state.classes.length + 1;
    let name = "NewClass";
    while (names.has(name)) {
      name = `NewClass${index}`;
      index += 1;
    }
    return name;
  }
}
