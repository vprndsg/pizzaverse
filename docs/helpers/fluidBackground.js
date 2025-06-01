import * as THREE from "https://unpkg.com/three@0.153.0/build/three.module.js?module";

export function createFluidBackground(scene) {
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      u_time: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float u_time;
      varying vec2 vUv;

      vec2 swirl(vec2 p, float t) {
        float r = length(p);
        float a = atan(p.y, p.x) + t * (0.2 + r * 0.5);
        return vec2(cos(a), sin(a)) * r;
      }

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        p = swirl(p, u_time * 0.5);
        vec3 col = 0.5 + 0.5 * cos(u_time + p.xyx + vec3(0.0, 2.0, 4.0));
        gl_FragColor = vec4(col, 0.25);
      }
    `,
    transparent: true,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}
