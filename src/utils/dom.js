function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function createElement(tagName, attributes = {}, children = []) {
  const element = document.createElement(tagName);
  assignAttributes(element, attributes);
  element.append(...children);
  return element;
}

function createSvgElement(tagName, attributes = {}, children = []) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  assignAttributes(element, attributes);
  element.append(...children);
  return element;
}

function assignAttributes(element, attributes) {
  for (const [key, value] of Object.entries(attributes)) {
    if (key.startsWith("on") && typeof value === "function") {
      element.addEventListener(key.slice(2).toLowerCase(), value);
      continue;
    }
    if (key === "className") {
      element.setAttribute("class", value);
      continue;
    }
    if (key === "dataset") {
      Object.assign(element.dataset, value);
      continue;
    }
    if (key === "textContent") {
      element.textContent = value;
      continue;
    }
    if (value === null || value === undefined || value === false) continue;
    element.setAttribute(key, value === true ? "" : String(value));
  }
}

function formValue(form, name) {
  const control = form.elements.namedItem(name);
  if (!control) return "";
  if (control.type === "checkbox") return control.checked;
  return control.value;
}
