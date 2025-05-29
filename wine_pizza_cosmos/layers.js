import * as THREE from "https://unpkg.com/three@0.153.0/build/three.module.js?module";
export const layerNames = [
  "Varietal",
  "Wine Type",
  "Region",
  "State / AVA",
  "Pizza Style",
  "Topping"
];

export function colorFor(layer) {
  // 80 s neon gradient (magenta → green).
  const hue = 300 - layer * 30;          // 300°, 270°, 240° … 150°
  return new THREE.Color(`hsl(${hue},100%,60%)`);
}
