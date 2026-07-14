const relationSyntax = [
  { type: "inheritance", operator: "<|--", reverse: false },
  { type: "inheritance", operator: "--|>", reverse: true },
  { type: "inheritance", operator: "<|--|>", reverse: false },
  { type: "implementation", operator: "<|..", reverse: false },
  { type: "implementation", operator: "..|>", reverse: true },
  { type: "implementation", operator: "<|..|>", reverse: false },
  { type: "composition", operator: "*--", reverse: false },
  { type: "composition", operator: "--*", reverse: true },
  { type: "composition", operator: "*--*", reverse: false },
  { type: "aggregation", operator: "o--", reverse: false },
  { type: "aggregation", operator: "--o", reverse: true },
  { type: "aggregation", operator: "o--o", reverse: false },
  { type: "association", operator: "-->", reverse: false },
  { type: "association", operator: "<--", reverse: true },
  { type: "association", operator: "<-->", reverse: false },
  { type: "dependency", operator: "..>", reverse: false },
  { type: "dependency", operator: "<..", reverse: true },
  { type: "dependency", operator: "<..>", reverse: false },
  { type: "link", operator: "--", reverse: false },
  { type: "dashedLink", operator: "..", reverse: false }
];

const symbolToVisibility = {
  "+": "public",
  "#": "protected",
  "-": "private",
  "~": "package"
};

class MermaidParser {
  constructor() {
    this.model = new DiagramModel();
  }

