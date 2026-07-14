const controller = new DiagramController({
  svg: document.querySelector("#diagram-svg"),
  inspector: document.querySelector("#inspector"),
  modalRoot: document.querySelector("#modal-root"),
  addClassButton: document.querySelector("#add-class-button"),
  addGroupButton: document.querySelector("#add-group-button"),
  connectModeButton: document.querySelector("#connect-mode-button"),
  undoButton: document.querySelector("#undo-button"),
  deleteButton: document.querySelector("#delete-button"),
  alignGridButton: document.querySelector("#align-grid-button"),
  importButton: document.querySelector("#import-button"),
  exportButton: document.querySelector("#export-button"),
  zoomInButton: document.querySelector("#zoom-in-button"),
  zoomOutButton: document.querySelector("#zoom-out-button"),
  clearButton: document.querySelector("#clear-button"),
  relationshipTypeSelect: document.querySelector("#relationship-type-select"),
  statusMessage: document.querySelector("#status-message")
});

controller.init();

const analytics = new AnalyticsService({
  endpointUrl: "https://script.google.com/macros/s/AKfycbzfbpLNq94kQKRfr4m94dq75J63aRL_C2B2Qpf5uL_wg-eVj5U1fUV-If7H79IONxMI3w/exec"
});

analytics.trackPageView();
