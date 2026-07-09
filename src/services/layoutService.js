class LayoutService {
  applyInitialLayout(state) {
    const columns = Math.max(1, Math.ceil(Math.sqrt(state.classes.length)));
    const gapX = 300;
    const gapY = 230;
    return {
      ...state,
      classes: state.classes.map((classNode, index) => ({
        ...classNode,
        position: {
          x: 80 + (index % columns) * gapX,
          y: 80 + Math.floor(index / columns) * gapY
        }
      })),
      viewport: { x: 0, y: 0, scale: 1 },
      selection: state.classes[0] ? { type: "class", id: state.classes[0].id } : null
    };
  }
}
