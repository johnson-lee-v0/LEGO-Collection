import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, DoubleSide, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { chooseAssemblyView, frameAssemblyBounds, interpolateAssemblyFrame } from '../src/assembly-camera.js';
import { AssemblyScene } from '../src/assembly-scene.js';

const corners = bounds => {
  const result = [];
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) result.push(new Vector3(x, y, z));
    }
  }
  return result;
};

function assertFiniteFrame(frame) {
  const values = [
    ...frame.target.toArray(), ...frame.position.toArray(), ...frame.up.toArray(),
    frame.distance, frame.minDistance, frame.maxDistance,
  ];
  assert.ok(values.every(Number.isFinite), 'The camera frame must contain only finite values');
  assert.ok(frame.distance > 0);
  assert.ok(frame.minDistance > 0 && frame.maxDistance > frame.distance);
  assert.ok(frame.position.distanceTo(frame.target) > 0);
}

function assertFits(frame, bounds, aspect) {
  assertFiniteFrame(frame);
  const camera = new PerspectiveCamera(34, aspect, .001, frame.distance * 10 + 10000);
  camera.position.copy(frame.position);
  camera.up.copy(frame.up);
  camera.lookAt(frame.target);
  camera.updateMatrixWorld(true);
  for (const corner of corners(bounds)) {
    const projected = corner.clone().project(camera);
    assert.ok(Math.abs(projected.x) <= .780001,
      `Horizontal target margin exceeded at aspect ${aspect}: ${projected.x}`);
    assert.ok(Math.abs(projected.y) <= .640001,
      `Vertical target margin exceeded at aspect ${aspect}: ${projected.y}`);
    assert.ok(projected.z > -1 && projected.z < 1, 'Every corner must remain in front of the camera');
  }
}

test('Target corners retain control margins on narrow and wide canvases', () => {
  const bounds = new Box3(new Vector3(-190, -270, -350), new Vector3(130, 230, 340));
  const direction = new Vector3(1.25, .65, 1.3);
  for (const aspect of [.05, .125, .2, .5, 1, 1.8, 4, 8]) {
    assertFits(frameAssemblyBounds(bounds, direction, aspect), bounds, aspect);
  }
});

test('Focus preserves nearby studs around a tiny target without framing distant geometry', () => {
  const target = new Vector3(240, -70, 110);
  const tiny = new Box3().setFromCenterAndSize(target, new Vector3(20, 8, 20));
  const context = new Box3().setFromCenterAndSize(target, new Vector3(130, 100, 130));
  const direction = new Vector3(-1, .5, 1);
  const focused = frameAssemblyBounds(tiny, direction, .65, { focus: true });
  assertFits(focused, context, .65);
  assert.ok(focused.target.distanceTo(target) < .000001);
  const wholeBuild = tiny.clone().expandByPoint(new Vector3(-500, 600, -900));
  const whole = frameAssemblyBounds(wholeBuild, direction, .65);
  assert.ok(focused.distance < whole.distance / 2,
    'Focusing a stand piece should not use the distant completed shoe to determine zoom');
});

test('Thin plates and direct top or bottom views produce a valid camera basis', () => {
  const plate = new Box3(new Vector3(-80, 12, -160), new Vector3(80, 12, 160));
  for (const direction of [new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, .9999, .0001)]) {
    const frame = frameAssemblyBounds(plate, direction, .7, { focus: true });
    assertFits(frame, plate, .7);
    const outward = frame.position.clone().sub(frame.target).normalize();
    assert.ok(new Vector3().crossVectors(outward, frame.up).length() > .99,
      'The look direction and up vector must not become parallel');
  }
});

test('Join framing contains both the staged assembly and its docking position', () => {
  const staged = new Box3(new Vector3(-320, 60, -120), new Vector3(-220, 240, 130));
  const docked = staged.clone().translate(new Vector3(230, -100, -40));
  const frame = frameAssemblyBounds(staged.clone().union(docked), new Vector3(-1.2, .7, 1), .6, { focus: true });
  assertFits(frame, staged, .6);
  assertFits(frame, docked, .6);
});

