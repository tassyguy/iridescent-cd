import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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

const disc = new THREE.Group(); scene.add(disc);
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
let artwork;
try { artwork = await new THREE.TextureLoader().loadAsync('./disc.jpg'); }
catch { status.textContent='The disc artwork could not load. Please reload.';throw new Error('Artwork unavailable'); }
artwork.colorSpace=THREE.SRGBColorSpace;
artwork.anisotropy=renderer.capabilities.getMaxAnisotropy();
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
disc.rotation.set(.06,-.12,-.04);
status.hidden=true;

let paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
let dragging=false,lastX=0,lastY=0,lastInteraction=0;
const motion=document.querySelector('#motion');
function syncMotion(){motion.textContent=paused?'▷':'Ⅱ';motion.setAttribute('aria-label',paused?'Resume automatic rotation':'Pause automatic rotation');motion.setAttribute('aria-pressed',String(paused));}
syncMotion();motion.onclick=()=>{paused=!paused;syncMotion();};
canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);lastInteraction=performance.now();});
const rotation=new THREE.Quaternion(),axis=new THREE.Vector3();
function rotate(dx,dy){axis.set(dy,dx,0);if(axis.lengthSq()){rotation.setFromAxisAngle(axis.normalize(),Math.hypot(dx,dy));disc.quaternion.premultiply(rotation);}lastInteraction=performance.now();}
canvas.addEventListener('pointermove',e=>{if(!dragging)return;rotate((e.clientX-lastX)*.006,(e.clientY-lastY)*.006);lastX=e.clientX;lastY=e.clientY;});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>{dragging=false;lastInteraction=performance.now();});
let flipRemaining=0;
document.querySelector('#flip').onclick=()=>{flipRemaining=Math.PI;lastInteraction=performance.now();};
document.querySelector('#reset').onclick=()=>{disc.rotation.set(.06,-.12,-.04);camera.position.set(0,0,camera.aspect<1?6.2:4.6);controls.target.set(0,0,0);flipRemaining=0;lastInteraction=performance.now();};
canvas.addEventListener('keydown',e=>{
 const keys={ArrowLeft:[-.12,0],ArrowRight:[.12,0],ArrowUp:[0,-.12],ArrowDown:[0,.12]};
 if(keys[e.code]){e.preventDefault();rotate(...keys[e.code]);}if(e.code==='Space'){e.preventDefault();motion.click();}
});
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.position.set(0,0,camera.aspect<1?6.2:4.6);camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
let previous=performance.now();
renderer.setAnimationLoop(now=>{
 const dt=Math.min((now-previous)/1000,.05);previous=now;
 if(document.hidden)return;
 if(flipRemaining>0){const step=Math.min(flipRemaining,dt*2.5);disc.rotateY(step);flipRemaining-=step;}
 else if(!paused&&!dragging&&now-lastInteraction>1400){disc.rotateY(dt*.12);disc.rotateX(Math.sin(now*.00045)*dt*.045);}
 controls.update();renderer.render(scene,camera);
});

