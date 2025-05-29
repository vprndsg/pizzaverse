/* helpers/dragPhysics.js
 * Minimal utilities for node-dragging & tuned spring physics.
 */
export function planeFromCamera(camera) {
  // Infinite plane through controls.target, facing camera
  const normal = new THREE.Vector3().subVectors(camera.position, camera.target).normalize();
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, camera.target);
}

export function projectPointerToPlane(event, renderer, camera, plane) {
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, camera);
  const point = new THREE.Vector3();
  ray.ray.intersectPlane(plane, point);
  return point;
}

export const TUNED_PHYS = {
  linkK:        0.12,  // stiffer springs
  linkLen:      35,    // shorter resting distance
  repulsionK:   25,    // weaker repulsion so clusters come closer
  centerPull:   0.05   // gentle centering
};
