import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { cds, createPlaylistPanel } from './collection.js';

const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false }); }
catch { status.textContent = 'This viewer needs a browser with WebGL enabled.'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0xffffff);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
camera.position.set(0, 0, 4.6);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = .075;
controls.enablePan = false;
controls.minDistance = 2.8;
controls.maxDistance = 7;
controls.rotateSpeed = .65;
// No polar restriction: the disc itself is freely rotated with a quaternion.
controls.enableRotate = false;

// A photographic studio environment: large luminous panels reflected by the PBR surface.
const studio = new THREE.Scene();
studio.background = new THREE.Color(.48, .48, .48);
function panel(position, scale, intensity) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...scale), new THREE.MeshBasicMaterial({color:new THREE.Color(intensity,intensity,intensity),side:THREE.DoubleSide}));
  mesh.position.set(...position); mesh.lookAt(0,0,0); studio.add(mesh);
}
panel([-3,2,4],[2,5],7); panel([3,1,2],[1,4],5); panel([0,4,-2],[5,2],6); panel([-2,-2,-3],[2,3],3);
const pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(studio, .04);
scene.environment = environment.texture;
pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xffffff,0xcfc6d2,2));
const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(-3,4,5); scene.add(light);

let disc = new THREE.Group(); scene.add(disc);
const radius = 1, hole = .124, hubRadius = .294, thickness = .020;
// Annular mesh with a real hole and sealed outer/inner walls, in the XY plane.
function annulus(inner, outer, depth, segments=256) {
  const shape = new THREE.Shape(); shape.absarc(0,0,outer,0,Math.PI*2,false);
  const cutout = new THREE.Path(); cutout.absarc(0,0,inner,0,Math.PI*2,true); shape.holes.push(cutout);
  const geometry = new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:segments/4,steps:1});
  geometry.translate(0,0,-depth/2); return geometry;
}
function faceGeometry(inner,outer) {
  const geometry = new THREE.RingGeometry(inner,outer,256,2);
  const pos = geometry.attributes.position, uv = geometry.attributes.uv;
  // Crop out the photograph's white border. Artwork remains upright.
  for(let i=0;i<uv.count;i++) uv.setXY(i,.5+pos.getX(i)*.489,.5+pos.getY(i)*.489);
  return geometry;
}
const plastic = new THREE.MeshPhysicalMaterial({color:0xf6f7ff,roughness:.075,metalness:0,transmission:1,thickness:thickness,ior:1.586,dispersion:.12,clearcoat:1,clearcoatRoughness:.035,envMapIntensity:1.25});
disc.add(new THREE.Mesh(annulus(hole,radius,thickness),plastic));
const hub = new THREE.Mesh(annulus(hole,hubRadius,.024),plastic.clone()); disc.add(hub);

