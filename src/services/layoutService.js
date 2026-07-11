class LayoutService {
  applyInitialLayout(state) {
    const columns = Math.max(1, Math.ceil(Math.sqrt(state.classes.length)));
    const maxClassWidth = state.classes.reduce((maxWidth, classNode) => (
      Math.max(maxWidth, Number(classNode.size?.width ?? 230))
    ), 230);
    const maxClassHeight = state.classes.reduce((maxHeight, classNode) => (
      Math.max(maxHeight, Number(classNode.size?.height ?? 150))
    ), 150);
    const gapX = Math.max(300, maxClassWidth + 90);
    const gapY = Math.max(230, maxClassHeight + 80);
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
