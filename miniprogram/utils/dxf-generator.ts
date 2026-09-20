export function generateDXF(stockW: number, stockH: number, nodes: any[]): string {
  let dxf = `  0\nSECTION\n  2\nENTITIES\n`;

  const addLine = (x1: number, y1: number, x2: number, y2: number, layer: string, color: number) => {
    dxf += `  0\nLINE\n  8\n${layer}\n 62\n${color}\n 10\n${x1/10}\n 20\n${y1/10}\n 11\n${x2/10}\n 21\n${y2/10}\n`;
  };

  const addRect = (x: number, y: number, w: number, h: number, layer: string, color: number) => {
    addLine(x, y, x + w, y, layer, color);
    addLine(x + w, y, x + w, y + h, layer, color);
    addLine(x + w, y + h, x, y + h, layer, color);
    addLine(x, y + h, x, y, layer, color);
  };

  // Draw Stock Boundary (Layer: STOCK, Color: 7 - White/Black)
  addRect(0, 0, stockW, stockH, 'STOCK', 7);

  for (const node of nodes) {
    if (node.type === 'PART' || node.type === 'KERF' || node.type === 'OFFCUT') {
      const cadY = stockH - node.rect.y - node.rect.height;
      let layer = 'PARTS';
      let color = 3;
      if (node.type === 'KERF') { layer = 'KERF'; color = 1; }
      if (node.type === 'OFFCUT') { layer = 'OFFCUT'; color = 8; }
      addRect(node.rect.x/10, cadY/10, node.rect.width/10, node.rect.height/10, layer, color);
    }
  }

  dxf += `  0\nENDSEC\n  0\nEOF\n`;
  return dxf;
}
