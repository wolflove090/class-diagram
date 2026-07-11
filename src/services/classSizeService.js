const CLASS_SIZE_TEXT = {
  horizontalPadding: 32,
  minimumWidthPadding: 18,
  asciiCharWidth: 7.5,
  wideCharWidth: 13,
  lineHeight: 20,
  baseHeight: 88,
  stereotypeHeight: 22
};

function measureClassPreferredSize(classNode) {
  const lines = getClassSizeTextLines(classNode);
  const longestLineWidth = lines.reduce((maxWidth, line) => Math.max(maxWidth, measureTextWidth(line)), 0);
  return {
    width: Math.max(
      CLASS_MIN_SIZE.width,
      Math.ceil(longestLineWidth + CLASS_SIZE_TEXT.horizontalPadding + CLASS_SIZE_TEXT.minimumWidthPadding)
    ),
    height: measureClassContentHeight(classNode)
  };
}

function measureClassContentHeight(classNode) {
  const stereotypeExtra = classNode.stereotype || classNode.kind !== "class" ? CLASS_SIZE_TEXT.stereotypeHeight : 0;
  return Math.max(
    CLASS_MIN_SIZE.height,
    CLASS_SIZE_TEXT.baseHeight
      + stereotypeExtra
      + Math.max(1, classNode.properties.length) * CLASS_SIZE_TEXT.lineHeight
      + Math.max(1, classNode.methods.length) * CLASS_SIZE_TEXT.lineHeight
  );
}

function getClassSizeTextLines(classNode) {
  const lines = [classNode.name || "Class"];
  if (classNode.stereotype || classNode.kind !== "class") {
    lines.push(`<<${classNode.stereotype || classNode.kind}>>`);
  }
  if (classNode.properties.length === 0) {
    lines.push("プロパティなし");
  } else {
    lines.push(...classNode.properties.map((property) => formatClassProperty(property)));
  }
  if (classNode.methods.length === 0) {
    lines.push("メソッドなし");
  } else {
    lines.push(...classNode.methods.map((method) => formatClassMethod(method)));
  }
  return lines;
}

function formatClassProperty(property) {
  const visibility = visibilitySymbols[property.visibility] ?? "+";
  const flags = [property.isStatic ? "$" : "", property.isAbstract ? "*" : "", property.isReadonly ? "readonly " : ""].join("");
  const type = property.type ? `: ${property.type}` : "";
  const defaultValue = property.defaultValue ? ` = ${property.defaultValue}` : "";
  return `${visibility} ${flags}${property.name}${type}${defaultValue}`;
}

function formatClassMethod(method) {
  const visibility = visibilitySymbols[method.visibility] ?? "+";
  const params = method.parameters.map((parameter) => (
    `${parameter.name}${parameter.isOptional ? "?" : ""}${parameter.type ? `: ${parameter.type}` : ""}`
  )).join(", ");
  const type = method.returnType ? `: ${method.returnType}` : "";
  const flags = [method.isStatic ? "$" : "", method.isAbstract ? "*" : "", method.isAsync ? "async " : ""].join("");
  return `${visibility} ${flags}${method.name}(${params})${type}`;
}

function measureTextWidth(text) {
  return Array.from(String(text || "")).reduce((width, character) => {
    if (/[\u0000-\u007f]/.test(character)) return width + CLASS_SIZE_TEXT.asciiCharWidth;
    return width + CLASS_SIZE_TEXT.wideCharWidth;
  }, 0);
}
