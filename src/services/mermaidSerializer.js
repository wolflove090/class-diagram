const relationshipSyntax = {
  inheritance: "<|--",
  implementation: "<|..",
  dependency: "..>",
  association: "-->",
  aggregation: "o--",
  composition: "*--",
  link: "--",
  dashedLink: ".."
};

class MermaidSerializer {
  serialize(state) {
    const lines = ["classDiagram"];
    for (const relationship of state.relationships) {
      const source = state.classes.find((classNode) => classNode.id === relationship.sourceClassId);
      const target = state.classes.find((classNode) => classNode.id === relationship.targetClassId);
      if (!source || !target) continue;
      const sourceMultiplicity = relationship.sourceMultiplicity ? ` \"${relationship.sourceMultiplicity}\"` : "";
      const targetMultiplicity = relationship.targetMultiplicity ? ` \"${relationship.targetMultiplicity}\"` : "";
      const label = relationship.label ? ` : ${relationship.label}` : "";
      lines.push(`  ${safeName(source.name)}${sourceMultiplicity} ${relationshipSyntax[relationship.type] ?? "-->"}${targetMultiplicity} ${safeName(target.name)}${label}`);
    }
    for (const classNode of state.classes) {
      if (classNode.kind === "interface") lines.push(`  class ${safeName(classNode.name)}:::interface`);
      lines.push(`  class ${safeName(classNode.name)} {`);
      if (classNode.stereotype || classNode.kind !== "class") {
        lines.push(`    <<${classNode.stereotype || classNode.kind}>>`);
      }
      for (const property of classNode.properties) {
        lines.push(`    ${serializeProperty(property)}`);
      }
      for (const method of classNode.methods) {
        lines.push(`    ${serializeMethod(method)}`);
      }
      lines.push("  }");
    }
    if (state.classes.length > 0) {
      lines.push("");
      for (const classNode of state.classes) {
        lines.push(`%% @design-maker:class ${JSON.stringify({
          mermaidName: safeName(classNode.name),
          name: classNode.name,
          position: classNode.position,
          size: classNode.size
        })}`);
      }
      lines.push(`%% @design-maker:viewport ${JSON.stringify(state.viewport)}`);
    }
    return lines.join("\n");
  }
}

function serializeProperty(property) {
  const visibility = visibilitySymbols[property.visibility] ?? "+";
  const prefix = `${visibility}${property.isStatic ? "$" : ""}${property.isAbstract ? "*" : ""}`;
  const type = property.type ? ` ${property.type}` : "";
  const defaultValue = property.defaultValue ? ` = ${property.defaultValue}` : "";
  return `${prefix}${safeMember(property.name)}${type}${defaultValue}`;
}

function serializeMethod(method) {
  const visibility = visibilitySymbols[method.visibility] ?? "+";
  const prefix = `${visibility}${method.isStatic ? "$" : ""}${method.isAbstract ? "*" : ""}`;
  const params = method.parameters.map((parameter) => {
    const type = parameter.type ? `: ${parameter.type}` : "";
    const defaultValue = parameter.defaultValue ? ` = ${parameter.defaultValue}` : "";
    return `${safeMember(parameter.name)}${parameter.isOptional ? "?" : ""}${type}${defaultValue}`;
  }).join(", ");
  const returnType = method.returnType ? ` ${method.returnType}` : "";
  return `${prefix}${method.name}(${params})${returnType}`;
}

function safeName(name) {
  const trimmed = String(name || "Class").trim();
  if (/^[A-Za-z_\u00A0-\uFFFF][\w\-\u00A0-\uFFFF]*$/.test(trimmed)) return trimmed;
  return trimmed.replace(/[^\w\-\u00A0-\uFFFF]/g, "_") || "Class";
}

function safeMember(name) {
  return String(name || "member").trim().replace(/\s+/g, "_") || "member";
}