test('Empty bounds, zero directions and unavailable aspect have finite fallbacks', () => {
  for (const bounds of [new Box3(), null, undefined]) {
    for (const aspect of [undefined, NaN, Infinity, 0, -1]) {
      assertFiniteFrame(frameAssemblyBounds(bounds, new Vector3(), aspect, { focus: true }));
    }
  }
  const point = new Box3(new Vector3(30, 50, 70), new Vector3(30, 50, 70));
  assertFits(frameAssemblyBounds(point, new Vector3(1, 0, 0), 1), point, 1);
});

test('Computing focus does not mutate source bounds or the chosen direction', () => {
  const bounds = new Box3(new Vector3(-10, -20, -30), new Vector3(10, 20, 30));
  const direction = new Vector3(1.25, .65, 1.3);
  const beforeBounds = bounds.clone(), beforeDirection = direction.clone();
  frameAssemblyBounds(bounds, direction, 1.4, { focus: true });
  assert.ok(bounds.equals(beforeBounds));
  assert.ok(direction.equals(beforeDirection));
});

function blocker(size, position) {
  const mesh = new Mesh(new BoxGeometry(...size), new MeshBasicMaterial({ side: DoubleSide }));
  mesh.position.set(...position);
  mesh.updateMatrixWorld(true);
  return { bounds: new Box3().setFromObject(mesh), meshes: [mesh] };
}

test('A piece behind a placed wall makes the build camera rotate to a clear angle', () => {
  const target = new Box3(new Vector3(-10, -10, -10), new Vector3(10, 10, 10));
  // Exercise all sides of a car or shoe, including an underside placement.
  for (const side of [new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 0, -1), new Vector3(-1, 0, 0), new Vector3(0, 1, 0)]) {
    const size = side.x ? [10, 300, 300] : side.y ? [300, 10, 300] : [300, 300, 10];
    const wall = blocker(size, side.clone().multiplyScalar(50).toArray());
    const choice = chooseAssemblyView(target, side, 1.4, { targets: [target], occluders: [wall] });
    assert.equal(choice.rotated, true, `Camera must leave the occluded ${side.toArray()} angle`);
    assert.ok(choice.visibility > .9, 'New angle exposes the target');
    assert.ok(choice.direction.dot(side) < .99, 'Camera direction actually changes');
    assertFits(frameAssemblyBounds(target, choice.direction, 1.4, { focus: true }), target, 1.4);
  }
});

test('Already visible pieces keep their angle and holes in CAD remain visible', () => {
  const target = new Box3(new Vector3(-6, -6, -6), new Vector3(6, 6, 6));
  const left = blocker([25, 300, 20], [-60, 0, 50]);
  const right = blocker([25, 300, 20], [60, 0, 50]);
  const openFrame = { bounds: left.bounds.clone().union(right.bounds), meshes: [...left.meshes, ...right.meshes] };
  const direction = new Vector3(0, 0, 1);
  const choice = chooseAssemblyView(target, direction, 1, { targets: [target], occluders: [openFrame] });
  assert.equal(choice.rotated, false, 'Do not turn when rays pass through the real gap');
  assert.equal(choice.visibility, 1);
  assert.ok(choice.direction.equals(direction));
});

test('A join chooses an angle for both its staging and docking positions', () => {
  const staged = new Box3(new Vector3(-260, -20, -20), new Vector3(-220, 20, 20));
  const docked = staged.clone().translate(new Vector3(240, 0, 0));
  const bounds = staged.clone().union(docked);
  const wall = blocker([400, 300, 20], [-100, 0, 70]);
  const choice = chooseAssemblyView(bounds, new Vector3(0, .15, 1), .7, { targets: [staged, docked], occluders: [wall] });
  assert.equal(choice.rotated, true);
  assert.ok(choice.visibility > .9);
  const frame = frameAssemblyBounds(bounds, choice.direction, .7, { focus: true });
  assertFits(frame, staged, .7);
  assertFits(frame, docked, .7);
});

test('Visibility checks do not mutate target geometry or the requested direction', () => {
  const target = new Box3(new Vector3(-10, -10, -10), new Vector3(10, 10, 10));
  const original = target.clone(), direction = new Vector3(0, 0, 1);
  chooseAssemblyView(target, direction, 1, { targets: [target], occluders: [blocker([300, 300, 10], [0, 0, 40])] });
  assert.ok(target.equals(original));
  assert.deepEqual(direction.toArray(), [0, 0, 1]);
});

