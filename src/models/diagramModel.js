let nextId = Date.now();

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
      size: { width: Number(classNode.size?.width ?? 220), height: Number(classNode.size?.height ?? 150) },
      properties: Array.isArray(classNode.properties) ? classNode.properties.map((property) => this.createProperty(property)) : [],
      methods: Array.isArray(classNode.methods) ? classNode.methods.map((method) => this.createMethod(method)) : []
    }));
    const ids = new Set(state.classes.map((classNode) => classNode.id));
    state.relationships = state.relationships
      .filter((relationship) => ids.has(relationship.sourceClassId) && ids.has(relationship.targetClassId))
      .map((relationship) => this.createRelationship(relationship));
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
      size: input.size ?? { width: 230, height: 150 },
      properties: (input.properties ?? []).map((property) => this.createProperty(property)),
      methods: (input.methods ?? []).map((method) => this.createMethod(method))
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
      relationships: state.relationships.filter((relationship) => (
        relationship.sourceClassId !== classId && relationship.targetClassId !== classId
      )),
      selection: null
    };
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
