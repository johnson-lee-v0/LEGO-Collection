import { appUrl } from './app-path.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';
import { LDrawConditionalLineMaterial } from 'three/addons/materials/LDrawConditionalLineMaterial.js';
import { bindAssemblyInstances, validateAssemblyStepMap } from './assembly-assembly.js';
import { chooseAssemblyView, frameAssemblyBounds, interpolateAssemblyFrame } from './assembly-camera.js';

const officialStepTitle = step => `Step ${step.number}`;

/** CAD scene renderer; the public app uses complete-model preview mode. */
export class AssemblyScene {
  constructor(container,{model=null,steps=model?.steps||[],onPlace=()=>{},onReady=()=>{},onError=()=>{}}={}) {
    this.container=container; this.disposed=false; this.ready=false;
    if (!model?.setNumber) throw new Error('A collection model is required.');
    this.model=model;this.assetRoot=model.sceneConfig?.assetRoot||`/official/${model.setNumber}`;
    this.steps=steps;this.progress=0;this.preview=true;this.onPlace=onPlace;this.animations=[];this.ghostMaterials=new Set();
    this.focusMode='step';this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(34,1,1,10000);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1;
    this.renderer.setClearColor(0xeceae3,0);
    
    this.renderer.domElement.setAttribute('role','img');
    this.renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:none';
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.tabIndex=0;
    this.targetButton=document.createElement('button');
    this.targetButton.className='official-place-target';this.targetButton.hidden=true;
    this.targetButton.addEventListener('click',()=>{if(!this.preview&&this.ready)this.onPlace();});
    container.appendChild(this.targetButton);
    this.targetRing=document.createElement('span');this.targetRing.className='official-target-ring';this.targetRing.hidden=true;this.targetRing.setAttribute('aria-hidden','true');container.appendChild(this.targetRing);
    this.renderer.domElement.setAttribute('aria-label',`Interactive ${model?.shortTitle||'community'} model. Drag to rotate and scroll to zoom.`);
    this.pointerDown=e=>{this.down={x:e.clientX,y:e.clientY};};
    this.pointerUp=e=>{if(!this.ready||this.preview||!this.down||Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>5)return;const r=this.renderer.domElement.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);if(ray.intersectObjects(this.nextNodes||[],true).length)this.onPlace();};
    this.renderer.domElement.addEventListener('pointerdown',this.pointerDown);this.renderer.domElement.addEventListener('pointerup',this.pointerUp);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.addEventListener('start',()=>{this.manualCamera=true;this.cameraMove=null;});
    this.controls.addEventListener('end',()=>{this.direction=this.camera.position.clone().sub(this.controls.target).normalize();});
    this.controls.enableDamping=true;this.controls.enablePan=false;this.controls.minDistance=300;this.controls.maxDistance=2400;
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x8a8780,1.9));
    const light=new THREE.DirectionalLight(0xffffff,2.5);light.position.set(300,650,450);this.scene.add(light);
    const fill=new THREE.DirectionalLight(0xddeaff,.9);fill.position.set(-500,200,-300);this.scene.add(fill);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.resize();this.camera.position.set(600,350,650);
    this.animate=()=>{if(this.disposed)return;const now=performance.now();for(const item of this.animations){const t=Math.min(1,(now-item.start)/450),ease=1-Math.pow(1-t,3);item.node.position.lerpVectors(item.from,item.to,ease);}this.animations=this.animations.filter(item=>now-item.start<450);if(this.cameraMove){const m=this.cameraMove,t=Math.min(1,(now-m.start)/420),ease=t*t*(3-2*t);const frame=interpolateAssemblyFrame(m.fromPosition,m.fromTarget,m.position,m.target,ease);this.camera.position.copy(frame.position);this.controls.target.copy(frame.target);if(t===1)this.cameraMove=null;}if(this.container.offsetWidth>0){this.controls.update();this.updateTarget();this.renderer.render(this.scene,this.camera);}this.frame=requestAnimationFrame(this.animate);};this.animate();
    this.load().then(()=>{if(!this.disposed)onReady(this);}).catch(error=>{if(!this.disposed){console.error(error);onError(error);}});
  }
  async load() {
    const manager=new THREE.LoadingManager(); const failures=[];manager.onError=url=>failures.push(url);
    const loader=new LDrawLoader(manager).setPartsLibraryPath(appUrl(`${this.assetRoot}/ldraw/`));
    loader.setConditionalLineMaterial(LDrawConditionalLineMaterial);
    await loader.preloadMaterials(appUrl(this.model?.sceneConfig?.materialUrl||`${this.assetRoot}/ldraw/LDConfig.ldr`));
    const [object,instances]=await Promise.all([loader.loadAsync(appUrl(this.model?.modelUrl||`${this.assetRoot}/model.mpd?v=2`)),fetch(appUrl(this.model?.sceneConfig?.instancesUrl||`${this.assetRoot}/instances.json`)).then(r=>{if(!r.ok)throw new Error('The assembly data could not load.');return r.json();})]);
    if(this.disposed){this.disposeObject(object);return;}
    if(failures.length){this.disposeObject(object);throw new Error('Some CAD parts could not load. The official instructions remain available.');}
    this.parts=bindAssemblyInstances(object,instances);
    if(this.steps.length)validateAssemblyStepMap(this.steps,instances);
    const corrections=new Map(this.steps.flatMap(s=>s.colorOverrides||[]).map(c=>[c.id,c]));
    this.stagedAssemblies=this.steps.map((step,index)=>({step,index})).filter(({step})=>step.action?.kind==='attach-subassembly').map(({step,index},i)=>({index,ids:new Set(step.action.instanceIds),offset:new THREE.Vector3(...(step.action.stagingOffset||[220,-150,100]))}));
    this.partState=new Map();
    for(const [id,node] of this.parts){const meshes=[];node.traverse(child=>{if(child.material){if(child.isLineSegments){const softened=(Array.isArray(child.material)?child.material:[child.material]).map(m=>{const c=m.clone();c.transparent=true;c.opacity=this.model?.sceneConfig?.lineOpacity??.32;c.depthWrite=false;return c;});child.material=Array.isArray(child.material)?softened:softened[0];}if(child.isMesh&&corrections.has(id)){const corrected=(Array.isArray(child.material)?child.material:[child.material]).map(m=>{const c=m.clone();c.color.set(corrections.get(id).color);return c;});child.material=Array.isArray(child.material)?corrected:corrected[0];}const original=child.material;const ghost=(Array.isArray(original)?original:[original]).map(material=>{const m=material.clone();m.color?.set(0xf6b431);if(m.emissive)m.emissive.set(0x9c5800);m.transparent=true;m.opacity=child.isMesh?.72:.85;m.depthWrite=false;m.depthTest=false;this.ghostMaterials.add(m);return m;});meshes.push({node:child,original,ghost:Array.isArray(original)?ghost:ghost[0]});}});this.partState.set(id,{node,position:node.position.clone(),toParent:new THREE.Matrix3().setFromMatrix4(node.parent.matrixWorld.clone().invert()),meshes});}
    if(this.disposed){this.disposeObject(object);return;}
    object.rotation.set(...(this.model?.sceneConfig?.rotation||[Math.PI,0,0]));
    object.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(object),center=bounds.getCenter(new THREE.Vector3());
    object.position.sub(center);this.object=object;this.scene.add(object);
    this.size=bounds.getSize(new THREE.Vector3());this.ready=true;this.setView('angle');this.applyProgress();
  }
  setView(view='angle') {
    const custom=this.model?.sceneConfig?.views?.[view];
    const direction=custom?new THREE.Vector3(...custom):({angle:new THREE.Vector3(1.25,.65,1.3),side:new THREE.Vector3(1,.15,0),front:new THREE.Vector3(0,.2,1),top:new THREE.Vector3(.01,1,0)})[view] || new THREE.Vector3(1.25,.65,1.3);
    this.view=view;this.direction=direction.normalize();this.manualCamera=false;this.fit();
  }
  getVisibleBounds() {
    const bounds=new THREE.Box3();this.object?.updateMatrixWorld(true);
    for(const {node} of this.partState?.values()||[])if(node.visible)bounds.union(new THREE.Box3().setFromObject(node));
    return bounds;
  }
  getStepTargets({includeDocking=true}={}) {
    const targets=[];this.object?.updateMatrixWorld(true);
    for(const node of this.nextNodes||[])targets.push(new THREE.Box3().setFromObject(node));
    if(includeDocking){
      const joining=this.stagedAssemblies?.find(assembly=>assembly.index===this.progress);
      if(joining)for(const id of joining.ids){
        const state=this.partState.get(id);if(!state)continue;
        const displacement=joining.offset.clone().negate().applyMatrix3(state.toParent).applyMatrix3(new THREE.Matrix3().setFromMatrix4(state.node.parent.matrixWorld));
        targets.push(new THREE.Box3().setFromObject(state.node).translate(displacement));
      }
    }
    return targets;
  }
  getStepBounds(options) {
    const bounds=new THREE.Box3();
    for(const target of this.getStepTargets(options))bounds.union(target);
    return bounds;
  }
  getCameraOccluders() {
    const targets=new Set(this.nextNodes||[]),occluders=[];
    for(const state of this.partState?.values()||[]){
      if(!state.node.visible||targets.has(state.node))continue;
      const meshes=state.meshes.map(item=>item.node).filter(node=>node.isMesh&&node.visible);
      if(meshes.length)occluders.push({bounds:new THREE.Box3().setFromObject(state.node),meshes});
    }
    return occluders;
  }
  fit({animate=false,autoRotate=false}={}) {
    if(!this.size)return;
    const selectionStart=performance.now();
    const focused=!this.preview&&this.focusMode==='step';
    const targets=focused?this.getStepTargets():[];
    let bounds=focused?targets.reduce((box,target)=>box.union(target),new THREE.Box3()):this.getVisibleBounds();
    if(bounds.isEmpty())bounds=this.getVisibleBounds();
    let fitDirection=this.direction.clone();
    if(focused&&autoRotate){
      const choice=chooseAssemblyView(bounds,fitDirection,this.camera.aspect,{targets,occluders:this.getCameraOccluders()});
      fitDirection=choice.direction;
      this.direction.copy(fitDirection);
      this.container.dataset.cameraRotated=String(choice.rotated);
      this.container.dataset.targetVisibility=choice.visibility.toFixed(3);
    }
    if(Math.abs(fitDirection.y)>.995)fitDirection.z=.12;fitDirection.normalize();
    this.container.dataset.cameraDirection=fitDirection.toArray().map(value=>value.toFixed(3)).join(',');
    if(focused&&autoRotate)this.container.dataset.cameraSelectionMs=(performance.now()-selectionStart).toFixed(1);
    const frame=frameAssemblyBounds(bounds,fitDirection,this.camera.aspect,{focus:focused});
    this.controls.minDistance=frame.minDistance;this.controls.maxDistance=frame.maxDistance;this.camera.up.copy(frame.up);this.camera.far=Math.max(10000,frame.distance*3);this.camera.updateProjectionMatrix();
    if(animate&&!this.reducedMotion)this.cameraMove={...frame,fromPosition:this.camera.position.clone(),fromTarget:this.controls.target.clone(),start:performance.now()};
    else {this.cameraMove=null;this.camera.position.copy(frame.position);this.controls.target.copy(frame.target);this.controls.update();}
    this.container.dataset.cameraFocus=focused?'next-step':'whole-build';
  }
  performAction(step){const view=step?.action?.view;if(view)this.setView(view);}
  focusNext(){this.focusMode='step';this.manualCamera=false;this.fit({animate:true,autoRotate:true});}
  showWhole(){this.focusMode='all';this.manualCamera=false;this.fit({animate:true});}
  zoomBy(factor){this.cameraMove=null;this.manualCamera=true;const offset=this.camera.position.clone().sub(this.controls.target);const distance=THREE.MathUtils.clamp(offset.length()*factor,this.controls.minDistance,this.controls.maxDistance);this.camera.position.copy(this.controls.target).add(offset.setLength(distance));this.controls.update();}
  updateTarget(){
    if(this.preview||!this.ready||!this.nextNodes?.length){this.targetButton.hidden=true;this.targetRing.hidden=true;return;}
    const point=this.targetPoint?.clone().project(this.camera),width=this.container.clientWidth,height=this.container.clientHeight;
    if(!point||![point.x,point.y,point.z].every(Number.isFinite)||!width||!height)return;
    const x=(point.x+1)*width/2,y=(1-point.y)*height/2,inView=point.z>=-1&&point.z<=1&&x>=10&&x<=width-10&&y>=55&&y<=height-96;
    this.targetButton.hidden=false;this.targetRing.hidden=!inView;
    this.targetButton.style.left=`${THREE.MathUtils.clamp(inView?x:width/2,82,width-82)}px`;
    this.targetButton.style.top=`${THREE.MathUtils.clamp(inView?y-62:90,68,height-126)}px`;
    this.targetRing.style.left=`${x}px`;this.targetRing.style.top=`${y}px`;
    this.targetButton.dataset.offscreen=String(!inView);
  }
  setPreview(value){this.preview=value;this.applyProgress();this.fit({autoRotate:!value});}
  setProgress(value,{animate=false}={}){const old=this.progress,before=new Map([...this.partState||[]].map(([id,s])=>[id,s.node.position.clone()]));this.progress=Math.max(0,Math.min(this.steps.length,value));this.applyProgress();this.animations=[];if(animate&&!this.reducedMotion&&!this.preview&&value>old&&this.partState){const added=new Set(this.steps.slice(old,value).flatMap(s=>s.partIds||[]));for(const [id,state] of this.partState){const to=state.node.position.clone(),from=before.get(id)||to.clone();if(added.has(id))from.copy(to).add(new THREE.Vector3(0,-50,0));if(state.node.visible&&from.distanceTo(to)>.01)this.animations.push({node:state.node,from,to,start:performance.now()});}}if(value!==old&&!this.preview){this.focusMode='step';this.manualCamera=false;this.fit({animate,autoRotate:true});}else if(!this.manualCamera)this.fit();}
  applyProgress(){if(!this.parts||!this.steps.length)return;const placed=new Set(this.steps.slice(0,this.progress).flatMap(s=>s.partIds||[]));const upcoming=this.steps[this.progress];const next=new Set(upcoming?.partIds||[]);for(const id of upcoming?.action?.instanceIds||[])next.add(id);this.nextNodes=[];for(const [id,state] of this.partState){const solid=this.preview||placed.has(id),ghost=!this.preview&&next.has(id);state.node.visible=solid||ghost;state.node.position.copy(state.position);if(!this.preview){const offset=new THREE.Vector3();for(const assembly of this.stagedAssemblies)if(this.progress<=assembly.index&&assembly.ids.has(id))offset.add(assembly.offset);state.node.position.add(offset.applyMatrix3(state.toParent));}for(const item of state.meshes)item.node.material=ghost?item.ghost:item.original;if(ghost)this.nextNodes.push(state.node);}this.targetPoint=this.getStepBounds({includeDocking:false}).getCenter(new THREE.Vector3());const label=({'attach-subassembly':'Join','rotate-assembly':'Rotate','seat-assembly':'Seat','inspect-assembly':'Check','position-assembly':'Position','adjust-assembly':'Adjust'})[upcoming?.action?.kind]||'Place';this.targetButton.textContent=`${label} ${upcoming?officialStepTitle(upcoming).toLowerCase():''} +`;this.targetButton.setAttribute('aria-label',`${label} ${upcoming?.sectionLabel||upcoming?.section||'build'} ${upcoming?officialStepTitle(upcoming).toLowerCase():''} in 3D`);this.renderer.domElement.style.cursor=this.preview?'grab':'pointer';this.container.dataset.placedParts=String(placed.size);this.container.dataset.nextParts=String((upcoming?.partIds||[]).length);this.container.dataset.buildStep=String(this.progress);this.container.dataset.preview=String(this.preview);}
  resize(){const rect=this.container.getBoundingClientRect();if(!rect.width||!rect.height)return;this.renderer.setSize(rect.width,rect.height,false);this.camera.aspect=rect.width/rect.height;this.camera.updateProjectionMatrix();if(!this.manualCamera)this.fit();}
  capture(){if(!this.ready)throw new Error('The 3D preview is still loading.');this.renderer.render(this.scene,this.camera);return this.renderer.domElement.toDataURL('image/png');}
  disposeObject(object){const geometries=new Set(),materials=new Set();object.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const m of Array.isArray(node.material)?node.material:node.material?[node.material]:[])materials.add(m);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.controls.dispose();for(const state of this.partState?.values()||[])for(const m of state.meshes)m.node.material=m.original;if(this.object)this.disposeObject(this.object);for(const m of this.ghostMaterials)m.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.targetButton.remove();this.targetRing.remove();}
}
