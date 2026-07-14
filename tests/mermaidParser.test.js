const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const context = vm.createContext({ console });
for (const file of ["src/models/diagramModel.js", "src/services/classSizeService.js", "src/services/mermaidParser.js", "src/services/mermaidSerializer.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "..", file), "utf8"), context, { filename: file });
}
const MermaidParser = vm.runInContext("MermaidParser", context);
const MermaidSerializer = vm.runInContext("MermaidSerializer", context);

function relationshipByType(state, type) {
  return state.relationships.find((relationship) => relationship.type === type);
}

function className(state, id) {
  return state.classes.find((classNode) => classNode.id === id).name;
}

test("imports --|> inheritance by normalizing the parent as the source", () => {
  const state = new MermaidParser().parse("classDiagram\n  Child --|> Parent");
  const relationship = relationshipByType(state, "inheritance");
  assert.equal(className(state, relationship.sourceClassId), "Parent");
  assert.equal(className(state, relationship.targetClassId), "Child");
});

test("imports the eight Mermaid class relationship categories and multiplicities", () => {
  const state = new MermaidParser().parse(`classDiagram
    Parent <|-- Child
    Service <|.. ServiceImpl
    Whole *-- Part
    Group o-- Member
    A --> B
    Consumer ..> Provider
    Solid -- Other
    Dashed .. Remote
    Order "1" --> "0..*" Item : contains`);
  for (const type of ["inheritance", "implementation", "composition", "aggregation", "association", "dependency", "link", "dashedLink"]) {
    assert.ok(relationshipByType(state, type), `${type} was not imported`);
  }
  const orderRelation = state.relationships.find((relationship) => relationship.label === "contains");
  assert.equal(orderRelation.sourceMultiplicity, "1");
  assert.equal(orderRelation.targetMultiplicity, "0..*");
});

test("imports single-line members and Mermaid suffix classifiers", () => {
  const state = new MermaidParser().parse(`classDiagram
    class Account
    Account : -balance number$
    Account : +close() void*`);
  const account = state.classes.find((classNode) => classNode.name === "Account");
  assert.equal(account.properties[0].isStatic, true);
  assert.equal(account.methods[0].isAbstract, true);
});

test("exports all supported relationship categories with multiplicities", () => {
  const parser = new MermaidParser();
  const state = parser.parse(`classDiagram
    Parent <|-- Child
    Solid -- Other
    Dashed .. Remote
    Order "1" --> "0..*" Item : contains`);
  const output = new MermaidSerializer().serialize(state);
  assert.match(output, /Parent <\|-- Child/);
  assert.match(output, /Solid -- Other/);
  assert.match(output, /Dashed \.\. Remote/);
  assert.match(output, /Order "1" --> "0\.\.\*" Item : contains/);
});
