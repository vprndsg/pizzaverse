import * as THREE from "https://unpkg.com/three@0.153.0/build/three.module.js?module";
import { OrbitControls } from "https://unpkg.com/three@0.153.0/examples/jsm/controls/OrbitControls.js?module";
import { CSS2DRenderer, CSS2DObject } from "https://unpkg.com/three@0.153.0/examples/jsm/renderers/CSS2DRenderer.js?module";
import { layerNames } from "./layers.js";
import { initNodeAnimationProps, setNodeScaleTarget, updateNodeScale } from "./interaction.js";

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
let selectedId = null;
let strongMap = {};

const clusterLabels = [];

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

  nodes.forEach(n=>{
    n.isImportant = neighbors[n.id].length >= threshold;
    const material = (n.category==='wine'?matWine:matPizza);
    const geometry = n.category==='wine' ? sphereGeo : diskGeo;
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(n.x,n.y,n.z); mesh.userData.id=n.id;
    initNodeAnimationProps(mesh);
    nodeGroup.add(mesh);
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
const matWine=new THREE.MeshPhongMaterial({color:wineColor});
const matPizza=new THREE.MeshPhongMaterial({color:pizzaColor});
const sphereGeo=new THREE.SphereGeometry(2.5,16,16);
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

  const byName = {};
  nodes.filter(n => n.layer === layerIdx).forEach(n => {
    if(!byName[n.label]) byName[n.label] = { sum:new THREE.Vector3(), count:0 };
    byName[n.label].sum.add(new THREE.Vector3(n.x,n.y,n.z));
    byName[n.label].count++;
  });
  Object.entries(byName).forEach(([name,info]) => {
    const pos = info.sum.multiplyScalar(1/info.count);
    const lbl = makeLabel(name.toUpperCase(), '#ff79ff', 18);
    lbl.position.copy(pos);
    scene.add(lbl);
    clusterLabels.push(lbl);
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
    const strong=(a===selectedId && (strongMap[selectedId]||[]).includes(b)) ||
                 (b===selectedId && (strongMap[selectedId]||[]).includes(a));
    if(strong){
      ln.material.color.set(0xffff00);
      ln.material.opacity=1;
    }else{
      ln.material.color.set(0x8844ff);
      ln.material.opacity=0.1;
    }
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

const ray=new THREE.Raycaster();const mouse=new THREE.Vector2();
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
  const r=renderer.domElement.getBoundingClientRect();
  mouse.x=((e.clientX-r.left)/r.width)*2-1;
  mouse.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(mouse,camera);
  const isects=ray.intersectObject(nodeGroup,true);
  if(isects.length){
    let obj=isects[0].object;if(obj.isSprite)obj=obj.parent;
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
renderer.domElement.addEventListener('pointerdown',e=>{
  const r=renderer.domElement.getBoundingClientRect();
  mouse.x=((e.clientX-r.left)/r.width)*2-1;
  mouse.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(mouse,camera);
  const isects=ray.intersectObject(nodeGroup,true);
  if(isects.length){
    let obj=isects[0].object;if(obj.isSprite)obj=obj.parent;
    const id=obj.userData.id;
    counts[id]=(counts[id]||0)+1; saveCookieCounts(counts);
    highlight(id);
    selectedId=id;
  }else{
    selectedId=null; highlight(null);
  }
  updateScaleTargets();
  updateLabelVisibility();
});

const linkK=0.05, linkLen=50, repK=50, centerK=0.1, damp=0.85;
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
    const show = (selectedId && (selectedId===n.id || (strongMap[selectedId]||[]).includes(n.id))) ||
                 (currentHover && currentHover.userData.id===n.id) ||
                 n.isImportant;
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