  parse(text) {
    const state = this.model.createInitialState();
    const classMap = new Map();
    const rawLines = String(text || "").split(/\r?\n/).map((line) => line.trim());
    const layoutMetadata = parseLayoutMetadata(rawLines);
    const lines = rawLines.filter((line) => line && !line.startsWith("%%"));

    let currentClass = null;
    let sawHeader = false;
    for (const line of lines) {
      if (/^classDiagram(?:-v2)?\b/.test(line)) {
        sawHeader = true;
        continue;
      }
      if (line === "}") {
        currentClass = null;
        continue;
      }
      const classStart = line.match(/^class\s+(.+?)\s*\{$/);
      if (classStart) {
        currentClass = ensureClass(state, classMap, classStart[1], this.model);
        continue;
      }
      const inlineMember = line.match(/^([^\s:]+)\s*:\s*(.+)$/);
      if (inlineMember && !line.startsWith("class ")) {
        const classNode = ensureClass(state, classMap, inlineMember[1], this.model);
        addMember(classNode, parseMember(inlineMember[2], this.model));
        continue;
      }
      const classSingle = line.match(/^class\s+(.+?)(?:\s+<<(.+)>>)?(?:\s*:::.+)?$/);
      if (classSingle && !line.includes("{")) {
        const classNode = ensureClass(state, classMap, classSingle[1], this.model);
        applyStereotype(classNode, classSingle[2]);
        continue;
      }
      if (currentClass) {
        const stereotype = line.match(/^<<(.+)>>$/);
        if (stereotype) {
          applyStereotype(currentClass, stereotype[1]);
          continue;
        }
        addMember(currentClass, parseMember(line, this.model));
        continue;
      }
      const relationship = parseRelationship(line);
      if (relationship) {
        const source = ensureClass(state, classMap, relationship.source, this.model);
        const target = ensureClass(state, classMap, relationship.target, this.model);
        state.relationships.push(this.model.createRelationship({
          sourceClassId: source.id,
          targetClassId: target.id,
          type: relationship.type,
          label: relationship.label,
          sourceMultiplicity: relationship.sourceMultiplicity,
          targetMultiplicity: relationship.targetMultiplicity
        }));
      }
    }

    if (!sawHeader && lines.length > 0) throw new Error("classDiagram ヘッダーが見つかりません。");
    if (state.classes.length === 0 && state.relationships.length === 0) throw new Error("読み取れるクラス図情報がありません。");
    state.classes = state.classes.map((classNode) => ({ ...classNode, size: measureClassPreferredSize(classNode) }));
    state.hasLayoutMetadata = applyLayoutMetadata(state, layoutMetadata);
    return state;
  }
}

function parseLayoutMetadata(lines) {
  const metadata = { classes: new Map(), viewport: null };
  for (const line of lines) {
    const match = line.match(/^%%\s*@design-maker:(class|viewport)\s+(.+?)\s*$/);
    if (!match) continue;
    try {
      const value = JSON.parse(match[2]);
      if (match[1] === "class" && isValidClassLayout(value)) metadata.classes.set(value.mermaidName, value);
      if (match[1] === "viewport" && isValidViewport(value)) metadata.viewport = value;
    } catch {
      // Invalid metadata is optional, so normal Mermaid import can continue.
    }
  }
  return metadata;
}

function applyLayoutMetadata(state, metadata) {
  let applied = false;
  state.classes = state.classes.map((classNode) => {
    const layout = metadata.classes.get(classNode.name);
    if (!layout) return classNode;
    applied = true;
    return { ...classNode, name: layout.name || classNode.name, position: layout.position, size: layout.size };
  });
  if (metadata.viewport) state.viewport = metadata.viewport;
  return applied;
}

function isValidClassLayout(value) {
  return typeof value?.mermaidName === "string" && isFinitePoint(value.position) && isFiniteSize(value.size);
}

function isValidViewport(value) {
  return isFinitePoint(value) && Number.isFinite(Number(value.scale));
}

function isFinitePoint(value) {
  return Number.isFinite(Number(value?.x)) && Number.isFinite(Number(value?.y));
}

function isFiniteSize(value) {
  return Number.isFinite(Number(value?.width)) && Number.isFinite(Number(value?.height));
}

function ensureClass(state, classMap, rawName, model) {
  const name = cleanName(rawName);
  if (classMap.has(name)) return classMap.get(name);
  const classNode = model.createClass({ name });
  state.classes.push(classNode);
  classMap.set(name, classNode);
  return classNode;
}

function cleanName(rawName) {
  return String(rawName || "Class").trim().replace(/^['\"]|['\"]$/g, "").replace(/:::.+$/, "").replace(/~.*$/, "");
}

function parseRelationship(line) {
  const relation = [...relationSyntax]
    .sort((a, b) => b.operator.length - a.operator.length)
    .find(({ operator }) => line.includes(` ${operator} `));
  if (!relation) return null;
  const parts = line.split(` ${relation.operator} `);
  if (parts.length !== 2) return null;
  const left = parseRelationEnd(parts[0], true);
  const right = parseRelationEnd(parts[1], false);
  if (!left || !right) return null;
  return relation.reverse
    ? { type: relation.type, source: right.name, target: left.name, label: right.label, sourceMultiplicity: right.multiplicity, targetMultiplicity: left.multiplicity }
    : { type: relation.type, source: left.name, target: right.name, label: right.label, sourceMultiplicity: left.multiplicity, targetMultiplicity: right.multiplicity };
}

function parseRelationEnd(value, isLeft) {
  const labelMatch = isLeft ? value.match(/^(.*?)$/) : value.match(/^(.*?)(?:\s*:\s*(.+))?$/);
  const text = labelMatch?.[1]?.trim();
  const match = isLeft
    ? text?.match(/^(.+?)(?:\s+\"([^\"]*)\")?$/)
    : text?.match(/^(?:\"([^\"]*)\"\s+)?(.+?)$/);
  if (!match) return null;
  return isLeft
    ? { name: cleanName(match[1]), multiplicity: match[2] ?? "", label: "" }
    : { name: cleanName(match[2]), multiplicity: match[1] ?? "", label: labelMatch[2]?.trim() ?? "" };
}

function applyStereotype(classNode, stereotype) {
  if (!stereotype) return;
  classNode.stereotype = stereotype;
  const normalized = stereotype.toLowerCase();
  if (["interface", "abstract", "enum", "enumeration"].includes(normalized)) classNode.kind = normalized === "enumeration" ? "enum" : normalized;
}

function addMember(classNode, member) {
  if (member.kind === "method") classNode.methods.push(member.value);
  if (member.kind === "property") classNode.properties.push(member.value);
}

function parseMember(line, model) {
  const visibilityMatch = line.match(/^([+#\-~])?(.*)$/);
  const visibility = symbolToVisibility[visibilityMatch[1]] ?? "public";
  let body = visibilityMatch[2].trim();
  const prefixStatic = body.startsWith("$");
  if (prefixStatic) body = body.slice(1);
  const prefixAbstract = body.startsWith("*");
  if (prefixAbstract) body = body.slice(1);
  const suffix = body.match(/([*$])$/)?.[1] ?? "";
  if (suffix) body = body.slice(0, -1).trim();
  const isStatic = prefixStatic || suffix === "$";
  const isAbstract = prefixAbstract || suffix === "*";

  const methodMatch = body.match(/^(.+?)\((.*)\)\s*([^\s].*)?$/);
  if (methodMatch) {
    return { kind: "method", value: model.createMethod({ name: methodMatch[1].trim(), visibility, isStatic, isAbstract, returnType: methodMatch[3]?.trim() ?? "", parameters: parseParameters(methodMatch[2], model) }) };
  }
  const [nameAndType, defaultValue = ""] = body.split(/\s*=\s*/, 2);
  const parts = nameAndType.trim().split(/\s+/);
  return { kind: "property", value: model.createProperty({ name: parts.shift() || "property", type: parts.join(" "), visibility, isStatic, isAbstract, defaultValue }) };
}

function parseParameters(rawParameters, model) {
  if (!rawParameters.trim()) return [];
  return rawParameters.split(",").map((parameter) => {
    const [namePart, typePart = ""] = parameter.trim().split(/\s*:\s*/, 2);
    const name = namePart.replace(/\?$/, "");
    return model.createParameter({ name, type: typePart, isOptional: namePart.endsWith("?") });
  });
}
