import * as THREE from "https://unpkg.com/three@0.153.0/build/three.module.js?module";
import { OrbitControls } from "https://unpkg.com/three@0.153.0/examples/jsm/controls/OrbitControls.js?module";
import { CSS2DRenderer, CSS2DObject } from "https://unpkg.com/three@0.153.0/examples/jsm/renderers/CSS2DRenderer.js?module";
import { layerNames } from "./layers.js";
import { initNodeAnimationProps, setNodeScaleTarget, updateNodeScale } from "./interaction.js";
import {
  planeFromCamera,
  projectPointerToPlane,
  TUNED_PHYS
} from './helpers/dragPhysics.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio || 1);
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

const slider = document.getElementById("layerSlider");
const label  = document.getElementById("layerLabel");
const showAllToggle = document.getElementById("showAll");
let activeLayer = parseInt(slider.value, 10);
label.textContent = layerNames[activeLayer];
slider.oninput = e => {
  activeLayer = parseInt(e.target.value, 10);
  label.textContent = layerNames[activeLayer];
  startLayerAnimation();
  updateLayerVisibility();
  applySelection();
};
if(showAllToggle) showAllToggle.onchange = updateLayerVisibility;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.zoomSpeed = 0.5;
controls.panSpeed = 0.5;
controls.minDistance = 20;
controls.maxDistance = 500;

let nodes = [];
let nodeIndex = {};
let links = [];
let neighbors = {};
let counts = {};
let targets = [];
let animStart = 0;
let animating = false;
let flyStart = 0;
let flyDuration = 1000; // ms
let flying = false;
const flyFromPos = new THREE.Vector3();
const flyToPos = new THREE.Vector3();
const flyFromTarget = new THREE.Vector3();
const flyToTarget = new THREE.Vector3();
let draggingNode = null;
let dragPlane    = null;
let strongMap = {};
const visibleSet    = new Set();

let pointerDownPos = null;
let pointerDownOnEmpty = false;
let pointerDragged = false;

const clusterLabels = [];
const pickables = [];

const fadeInStart = 50;
const fadeInEnd = 30;
const fadeOutStart = 70;
const fadeOutEnd = 100;

let currentHover = null;

function makeLabel(txt, color = '#fff', size = 12) {
  const div = document.createElement('div');
  div.textContent = txt;
  div.style.color = color;
  div.style.font = `bold ${size}px sans-serif`;
  div.style.whiteSpace = 'nowrap';
  div.style.textShadow = '0 0 4px #000';
  div.style.transition = 'opacity 0.5s';
  div.style.opacity = '0';
  return new CSS2DObject(div);
}

function buildGraph(rawNodes, rawLinks){
  nodes = rawNodes.map(n => ({
    ...n,
    category: n.layer <= 3 ? 'wine' : 'pizza',
    x:(Math.random()-0.5)*100,
    y:(Math.random()-0.5)*100,
    z:(Math.random()-0.5)*100,
    vx:0,vy:0,vz:0,
    mass:1,
    glowSprite:null,
    glowBaseScale:1
  }));
  nodeIndex = {};
  nodes.forEach((n,i)=>nodeIndex[n.id]=i);
  links = rawLinks.map(l=>({source:nodeIndex[l.source],target:nodeIndex[l.target],strength:l.strength}));
  neighbors = {};
  nodes.forEach(n=>neighbors[n.id]=[]);
  strongMap={};
  links.forEach(l=>{
    neighbors[nodes[l.source].id].push(nodes[l.target].id);
    neighbors[nodes[l.target].id].push(nodes[l.source].id);
    if(l.strength>0.8){
      const a=nodes[l.source].id,b=nodes[l.target].id;
      if(!strongMap[a])strongMap[a]=[]; if(!strongMap[b])strongMap[b]=[];
      strongMap[a].push(b); strongMap[b].push(a);
    }
  });

  counts=getCookieCounts();
  for(const [id,c] of Object.entries(counts)){ if(nodeIndex[id]!=null) nodes[nodeIndex[id]].mass=1+c;}

  nodeGroup.clear();
  lineGroup.clear();
  pickables.length = 0;

  nodes.forEach(n=>{
    n.isImportant = neighbors[n.id].length >= threshold;
    const baseMat = n.category === 'wine' ? matWine : matPizza;
    const geometry = n.category === 'wine' ? sphereGeo : diskGeo;
    const mesh = new THREE.Mesh(geometry, baseMat.clone());
    mesh.position.set(n.x,n.y,n.z);
    mesh.userData.id=n.id;
    mesh.userData.isNode = true;
    initNodeAnimationProps(mesh);
    nodeGroup.add(mesh);
    pickables.push(mesh);
    n.mesh = mesh;
    const lbl = makeLabel(n.label, '#fff', 11);
    if(!n.isImportant) lbl.element.style.opacity = '0';
    mesh.add(lbl);
    n.labelObj = lbl;
    if(neighbors[n.id].length>=threshold){
      const glow=new THREE.Sprite(spriteMat.clone());
      glow.material.color.set(n.category==='wine'?wineColor:pizzaColor);
      const base=8*(1+0.3*(neighbors[n.id].length-1));
      glow.scale.set(base,base,1);
      n.glowSprite=glow; n.glowBaseScale=base;
      mesh.add(glow);
    }
  });

  links.forEach(l=>{
    const a=nodes[l.source],b=nodes[l.target];
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([a.x,a.y,a.z,b.x,b.y,b.z],3));
    const ln = new THREE.Line(g,lineMat.clone());
    lineGroup.add(ln);
    l.obj = ln;
  });

  updateLayerVisibility();
  animate();
}