test('A half-turn orbits outside the target instead of travelling through it', () => {
  const fromTarget = new Vector3(), toTarget = new Vector3(30, 10, 0);
  const fromPosition = new Vector3(0, 0, 500), toPosition = toTarget.clone().add(new Vector3(0, 0, -700));
  for (const t of [0, .1, .5, .9, 1]) {
    const frame = interpolateAssemblyFrame(fromPosition, fromTarget, toPosition, toTarget, t);
    assert.ok(Math.abs(frame.position.distanceTo(frame.target) - (500 + 200 * t)) < .000001);
  }
  assert.ok(interpolateAssemblyFrame(fromPosition, fromTarget, toPosition, toTarget, 0).position.distanceTo(fromPosition) < .000001);
  assert.ok(interpolateAssemblyFrame(fromPosition, fromTarget, toPosition, toTarget, 1).position.distanceTo(toPosition) < .000001);
});

test('Manual orbit persists until a different step or an explicit Focus next action', () => {
  const scene = Object.create(AssemblyScene.prototype);
  Object.assign(scene, { progress: 0, preview: false, steps: [{}, {}, {}], partState: new Map(), manualCamera: true, animations: [], applyProgress() {} });
  const frames = [];
  scene.fit = options => frames.push(options);
  scene.setProgress(0);
  assert.equal(frames.length, 0, 'Refreshing the same step preserves manual orbit');
  scene.setProgress(1, { animate: true });
  assert.deepEqual(frames.pop(), { animate: true, autoRotate: true });
  assert.equal(scene.manualCamera, false);
  scene.manualCamera = true;
  scene.focusNext();
  assert.deepEqual(frames.pop(), { animate: true, autoRotate: true });
  assert.equal(scene.manualCamera, false);
});

test('Reduced motion places parts immediately while still selecting the next viewpoint', () => {
  const scene = Object.create(AssemblyScene.prototype);
  Object.assign(scene, {
    progress: 0, preview: false, reducedMotion: true, manualCamera: true,
    steps: [{ partIds: ['part'] }, {}],
    partState: new Map([['part', { node: { position: new Vector3(), visible: true } }]]),
    applyProgress() {}, animations: [], fit() {},
  });
  scene.setProgress(1, { animate: true });
  assert.equal(scene.animations.length, 0);
  assert.equal(scene.manualCamera, false);
});

test('Reduced motion applies a clearer camera viewpoint without an animation', () => {
  const scene = Object.create(AssemblyScene.prototype);
  const target = new Box3(new Vector3(-10, -10, -10), new Vector3(10, 10, 10));
  Object.assign(scene, {
    size: new Vector3(20, 20, 20), preview: false, focusMode: 'step', reducedMotion: true,
    direction: new Vector3(0, 0, 1), camera: new PerspectiveCamera(34, 1, 1, 10000),
    controls: { target: new Vector3(), update() {} }, container: { dataset: {} },
    getStepTargets: () => [target],
    getCameraOccluders: () => [blocker([300, 300, 10], [0, 0, 50])],
  });
  scene.fit({ animate: true, autoRotate: true });
  assert.equal(scene.cameraMove, null);
  assert.equal(scene.container.dataset.cameraRotated, 'true');
  assert.ok(Number(scene.container.dataset.targetVisibility) > .9);
  assert.ok(scene.camera.position.distanceTo(scene.controls.target) > 100);
});

test('Resizing updates the viewport without replacing a manually chosen camera', () => {
  const scene = Object.create(AssemblyScene.prototype);
  let frames = 0;
  Object.assign(scene, {
    manualCamera: true, camera: new PerspectiveCamera(34, 1, 1, 10000),
    renderer: { setSize() {} },
    container: { getBoundingClientRect: () => ({ width: 640, height: 500 }) },
    fit() { frames++; },
  });
  scene.resize();
  assert.equal(scene.camera.aspect, 1.28);
  assert.equal(frames, 0);
  scene.manualCamera = false;
  scene.resize();
  assert.equal(frames, 1);
});
