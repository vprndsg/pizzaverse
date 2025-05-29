import * as THREE from "https://unpkg.com/three@0.153.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.153.0/examples/jsm/controls/OrbitControls.js";
import { nodes as rawNodes, links as rawLinks } from "./data.js";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio || 1);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.zoomSpeed = 0.5;
controls.panSpeed = 0.5;
controls.minDistance = 20;
controls.maxDistance = 500;

const nodes = rawNodes.map(n => ({ ...n, 
  x:(Math.random()-0.5)*100,
  y:(Math.random()-0.5)*100,
  z:(Math.random()-0.5)*100,
  vx:0,vy:0,vz:0,
  mass:1,
  glowSprite:null,
  glowBaseScale:1
}));
const nodeIndex = {};
nodes.forEach((n,i)=>nodeIndex[n.id]=i);
const links = rawLinks.map(l=>({source:nodeIndex[l.source],target:nodeIndex[l.target],strength:l.strength}));
const neighbors = {};
nodes.forEach(n=>neighbors[n.id]=[]);
links.forEach(l=>{
  neighbors[nodes[l.source].id].push(nodes[l.target].id);
  neighbors[nodes[l.target].id].push(nodes[l.source].id);
});

function getCookieCounts(){
  const m=document.cookie.match(/(?:^|;)\s*interactions=([^;]+)/);
  if(!m)return {};
  try{return JSON.parse(decodeURIComponent(m[1]));}catch{ return {}; }
}
function saveCookieCounts(obj){
  const e=new Date(); e.setFullYear(e.getFullYear()+1);
  document.cookie="interactions="+encodeURIComponent(JSON.stringify(obj))+";expires="+e.toUTCString()+";path=/";
}
let counts=getCookieCounts();
for(const [id,c] of Object.entries(counts)){ if(nodeIndex[id]!=null) nodes[nodeIndex[id]].mass=1+c;}

const nodeGroup=new THREE.Group(), lineGroup=new THREE.Group();
scene.add(nodeGroup); scene.add(lineGroup);

const wineColor=new THREE.Color(0xff33ff), pizzaColor=new THREE.Color(0x33fff2);
const matWine=new THREE.MeshBasicMaterial({color:wineColor});
const matPizza=new THREE.MeshBasicMaterial({color:pizzaColor});
const sphereGeo=new THREE.SphereGeometry(2.5,16,16);

const glowTex=(()=>{const s=64,cv=document.createElement('canvas');cv.width=cv.height=s;
const ctx=cv.getContext('2d');const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');
ctx.fillStyle=g;ctx.fillRect(0,0,s,s);return new THREE.CanvasTexture(cv);})();
const spriteMat=new THREE.SpriteMaterial({map:glowTex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true});

const threshold=2;
nodes.forEach(n=>{
  const mat=n.category==='wine'?matWine:matPizza;
  const mesh=new THREE.Mesh(sphereGeo,mat);
  mesh.position.set(n.x,n.y,n.z); mesh.userData.id=n.id;
  nodeGroup.add(mesh);
  if(neighbors[n.id].length>=threshold){
    const glow=new THREE.Sprite(spriteMat.clone());
    glow.material.color.set(n.category==='wine'?wineColor:pizzaColor);
    const base=8*(1+0.3*(neighbors[n.id].length-1));
    glow.scale.set(base,base,1);
    n.glowSprite=glow; n.glowBaseScale=base;
    mesh.add(glow);
  }
});

const lineMat=new THREE.LineBasicMaterial({color:0x8844ff,transparent:true,opacity:0.8});
links.forEach(l=>{
  const a=nodes[l.source],b=nodes[l.target];
  const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([a.x,a.y,a.z,b.x,b.y,b.z],3));
  lineGroup.add(new THREE.Line(g,lineMat));
});

const ray=new THREE.Raycaster();const mouse=new THREE.Vector2();
let pulseIdx=[];
function highlight(id){
  pulseIdx=[];
  if(!id)return;
  const add=(idx)=>{if(nodes[idx].glowSprite&&!pulseIdx.includes(idx))pulseIdx.push(idx);};
  add(nodeIndex[id]);neighbors[id].forEach(nid=>add(nodeIndex[nid]));
}
renderer.domElement.addEventListener('pointermove',e=>{
  const r=renderer.domElement.getBoundingClientRect();
  mouse.x=((e.clientX-r.left)/r.width)*2-1;
  mouse.y=-((e.clientY-r.top)/r.height)*2+1;
  ray.setFromCamera(mouse,camera);
  const isects=ray.intersectObject(nodeGroup,true);
  if(isects.length){
    let obj=isects[0].object;if(obj.isSprite)obj=obj.parent;
    highlight(obj.userData.id);
  }else highlight(null);
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
  }
});

const linkK=0.05, linkLen=50, repK=50, centerK=0.1, damp=0.85;
function physics(){
  nodes.forEach(n=>{n.fx=n.fy=n.fz=0;});
  links.forEach(l=>{
    const A=nodes[l.source],B=nodes[l.target];
    let dx=B.x-A.x,dy=B.y-A.y,dz=B.z-A.z;const dist=Math.hypot(dx,dy,dz)||0.001;
    const f=linkK*l.strength*(dist-linkLen); dx/=dist;dy/=dist;dz/=dist;
    A.fx+=dx*f;A.fy+=dy*f;A.fz+=dz*f; B.fx-=dx*f;B.fy-=dy*f;B.fz-=dz*f;
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
const t0=performance.now();
function animate(){
  requestAnimationFrame(animate);
  physics();
  const t=(performance.now()-t0)*0.001;
  pulseIdx.forEach(i=>{
    const n=nodes[i]; const scale=n.glowBaseScale*(1+0.3*Math.sin(t*4));
    if(n.glowSprite)n.glowSprite.scale.set(scale,scale,1);
  });
  controls.update(); renderer.render(scene,camera);
}
animate();

window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth,window.innerHeight);
});