function getCookieCounts(){
  const m=document.cookie.match(/(?:^|;)\s*interactions=([^;]+)/);
  if(!m)return {};
  try{return JSON.parse(decodeURIComponent(m[1]));}catch{ return {}; }
}
function saveCookieCounts(obj){
  const e=new Date(); e.setFullYear(e.getFullYear()+1);
  document.cookie="interactions="+encodeURIComponent(JSON.stringify(obj))+";expires="+e.toUTCString()+";path=/";
}
const nodeGroup=new THREE.Group(), lineGroup=new THREE.Group();
scene.add(nodeGroup); scene.add(lineGroup);

const wineColor=new THREE.Color(0x8B0038);
const pizzaColor=new THREE.Color(0xEFBF4C);
const matWine  = new THREE.MeshPhongMaterial({ color:wineColor,  transparent:true });
const matPizza = new THREE.MeshPhongMaterial({ color:pizzaColor, transparent:true });
const sphereGeo=new THREE.SphereGeometry(2.5,16,16);
sphereGeo.computeBoundingSphere();
sphereGeo.boundingSphere.radius*=1.4;
const diskGeo=new THREE.CylinderGeometry(2.5,2.5,1,16);
diskGeo.rotateX(Math.PI/2);

const glowTex=(()=>{const s=64,cv=document.createElement('canvas');cv.width=cv.height=s;
const ctx=cv.getContext('2d');const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');
ctx.fillStyle=g;ctx.fillRect(0,0,s,s);return new THREE.CanvasTexture(cv);})();
const spriteMat=new THREE.SpriteMaterial({map:glowTex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true});

const threshold=2;
const lineMat=new THREE.LineBasicMaterial({color:0x8844ff,transparent:true,opacity:0.8});

function buildClusterLabels(layerIdx){
  clusterLabels.forEach(o => scene.remove(o));
  clusterLabels.length = 0;

  const layerNodes = nodes.filter(n => n.layer === layerIdx);

  layerNodes.forEach(n => {
    const lbl = makeLabel(n.label.toUpperCase(), '#ff79ff', 18);
    lbl.position.set(n.x, n.y, n.z);
    lbl.userData.id = n.id;
    scene.add(lbl);
    clusterLabels.push(lbl);
  });
}

function updateClusterLabelPositions() {
  clusterLabels.forEach(lbl => {
    const nodeId = lbl.userData.id;
    const node = nodes[nodeIndex[nodeId]];
    if(node) lbl.position.set(node.x, node.y, node.z);
  });
}

function highlightLines(){
  lineGroup.children.forEach((ln,i)=>{
    if(!selectedId){
      ln.material.color.set(0x8844ff);
      ln.material.opacity=0.2;
      return;
    }
    const a=nodes[links[i].source].id;
    const b=nodes[links[i].target].id;
    const connected=(a===selectedId || b===selectedId);
    if(connected){
      ln.material.color.set(0xffff00);
      ln.material.opacity=1;
    }else{
      ln.material.color.set(0x8844ff);
      ln.material.opacity=0.1;
    }
  });
}

