const controller = new DiagramController({
  svg: document.querySelector("#diagram-svg"),
  inspector: document.querySelector("#inspector"),
  modalRoot: document.querySelector("#modal-root"),
  addClassButton: document.querySelector("#add-class-button"),
  connectModeButton: document.querySelector("#connect-mode-button"),
  undoButton: document.querySelector("#undo-button"),
  deleteButton: document.querySelector("#delete-button"),
  importButton: document.querySelector("#import-button"),
  exportButton: document.querySelector("#export-button"),
  resetViewButton: document.querySelector("#reset-view-button"),
  zoomInButton: document.querySelector("#zoom-in-button"),
  zoomOutButton: document.querySelector("#zoom-out-button"),
  clearButton: document.querySelector("#clear-button"),
  relationshipTypeSelect: document.querySelector("#relationship-type-select"),
  statusMessage: document.querySelector("#status-message")
});

controller.init();
