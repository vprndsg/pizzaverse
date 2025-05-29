export function initNodeAnimationProps(mesh) {
  mesh.userData.scaleTarget = 1;
  mesh.userData.scaleSpeed = 6;
}

export function setNodeScaleTarget(mesh, target) {
  mesh.userData.scaleTarget = target;
}

export function updateNodeScale(mesh, dt) {
  const target = mesh.userData.scaleTarget ?? 1;
  const speed = mesh.userData.scaleSpeed ?? 6;
  const current = mesh.scale.x;
  const diff = target - current;
  if (Math.abs(diff) < 0.001) {
    mesh.scale.set(target, target, target);
    return;
  }
  const step = diff * Math.min(speed * dt, 1);
  const newScale = current + step;
  mesh.scale.set(newScale, newScale, newScale);
}