// Radial thin-film variation creates angle-dependent spectral colors in physical reflections.
const size=512, data=new Uint8Array(size*size*4);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const r=Math.hypot(x-size/2,y-size/2)/(size/2), k=(y*size+x)*4;
 const value=Math.round(255*(.5+.5*Math.sin(r*18)));
 data[k]=255;data[k+1]=value;data[k+2]=0;data[k+3]=255;
}
const film = new THREE.DataTexture(data,size,size);film.needsUpdate=true;
let artworks;
try { artworks = await Promise.all(cds.map(cd => new THREE.TextureLoader().loadAsync(cd.artwork))); }
catch { status.textContent='The disc artwork could not load. Please reload.';throw new Error('Artwork unavailable'); }
for(const artwork of artworks){artwork.colorSpace=THREE.SRGBColorSpace;artwork.anisotropy=renderer.capabilities.getMaxAnisotropy();}
const artwork = artworks[0];
const frontMaterial = new THREE.MeshPhysicalMaterial({map:artwork,metalness:.62,roughness:.22,clearcoat:1,clearcoatRoughness:.07,iridescence:.85,iridescenceIOR:1.38,iridescenceThicknessRange:[160,720],iridescenceThicknessMap:film,envMapIntensity:.9});
// A radial grating approximation augments thin-film interference. RGB wavelength bands
// depend on light/view half-vector and the disc's local radial groove direction.
frontMaterial.onBeforeCompile = shader => {
 shader.vertexShader = shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vDiscPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvDiscPosition = position;');
 shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vDiscPosition;');
 shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
 vec2 radial = normalize(vDiscPosition.xy + vec2(0.0001));
 vec3 radialView = normalize(mat3(modelMatrix) * vec3(radial, 0.0));
 vec3 viewWorld = normalize(cameraPosition - (modelMatrix * vec4(vDiscPosition,1.0)).xyz);
 float grating = dot(radialView, normalize(viewWorld + normalize(vec3(-0.6,0.8,1.0))));
 vec3 rainbow = 0.5 + 0.5*cos(6.2831853*(grating*2.8 + vec3(0.0,0.33,0.67)));
 float incidence = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
 float fan = pow(abs(grating),3.0);
 outgoingLight += rainbow * (0.06 + incidence*0.20) * fan;
 #include <opaque_fragment>`);
 // modelMatrix is supplied to vertex shaders; provide it to this fragment shader too.
 shader.fragmentShader = 'uniform mat4 modelMatrix;\n' + shader.fragmentShader;
};
const front = new THREE.Mesh(faceGeometry(hubRadius,.992),frontMaterial);front.position.z=thickness/2+.0004;disc.add(front);
front.name = 'artwork';
// Reverse has no artwork: a clear polycarbonate surface with restrained optical rings.
const backMaterial = plastic.clone();backMaterial.iridescence=.45;backMaterial.iridescenceThicknessRange=[180,460];backMaterial.iridescenceThicknessMap=film;backMaterial.roughness=.12;
const back = new THREE.Mesh(faceGeometry(hubRadius,.992),backMaterial);back.rotation.y=Math.PI;back.position.z=-thickness/2-.0004;disc.add(back);
const rimMaterial = new THREE.MeshPhysicalMaterial({color:0xdde1e7,metalness:.8,roughness:.16,iridescence:.7,iridescenceThicknessRange:[180,480]});
for(const r of [radius-.005,hubRadius,hole+.004]) {
 const ring = new THREE.Mesh(new THREE.TorusGeometry(r,.0028,8,256),rimMaterial);disc.add(ring);
}
const grooveMaterial = new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.12,roughness:.16,metalness:.3,depthWrite:false});
for(const r of [.141,.17,.267,.282,.91,.965]){
 const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.0012,6,256),grooveMaterial);ring.position.z=-thickness/2-.001;disc.add(ring);
}
const secondDisc = disc.clone(true);
const secondFront = secondDisc.getObjectByName('artwork');
secondFront.material = frontMaterial.clone();
secondFront.material.map = artworks[1];
secondFront.material.onBeforeCompile = frontMaterial.onBeforeCompile;
scene.add(secondDisc);
const discs = [disc, secondDisc];
const targets = discs.map(() => ({position:new THREE.Vector3(),scale:1}));
let selected = -1;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const player = createPlaylistPanel();
const choices = [...document.querySelectorAll('.disc-choice')];
function arrange(){
  const mobile = camera.aspect < 1.15;
  discs.forEach((item,index) => {
    const target=targets[index];
    if(selected<0){target.position.set((index===0?-1:1)*(mobile?.8:1.38),0,0);target.scale=mobile?.67:1.15;}
    else if(index===selected){target.position.set(0,.08,0);target.scale=1;}
    else{target.position.set(index===0?-2.4:2.4,0,-1.2);target.scale=0;}
    if(reducedMotion){item.position.copy(target.position);item.scale.setScalar(target.scale);}
  });
}
function selectDisc(index){
  selected=index;disc=discs[index];
  disc.rotation.set(.06,-.12,-.04);flipRemaining=0;lastInteraction=performance.now();
  document.body.classList.add('focused');
  document.querySelector('.view-tools').hidden=false;
  choices.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  canvas.setAttribute('aria-label',`${cds[index].title}. Drag to rotate. Arrow keys rotate; space pauses rotation.`);
  player.show(index);resize();
}
choices.forEach((button,index)=>button.addEventListener('click',()=>selectDisc(index)));
document.querySelector('#close-player').onclick=()=>{
  selected=-1;player.hide();document.body.classList.remove('focused');
  document.querySelector('.view-tools').hidden=true;
  choices.forEach(button=>button.setAttribute('aria-pressed','false'));
  discs.forEach((item,index)=>item.rotation.set(.06,index===0?-.16:.16,index===0?-.08:.08));
  canvas.setAttribute('aria-label','CD collection. Select a disc below, or press Enter to focus the first disc.');
  resize();choices[0].focus();
};
discs.forEach((item,index)=>item.rotation.set(.06,index===0?-.16:.16,index===0?-.08:.08));
status.hidden=true;

