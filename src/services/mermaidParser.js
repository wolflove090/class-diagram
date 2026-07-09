const relationPatterns = [
  ["inheritance", /(.+?)\s+<\|--\s+(.+?)(?:\s*:\s*(.+))?$/],
  ["implementation", /(.+?)\s+<\|\.\.\s+(.+?)(?:\s*:\s*(.+))?$/],
  ["dependency", /(.+?)\s+\.\.>\s+(.+?)(?:\s*:\s*(.+))?$/],
  ["association", /(.+?)\s+-->\s+(.+?)(?:\s*:\s*(.+))?$/],
  ["aggregation", /(.+?)\s+o--\s+(.+?)(?:\s*:\s*(.+))?$/],
  ["composition", /(.+?)\s+\*--\s+(.+?)(?:\s*:\s*(.+))?$/]
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
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("%%"));

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
      const classSingle = line.match(/^class\s+([^\s{]+)/);
      if (classSingle && !line.includes("{")) {
        ensureClass(state, classMap, classSingle[1].replace(/:::.+$/, ""), this.model);
        continue;
      }
      if (currentClass) {
        if (/^<<.+>>$/.test(line)) {
          const stereotype = line.slice(2, -2);
          currentClass.stereotype = stereotype;
          if (["interface", "abstract", "enum"].includes(stereotype)) currentClass.kind = stereotype;
          continue;
        }
        const member = parseMember(line, this.model);
        if (member.kind === "method") currentClass.methods.push(member.value);
        if (member.kind === "property") currentClass.properties.push(member.value);
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
          label: relationship.label
        }));
      }
    }

    if (!sawHeader && lines.length > 0) {
      throw new Error("classDiagram ヘッダーが見つかりません。");
    }
    if (state.classes.length === 0 && state.relationships.length === 0) {
      throw new Error("読み取れるクラス図情報がありません。");
    }
    return state;
  }
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
  return String(rawName || "Class").trim().replace(/^["']|["']$/g, "").replace(/:::.+$/, "");
}

function parseRelationship(line) {
  for (const [type, pattern] of relationPatterns) {
    const match = line.match(pattern);
    if (match) {
      return {
        type,
        source: cleanName(match[1]),
        target: cleanName(match[2]),
        label: match[3]?.trim() ?? ""
      };
    }
  }
  return null;
}

function parseMember(line, model) {
  const visibilityMatch = line.match(/^([+#\-~])?(.*)$/);
  const visibility = symbolToVisibility[visibilityMatch[1]] ?? "public";
  let body = visibilityMatch[2].trim();
  const isStatic = body.startsWith("$");
  if (isStatic) body = body.slice(1);
  const isAbstract = body.startsWith("*");
  if (isAbstract) body = body.slice(1);

  const methodMatch = body.match(/^(.+?)\((.*)\)\s*([^\s].*)?$/);
  if (methodMatch) {
    return {
      kind: "method",
      value: model.createMethod({
        name: methodMatch[1].trim(),
        visibility,
        isStatic,
        isAbstract,
        returnType: methodMatch[3]?.trim() ?? "",
        parameters: parseParameters(methodMatch[2], model)
      })
    };
  }

  const [nameAndType, defaultValue = ""] = body.split(/\s*=\s*/, 2);
  const parts = nameAndType.trim().split(/\s+/);
  const name = parts.shift() || "property";
  return {
    kind: "property",
    value: model.createProperty({
      name,
      type: parts.join(" "),
      visibility,
      isStatic,
      isAbstract,
      defaultValue
    })
  };
}

function parseParameters(rawParameters, model) {
  if (!rawParameters.trim()) return [];
  return rawParameters.split(",").map((parameter) => {
    const [namePart, typePart = ""] = parameter.trim().split(/\s*:\s*/, 2);
    const name = namePart.replace(/\?$/, "");
    return model.createParameter({
      name,
      type: typePart,
      isOptional: namePart.endsWith("?")
    });
  });
}