function setLabel(nodeObj, show) {
  const el = nodeObj.children.find(o => o.isCSS2DObject)?.element;
  if (!el) return;
  el.dataset.force = show ? '1' : '0';  // set the forced visibility flag
}

function refreshLabels() {
  nodeGroup.children.forEach(n => setLabel(n, false));
  visibleSet.clear();

  if (!selectedId) return;

  visibleSet.add(selectedId);
  const neighbours = neighbors[selectedId] || [];
  neighbours.forEach(id => visibleSet.add(id));

  nodeGroup.children.forEach(n => {
    if (visibleSet.has(n.userData.id)) setLabel(n, true);
  });
}

function updateLayerVisibility() {
  const showAll = showAllToggle && showAllToggle.checked;
  nodeGroup.children.forEach(mesh => {
    const L = nodes[nodeIndex[mesh.userData.id]].layer;
    mesh.visible = showAll || (L === activeLayer);
  });
  lineGroup.children.forEach((line, i) => {
    const { source, target } = links[i];
    const LA = nodes[source].layer;
    const LB = nodes[target].layer;
    line.visible = showAll || (LA === activeLayer || LB === activeLayer);
  });
  buildClusterLabels(activeLayer);
  updateLabelVisibility();
}

function applySelection () {
  const connected = new Set();
  if (selectedId) neighbors[selectedId].forEach(id => connected.add(id));

  const showAll = showAllToggle && showAllToggle.checked;

  // nodes
  nodeGroup.children.forEach(m => {
    const id   = m.userData.id;
    const L    = nodes[nodeIndex[id]].layer;
    const seen = selectedId && (id === selectedId || connected.has(id));

    m.material.transparent = true;
    m.material.opacity     = selectedId ? (seen ? 1 : 0.15) : 1;
    m.visible              = selectedId ? seen : (showAll || L === activeLayer);

    if (m.glowSprite) m.glowSprite.material.opacity = selectedId ? (seen ? 1 : 0.05) : 1;
  });

  // links
  lineGroup.children.forEach((ln, i) => {
    const { source, target } = links[i];
    const LA = nodes[source].layer, LB = nodes[target].layer;
    const baseVisible = showAll || (LA === activeLayer || LB === activeLayer);
    const seen = selectedId && (nodes[source].id === selectedId || nodes[target].id === selectedId);

    ln.visible           = selectedId ? seen : baseVisible;
    ln.material.opacity  = selectedId && !seen ? 0.15 : ln.material.opacity;
    ln.material.color.set(seen ? 0xffff00 : 0x8844ff);
  });

  refreshLabels();
}

const ray=new THREE.Raycaster();const mouse=new THREE.Vector2();
let selectedId = null;                 // current focus, or null
const linkBase = new Map();            // remembers original strengths
let pulseIdx=[];
function highlight(id){
  pulseIdx=[];
  if(!id)return;
  const add=(idx)=>{if(nodes[idx].glowSprite&&!pulseIdx.includes(idx))pulseIdx.push(idx);};
  add(nodeIndex[id]);neighbors[id].forEach(nid=>add(nodeIndex[nid]));
}

function updateScaleTargets(){
  nodes.forEach(n=>{
    let target=1;
    if(selectedId===n.id){
      target=1.3;
    }else if(currentHover && currentHover.userData.id===n.id){
      target=1.2;
    }
    setNodeScaleTarget(n.mesh, target);
  });
}
renderer.domElement.addEventListener('pointermove',e=>{
  if (pointerDownPos) {
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    if (Math.hypot(dx, dy) > 4) pointerDragged = true;
  }
  if (draggingNode) {
    const point = projectPointerToPlane(e, renderer, camera, dragPlane);
    draggingNode.position.copy(point);
    const nData = nodes[nodeIndex[draggingNode.userData.id]];
    nData.x = point.x; nData.y = point.y; nData.z = point.z;
    nData.vx = nData.vy = nData.vz = 0;
    return;
  }

  const r=renderer.domElement.getBoundingClientRect();
  mouse.x=((e.clientX-r.left)/r.width)*2-1;
  mouse.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(mouse,camera);
  const visiblePickables = pickables.filter(obj => obj.visible);
  const hit = ray.intersectObjects(visiblePickables, false)[0];
  if(hit){
    let obj=hit.object;
    if(currentHover && currentHover!==obj){
      highlight(null);
    }
    currentHover=obj;
    highlight(obj.userData.id);
  }else{
    currentHover=null;
    highlight(null);
  }
  updateScaleTargets();
  updateLabelVisibility();
});

