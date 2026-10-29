// Tech stack sphere: text sprites on a Fibonacci sphere around a wireframe core.
import * as THREE from 'three';

const TECH = [
  'TypeScript', 'React', 'Next.js', 'React Native', 'Tailwind', 'Node.js', 'Express', 'FastAPI',
  'Python', 'RAG', 'LiteLLM', 'OpenAI API', 'Agents', 'FastMCP', 'Ollama', 'Socket.io', 'Redis',
  'BullMQ', 'MongoDB', 'PostgreSQL', 'MySQL', 'MinIO', 'Docker', 'Nginx', 'Linux', 'Azure',
  'AWS', 'Entra ID', 'Active Directory', 'LDAP',
];
const HOT = new Set(['TypeScript', 'React', 'Node.js', 'Python', 'RAG', 'Agents']);

function makeLabel(text, hot) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `900 64px "Big Shoulders Display", "Arial Narrow", sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text.toUpperCase()).width) + 48;
  c.width = w; c.height = 96;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = hot ? '#d2ff00' : '#f2f1e9';
  ctx.fillText(text.toUpperCase(), 24, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  return { tex, aspect: w / 96 };
}

export function initGarage(container) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const root = new THREE.Group();
  scene.add(root);

  const R = 2.7;
  const core = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.35, 1)),
    new THREE.LineBasicMaterial({ color: 0xd2ff00, transparent: true, opacity: 0.35 })
  );
  root.add(core);
  const shell = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(R * 0.98, 3)),
    new THREE.LineBasicMaterial({ color: 0xf2f1e9, transparent: true, opacity: 0.04 })
  );
  root.add(shell);

  // orbit ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(R * 1.12, 0.006, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0xd2ff00, transparent: true, opacity: 0.5 })
  );
  ring.rotation.x = Math.PI / 2.3;
  scene.add(ring);

  const sprites = [];
  const N = TECH.length;
  TECH.forEach((name, i) => {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = Math.PI * (3 - Math.sqrt(5)) * i;
    const { tex, aspect } = makeLabel(name, HOT.has(name));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const h = 0.34;
    sp.userData = { base: new THREE.Vector2(h * aspect, h), name };
    sp.scale.set(h * aspect, h, 1);
    sp.position.set(Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R);
    root.add(sp);
    sprites.push(sp);
  });

  function resize() {
    const r = container.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // interaction: drag to spin, hover to tilt, inertia
  const vel = { x: 0.0, y: 0.003 };
  const tilt = { x: 0, y: 0 };
  let dragging = false, lx = 0, ly = 0;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(9, 9);

  container.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; container.setPointerCapture(e.pointerId); });
  container.addEventListener('pointerup', () => { dragging = false; });
  container.addEventListener('pointerleave', () => { ndc.set(9, 9); tilt.x = tilt.y = 0; });
  container.addEventListener('pointermove', (e) => {
    const r = container.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    tilt.x = ndc.y * 0.25; tilt.y = ndc.x * 0.25;
    if (dragging) {
      vel.y = (e.clientX - lx) * 0.0009;
      vel.x = (e.clientY - ly) * 0.0009;
      lx = e.clientX; ly = e.clientY;
    }
  });
  container.style.touchAction = 'pan-y';

  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '100px' }).observe(container);

  const tmp = new THREE.Vector3();
  const lime = new THREE.Color(0xd2ff00), white = new THREE.Color(0xffffff);
  let hovered = null;
  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const t = clock.getElapsedTime();

    root.rotation.y += vel.y;
    root.rotation.x += vel.x;
    if (!dragging) {
      vel.y += (0.003 - vel.y) * 0.03;
      vel.x += (0 - vel.x) * 0.05;
      root.rotation.x += (tilt.x - root.rotation.x) * 0.02;
    }
    core.rotation.y = -t * 0.4; core.rotation.z = t * 0.2;
    ring.rotation.z = t * 0.15;
    scene.rotation.y += (tilt.y * 0.5 - scene.rotation.y) * 0.05;

    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(sprites, false)[0];
    hovered = hit ? hit.object : null;

    for (const sp of sprites) {
      sp.getWorldPosition(tmp);
      const depth = (tmp.z + R) / (2 * R); // 0 back -> 1 front
      const isHot = sp === hovered;
      const s = (0.55 + depth * 0.6) * (isHot ? 1.35 : 1);
      sp.scale.x += (sp.userData.base.x * s - sp.scale.x) * 0.2;
      sp.scale.y += (sp.userData.base.y * s - sp.scale.y) * 0.2;
      sp.material.opacity = 0.12 + Math.pow(depth, 1.6) * 0.88;
      sp.material.color.copy(isHot ? lime : white);
    }
    container.style.cursor = hovered ? 'pointer' : '';
    renderer.render(scene, camera);
  }
  tick();
}
