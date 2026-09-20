"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateGCode = generateGCode;
function generateGCode(stockW, stockH, nodes) {
    let gcode = `; Qiaocai CAM G-Code Export\n`;
    gcode += `; Stock Size: ${stockW / 10}mm x ${stockH / 10}mm\n`;
    gcode += `G21 ; Set units to millimeters\n`;
    gcode += `G90 ; Absolute positioning\n`;
    gcode += `G28 ; Home axes\n`;
    gcode += `M3 S1000 ; Spindle ON\n\n`;
    const cutRect = (x, y, w, h, name) => {
        let block = `; Cut Part: ${name} (${w}x${h} mm)\n`;
        block += `G0 X${x} Y${y} ; Rapid move to start\n`;
        block += `G1 Z-3 F300 ; Plunge cut\n`;
        block += `G1 X${x + w} Y${y} F1000 ; Cut bottom edge\n`;
        block += `G1 X${x + w} Y${y + h} ; Cut right edge\n`;
        block += `G1 X${x} Y${y + h} ; Cut top edge\n`;
        block += `G1 X${x} Y${y} ; Cut left edge\n`;
        block += `G0 Z5 ; Retract\n\n`;
        return block;
    };
    for (const node of nodes) {
        if (node.type === 'PART') {
            const cadY = stockH - node.rect.y - node.rect.height;
            gcode += cutRect(node.rect.x / 10, cadY / 10, node.rect.width / 10, node.rect.height / 10, node.partName || node.id);
        }
    }
    gcode += `M5 ; Spindle OFF\n`;
    gcode += `G0 X0 Y0 ; Return to home\n`;
    gcode += `M30 ; End of program\n`;
    return gcode;
}