function selectNode (id) {
  selectedId = id;

  // make springs stiffer on the star node
  links.forEach(l => {
    const picks = l.source === nodeIndex[id] || l.target === nodeIndex[id];
    if (picks) {
      if (!linkBase.has(l)) linkBase.set(l, l.strength);
      l.strength = linkBase.get(l) * 2;
    } else if (linkBase.has(l)) {
      l.strength = linkBase.get(l);
    }
  });

  // smoothly move the camera toward the node
  startFlyTo(nodes[nodeIndex[id]]);

  applySelection();
}

function clearSelection () {
  selectedId = null;
  linkBase.forEach((s, l) => (l.strength = s));
  applySelection();
}
renderer.domElement.addEventListener('pointerdown', e => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
  pointerDragged = false;
  const r = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(mouse, camera);

  const visiblePickables = pickables.filter(obj => obj.visible);
  const hit = ray.intersectObjects(visiblePickables, false)[0];
  pointerDownOnEmpty = !(hit && hit.object.userData.isNode);
  if (pointerDownOnEmpty) return;

  const id = hit.object.userData.id;
  if (id !== selectedId) selectNode(id);
});

renderer.domElement.addEventListener('dblclick', e => {
  const r = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(mouse, camera);

  const visiblePickables = pickables.filter(obj => obj.visible);
  const hit = ray.intersectObjects(visiblePickables, false)[0];
  if (!hit || !hit.object.userData.isNode) return;

  const id = hit.object.userData.id;
  if (id === selectedId) clearSelection();
});

window.addEventListener('pointerup', () => {
  if (draggingNode) {
    setNodeScaleTarget(draggingNode, 1.2);
    draggingNode = null;
    controls.enabled = true;
  }
  if (pointerDownPos && pointerDownOnEmpty && !pointerDragged) {
    clearSelection();
  }
  pointerDownPos = null;
});

const {linkK, linkLen, repulsionK:repK, centerPull:centerK} = TUNED_PHYS;
const damp=0.85;
function physics(){
  nodes.forEach(n=>{n.fx=n.fy=n.fz=0;});
  links.forEach(l=>{
    const A=nodes[l.source],B=nodes[l.target];
    const boostA = counts[nodes[l.source].id] || 0;
    const boostB = counts[nodes[l.target].id] || 0;
    l.strength += 0.0003 * (boostA + boostB);
    let dx=B.x-A.x,dy=B.y-A.y,dz=B.z-A.z;const dist=Math.hypot(dx,dy,dz)||0.001;
    const f=linkK*l.strength*(dist-linkLen); dx/=dist;dy/=dist;dz/=dist;
    A.fx+=dx*f;A.fy+=dy*f;A.fz+=dz*f; B.fx-=dx*f;B.fy-=dy*f;B.fz-=dz*f;
    [l.source, l.target].forEach(idx => {
      const n = nodes[idx];
      if (n.glowSprite) {
        const alpha = Math.min(l.strength, 2) * 0.5;
        n.glowSprite.material.opacity = alpha;
      }
    });
  });
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const A=nodes[i], B=nodes[j];
    let dx=B.x-A.x, dy=B.y-A.y, dz=B.z-A.z;
    const d2 = dx*dx + dy*dy + dz*dz || 0.001;
    const d = Math.sqrt(d2);
    const f = repK/d2; dx/=d; dy/=d; dz/=d;
    A.fx -= dx*f; A.fy -= dy*f; A.fz -= dz*f; 
    B.fx += dx*f; B.fy += dy*f; B.fz += dz*f;
  }
  nodes.forEach(n=>{ n.fx+=-centerK*n.x; n.fy+=-centerK*n.y; n.fz+=-centerK*n.z;});
  nodes.forEach(n=>{
    n.vx=(n.vx+n.fx/n.mass)*damp; n.vy=(n.vy+n.fy/n.mass)*damp; n.vz=(n.vz+n.fz/n.mass)*damp;
    n.x+=n.vx; n.y+=n.vy; n.z+=n.vz;
    const obj=nodeGroup.children.find(o=>o.userData.id===n.id);
    obj.position.set(n.x,n.y,n.z);
  });
  lineGroup.children.forEach((l,i)=>{
    const pos=l.geometry.attributes.position.array;
    const A=nodes[links[i].source],B=nodes[links[i].target];
    pos[0]=A.x;pos[1]=A.y;pos[2]=A.z;pos[3]=B.x;pos[4]=B.y;pos[5]=B.z;
    l.geometry.attributes.position.needsUpdate=true;
  });
}

