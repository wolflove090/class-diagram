const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const context = vm.createContext({ console });
for (const file of ["src/models/diagramModel.js", "src/services/classSizeService.js", "src/services/mermaidParser.js", "src/services/mermaidSerializer.js", "src/views/svgRenderer.js"]) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, "..", file), "utf8"), context, { filename: file });
}
const MermaidParser = vm.runInContext("MermaidParser", context);
const MermaidSerializer = vm.runInContext("MermaidSerializer", context);
const DiagramModel = vm.runInContext("DiagramModel", context);
const getGroupClassIds = vm.runInContext("getGroupClassIds", context);

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

test("imports labeled and nested namespaces as groups", () => {
  const state = new MermaidParser().parse(`classDiagram
    namespace Platform["プラットフォーム"] {
      class Gateway
      namespace Auth["認証"] {
        class UserService
      }
    }`);
  const platform = state.groups.find((group) => group.name === "Platform");
  const auth = state.groups.find((group) => group.name === "Auth");
  const gateway = state.classes.find((classNode) => classNode.name === "Gateway");
  const userService = state.classes.find((classNode) => classNode.name === "UserService");
  assert.equal(platform.label, "プラットフォーム");
  assert.equal(auth.label, "認証");
  assert.equal(auth.parentId, platform.id);
  assert.deepEqual(Array.from(platform.classIds), [gateway.id]);
  assert.deepEqual(Array.from(auth.classIds), [userService.id]);
});

test("exports groups using Mermaid namespace syntax", () => {
  const state = new MermaidParser().parse(`classDiagram
    namespace Auth["認証"] {
      class UserService
    }`);
  const output = new MermaidSerializer().serialize(state);
  assert.match(output, /namespace Auth\["認証"\] \{/);
  assert.match(output, /class UserService \{/);
});

test("collects direct and nested group classes for group drag", () => {
  const ids = getGroupClassIds([
    { id: "platform", classIds: ["gateway"], parentId: null },
    { id: "auth", classIds: ["authService", "tokenService"], parentId: "platform" },
    { id: "data", classIds: ["repository"], parentId: "platform" }
  ], "platform");
  assert.deepEqual(Array.from(ids).sort(), ["authService", "gateway", "repository", "tokenService"]);
});

test("reverses relationship endpoints and multiplicities without changing its identity", () => {
  const model = new DiagramModel();
  let state = model.createInitialState();
  state = model.addClass(state, { id: "a", name: "A" });
  state = model.addClass(state, { id: "b", name: "B" });
  state = model.addRelationship(state, {
    id: "rel",
    sourceClassId: "a",
    targetClassId: "b",
    type: "association",
    label: "uses",
    sourceMultiplicity: "1",
    targetMultiplicity: "0..*"
  });

  const reversed = model.reverseRelationship(state, "rel");
  const relationship = reversed.relationships[0];
  assert.equal(relationship.id, "rel");
  assert.equal(relationship.sourceClassId, "b");
  assert.equal(relationship.targetClassId, "a");
  assert.equal(relationship.type, "association");
  assert.equal(relationship.label, "uses");
  assert.equal(relationship.sourceMultiplicity, "0..*");
  assert.equal(relationship.targetMultiplicity, "1");
});

test("exports and reimports a reversed relationship", () => {
  const model = new DiagramModel();
  let state = model.createInitialState();
  state = model.addClass(state, { id: "parent", name: "Parent" });
  state = model.addClass(state, { id: "child", name: "Child" });
  state = model.addRelationship(state, {
    sourceClassId: "parent",
    targetClassId: "child",
    type: "association",
    sourceMultiplicity: "1",
    targetMultiplicity: "0..*"
  });

  const reversed = model.reverseRelationship(state, state.relationships[0].id);
  const output = new MermaidSerializer().serialize(reversed);
  assert.match(output, /Child "0\.\.\*" --> "1" Parent/);
  const parsed = new MermaidParser().parse(output);
  const relationship = parsed.relationships[0];
  assert.equal(className(parsed, relationship.sourceClassId), "Child");
  assert.equal(className(parsed, relationship.targetClassId), "Parent");
  assert.equal(relationship.sourceMultiplicity, "0..*");
  assert.equal(relationship.targetMultiplicity, "1");
});