let paused=reducedMotion;
let dragging=false,lastX=0,lastY=0,lastInteraction=0,downX=0,downY=0;
const motion=document.querySelector('#motion');
function syncMotion(){motion.textContent=paused?'▷':'Ⅱ';motion.setAttribute('aria-label',paused?'Resume automatic rotation':'Pause automatic rotation');motion.setAttribute('aria-pressed',String(paused));}
syncMotion();motion.onclick=()=>{paused=!paused;syncMotion();};
canvas.addEventListener('pointerdown',e=>{dragging=true;downX=lastX=e.clientX;downY=lastY=e.clientY;canvas.setPointerCapture(e.pointerId);lastInteraction=performance.now();});
const rotation=new THREE.Quaternion(),axis=new THREE.Vector3();
function rotate(dx,dy){axis.set(dy,dx,0);if(axis.lengthSq()){rotation.setFromAxisAngle(axis.normalize(),Math.hypot(dx,dy));disc.quaternion.premultiply(rotation);}lastInteraction=performance.now();}
canvas.addEventListener('pointermove',e=>{if(!dragging||selected<0)return;rotate((e.clientX-lastX)*.006,(e.clientY-lastY)*.006);lastX=e.clientX;lastY=e.clientY;});
const raycaster=new THREE.Raycaster();
canvas.addEventListener('pointerup',e=>{
  if(selected>=0||Math.hypot(e.clientX-downX,e.clientY-downY)>6)return;
  const rect=canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
  const hits=raycaster.intersectObjects(discs,true);
  if(hits.length){let item=hits[0].object;while(item.parent!==scene)item=item.parent;selectDisc(discs.indexOf(item));}
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{dragging=false;lastInteraction=performance.now();});
let flipRemaining=0;
document.querySelector('#flip').onclick=()=>{flipRemaining=Math.PI;lastInteraction=performance.now();};
document.querySelector('#reset').onclick=()=>{disc.rotation.set(.06,-.12,-.04);resize();controls.target.set(0,0,0);flipRemaining=0;lastInteraction=performance.now();};
canvas.addEventListener('keydown',e=>{
 const keys={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]};
 if(selected<0){if(e.code==='Enter'){e.preventDefault();selectDisc(0);}return;}
 if(keys[e.code]){e.preventDefault();rotate(...keys[e.code]);}if(e.code==='Space'){e.preventDefault();motion.click();}
});
function resize(){const viewer=document.querySelector('#viewer');const w=viewer.clientWidth,h=viewer.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.position.set(0,0,selected<0?(camera.aspect<1.15?5.4:4.6):Math.max(4.3,3.8/camera.aspect));camera.updateProjectionMatrix();controls.enableZoom=selected>=0;arrange();}
new ResizeObserver(resize).observe(document.querySelector('#viewer'));resize();
discs.forEach((item,i)=>{item.position.copy(targets[i].position);item.scale.setScalar(targets[i].scale);});
const scaleVector = new THREE.Vector3();
let previous=performance.now();
renderer.setAnimationLoop(now=>{
 const dt=Math.min((now-previous)/1000,.05);previous=now;
 if(document.hidden)return;
 discs.forEach((item,i)=>{item.position.lerp(targets[i].position,1-Math.exp(-dt*7));item.scale.lerp(scaleVector.setScalar(targets[i].scale),1-Math.exp(-dt*7));item.visible=item.scale.x>.005;});
 if(selected>=0&&flipRemaining>0){const step=Math.min(flipRemaining,dt*2.5);disc.rotateY(step);flipRemaining-=step;}
 else if(!paused&&!dragging&&now-lastInteraction>1400){if(selected>=0){disc.rotateY(dt*.12);disc.rotateX(Math.sin(now*.00045)*dt*.045);}else discs.forEach((item,i)=>{item.rotation.y=Math.sin(now*.0003+i)*.2;item.rotation.x=Math.sin(now*.00024+i)*.08;});}
 controls.update();renderer.render(scene,camera);
});