function startLayerAnimation(){
  targets = nodes.map(n=>({x:n.x,y:n.y,z:n.z}));
  const layerNodes = nodes.filter(n=>n.layer===activeLayer);
  if(!layerNodes.length) return;
  const centroid={x:0,y:0,z:0};
  layerNodes.forEach(n=>{centroid.x+=n.x;centroid.y+=n.y;centroid.z+=n.z;});
  centroid.x/=layerNodes.length; centroid.y/=layerNodes.length; centroid.z/=layerNodes.length;
  const radius=60;
  layerNodes.forEach((n,i)=>{
    const a=i*2*Math.PI/layerNodes.length;
    targets[nodeIndex[n.id]]={x:centroid.x+radius*Math.cos(a),y:centroid.y+radius*Math.sin(a),z:centroid.z};
  });
  nodes.forEach(n=>{ if(n.layer!==activeLayer) targets[nodeIndex[n.id]]={x:centroid.x*0.2,y:centroid.y*0.2,z:centroid.z*0.2}; });
  animStart=performance.now(); animating=true;
}

function updateAnimation(){
  if(!animating) return;
  const t=(performance.now()-animStart)/1000;
  const ease=Math.min(1,t/1); // 1s
  nodes.forEach((n,i)=>{
    const trg=targets[i];
    if(!trg) return;
    n.x+= (trg.x-n.x)*0.1;
    n.y+= (trg.y-n.y)*0.1;
    n.z+= (trg.z-n.z)*0.1;
  });
  if(ease>=1) animating=false;
}

function startFlyTo(target){
  flyFromPos.copy(camera.position);
  flyFromTarget.copy(controls.target);
  const offset = camera.position.clone().sub(controls.target);
  flyToTarget.copy(target);
  flyToPos.copy(target).add(offset);
  flyStart = performance.now();
  flying = true;
}

function updateFly(){
  if(!flying) return;
  const t = (performance.now() - flyStart) / flyDuration;
  const ease = t <= 0 ? 0 : t >= 1 ? 1 : t*t*(3 - 2*t); // smoothstep
  camera.position.lerpVectors(flyFromPos, flyToPos, ease);
  controls.target.lerpVectors(flyFromTarget, flyToTarget, ease);
  if(t >= 1){
    flying = false;
  }
}

function updateLabelVisibility(){
  const dist = camera.position.distanceTo(controls.target);
  const t = dist <= fadeInEnd ? 1 : dist >= fadeOutStart ? 0 : 1 - (dist - fadeInStart)/(fadeOutStart - fadeInStart);

  clusterLabels.forEach(o => {
    let op = 0;
    if(dist > fadeOutStart){
      op = Math.min((dist - fadeOutStart)/(fadeOutEnd - fadeOutStart),1);
    }
    o.element.style.opacity = op;
  });

  nodes.forEach(n => {
    const el = n.labelObj.element;
    const isSelected = selectedId && selectedId === n.id;
    const isNeighbor = selectedId && (neighbors[selectedId] || []).includes(n.id);
    const isHover = currentHover && currentHover.userData.id === n.id;
    const isActiveImportant = n.layer === activeLayer && n.isImportant;
    const show = isSelected || isNeighbor || isHover || isActiveImportant;
    el.style.opacity = show ? t : 0;

  });
  highlightLines();
}
const t0=performance.now();
const clock = new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  physics();
  updateAnimation();
  updateFly();
  updateClusterLabelPositions();
  updateLabelVisibility();
  const dt = clock.getDelta();
  nodeGroup.children.forEach(m=>updateNodeScale(m, dt));
  const t=(performance.now()-t0)*0.001;
  pulseIdx.forEach(i=>{
    const n=nodes[i]; const scale=n.glowBaseScale*(1+0.3*Math.sin(t*4));
    if(n.glowSprite)n.glowSprite.scale.set(scale,scale,1);
  });
  controls.update();
  renderer.render(scene,camera);
  labelRenderer.render(scene,camera);
}

Promise.all([fetch('nodes.json').then(r=>r.json()), fetch('links.json').then(r=>r.json())])
  .then(([n,l])=>buildGraph(n,l));

window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth,window.innerHeight);
});
