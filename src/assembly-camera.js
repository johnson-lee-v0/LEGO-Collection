import { Box3, Quaternion, Raycaster, Vector3 } from 'three';

const DEFAULT_DIRECTION = new Vector3(1.25, .65, 1.3).normalize();

/** Keep a few spatially separated pieces when a step contains a large assembly. */
function representativeTargets(targets, limit = 9) {
  const valid = targets.filter(bounds => bounds && !bounds.isEmpty());
  if (valid.length <= limit) return valid;
  const centers = valid.map(bounds => bounds.getCenter(new Vector3()));
  const selected = [0];
  while (selected.length < limit) {
    let next = -1, distance = -1;
    for (let i = 0; i < centers.length; i++) {
      if (selected.includes(i)) continue;
      const nearest = Math.min(...selected.map(index => centers[i].distanceToSquared(centers[index])));
      if (nearest > distance) { distance = nearest; next = i; }
    }
    selected.push(next);
  }
  return selected.map(index => valid[index]);
}

/**
 * Find an angle that exposes the next pieces through the already placed CAD.
 * Bounds reject distant parts cheaply; triangles decide actual occlusion so
 * spaces between beams and pieces remain usable viewpoints.
 */
export function chooseAssemblyView(bounds, direction, aspect, { targets = [], occluders = [] } = {}) {
  const current = direction?.clone().normalize() || DEFAULT_DIRECTION.clone();
  if (current.lengthSq() < .001) current.copy(DEFAULT_DIRECTION);
  const samples = representativeTargets(targets);
  if (!samples.length || !occluders.length) return { direction: current, visibility: 1, rotated: false };
  const raycaster = new Raycaster(), hit = new Vector3(), delta = new Vector3();
  const visible = (point, position) => {
    delta.subVectors(point, position);
    const distance = delta.length();
    if (distance < .01) return true;
    raycaster.set(position, delta.normalize());
    raycaster.near = .1;
    raycaster.far = Math.max(.1, distance - .5);
    for (const occluder of occluders) {
      if (!occluder.bounds.containsPoint(position) && (!raycaster.ray.intersectBox(occluder.bounds, hit) || hit.distanceTo(position) >= raycaster.far)) continue;
      if (raycaster.intersectObjects(occluder.meshes, false).some(intersection => intersection.distance < raycaster.far)) return false;
    }
    return true;
  };
  const visibility = candidate => {
    const frame = frameAssemblyBounds(bounds, candidate, aspect, { focus: true });
    let visiblePieces = 0, visiblePoints = 0;
    for (const box of samples) {
      const center = box.getCenter(new Vector3()), half = box.getSize(new Vector3()).multiplyScalar(.42);
      const towardCamera = frame.position.clone().sub(center).normalize();
      // The center and two surface samples distinguish a buried piece from a
      // visible edge. The target parts themselves are excluded as occluders.
      const surface = center.clone().add(new Vector3(
        Math.sign(towardCamera.x) * half.x,
        Math.sign(towardCamera.y) * half.y,
        Math.sign(towardCamera.z) * half.z,
      ));
      const upper = center.clone().add(new Vector3(0, Math.sign(towardCamera.y || 1) * half.y, 0));
      const count = [center, surface, upper].filter(point => visible(point, frame.position)).length;
      if (count) visiblePieces++;
      visiblePoints += count;
    }
    return .8 * visiblePieces / samples.length + .2 * visiblePoints / (samples.length * 3);
  };
  const currentVisibility = visibility(current);
  // A clear angle should remain steady across consecutive small placements.
  if (currentVisibility >= .94) return { direction: current, visibility: currentVisibility, rotated: false };
  const candidates = [];
  const azimuth = Math.atan2(current.z, current.x);
  for (const elevation of [.35, .85, 1.55, -.65]) {
    for (let i = 0; i < 8; i++) {
      const angle = azimuth + i * Math.PI / 4;
      candidates.push(new Vector3(Math.cos(angle), elevation, Math.sin(angle)).normalize());
    }
  }
  candidates.push(new Vector3(.02, 1, .12).normalize(), new Vector3(.02, -1, .12).normalize());
  let best = { direction: current, visibility: currentVisibility, score: currentVisibility };
  for (const candidate of candidates) {
    const rotation = (1 - current.dot(candidate)) / 2;
    // Once a nearby angle is clear, farther turns cannot beat it. Avoid tracing
    // thousands more triangles after the answer is already decided.
    if (1 - .09 * rotation <= best.score + .000001) continue;
    const clarity = visibility(candidate);
    const score = clarity - .09 * rotation;
    if (score > best.score) best = { direction: candidate, visibility: clarity, score };
  }
  // Ignore marginal changes from a tiny visible edge or numerical differences.
  if (best.visibility < currentVisibility + .1) return { direction: current, visibility: currentVisibility, rotated: false };
  return { direction: best.direction, visibility: best.visibility, rotated: true };
}

/** Orbit between frames instead of passing through the model on a turn. */
export function interpolateAssemblyFrame(fromPosition, fromTarget, toPosition, toTarget, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const from = fromPosition.clone().sub(fromTarget), to = toPosition.clone().sub(toTarget);
  const distance = from.length() * (1 - t) + to.length() * t;
  from.normalize(); to.normalize();
  const rotation = new Quaternion().setFromUnitVectors(from, to);
  const partial = new Quaternion().slerp(rotation, t);
  const target = fromTarget.clone().lerp(toTarget, t);
  return { target, position: from.applyQuaternion(partial).multiplyScalar(distance).add(target) };
}

/** Fit a world-space box, reserving room for the build controls and target label. */
export function frameAssemblyBounds(bounds, direction, aspect, { focus = false } = {}) {
  const safe = bounds?.isEmpty() === false ? bounds.clone() : new Box3(new Vector3(-60,-60,-60), new Vector3(60,60,60));
  const target = safe.getCenter(new Vector3());
  const size = safe.getSize(new Vector3());
  if (focus) {
    // Nearby studs remain visible around even the smallest next piece.
    size.addScalar(56).max(new Vector3(130,100,130));
  }
  const outward = direction?.clone() || new Vector3(1.25,.65,1.3);
  if (outward.lengthSq() < .001) outward.set(1.25,.65,1.3);
  outward.normalize();
  const worldUp = Math.abs(outward.y) > .995 ? new Vector3(0,0,-1) : new Vector3(0,1,0);
  const right = new Vector3().crossVectors(worldUp,outward).normalize();
  const up = new Vector3().crossVectors(outward,right).normalize();
  const tan = Math.tan(34*Math.PI/360), safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  let distance = 120;
  for (const x of [-1,1]) for (const y of [-1,1]) for (const z of [-1,1]) {
    const corner = new Vector3(x*size.x/2,y*size.y/2,z*size.z/2);
    distance = Math.max(distance,corner.dot(outward)+Math.max(Math.abs(corner.dot(right))/(tan*safeAspect*.78),Math.abs(corner.dot(up))/(tan*.64)));
  }
  return { target, position:outward.multiplyScalar(distance).add(target), up:worldUp, distance, minDistance:35, maxDistance:Math.max(distance*3,2400) };
}
