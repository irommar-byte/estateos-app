'use client';

import { useEffect, useRef } from 'react';
import type { FloorPlanScanMeta, RoomScanObjectCategory } from '@/types/roomScan';
import { detectPlanRooms, placePlanObjects } from '@/lib/roomScan/planNormalize';

type Props = {
  meta: FloorPlanScanMeta;
  className?: string;
};

/** Kolory mebli w modelu — stonowane, jak w makiecie architektonicznej. */
const OBJECT_COLOR: Partial<Record<RoomScanObjectCategory, number>> = {
  bed: 0xc7d2fe,
  sofa: 0xbfdbfe,
  table: 0xd6b48a,
  chair: 0xe2c79f,
  storage: 0xd4d4d8,
  refrigerator: 0xe5e7eb,
  stove: 0x9ca3af,
  oven: 0x9ca3af,
  dishwasher: 0xe5e7eb,
  washerDryer: 0xe5e7eb,
  sink: 0xf1f5f9,
  toilet: 0xf8fafc,
  bathtub: 0xf8fafc,
  television: 0x334155,
  fireplace: 0xa8a29e,
  stairs: 0xd6d3d1,
};

const WET = /łaz|lazien|bath|wc|toalet|kuch|kitchen/i;

/**
 * Makieta 3D mieszkania ze skanu LiDAR (three.js): podłogi pomieszczeń, ściany z grubością, okna, drzwi i meble.
 * Obraca się sama, dopóki ktoś jej nie dotknie; renderuje tylko, gdy jest widoczna na ekranie.
 */
export default function FloorPlan3dOrbit({ meta, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import('three');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      const host = hostRef.current;
      if (disposed || !host) return;

      const b = meta.bounds;
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 4);
      const height = meta.ceilingHeightM && meta.ceilingHeightM > 1.8 ? Math.min(meta.ceilingHeightM, 3.2) : 2.6;
      // Makieta „przekrój”: ściany ścięte na ~1,2 m, żeby było widać wnętrza z góry.
      const wallH = Math.min(1.25, height * 0.5);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.touchAction = 'none';

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, span * 20);
      camera.position.set(cx + span * 0.75, span * 1.35, cz + span * 1.45);

      scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.25));
      const sun = new THREE.DirectionalLight(0xffffff, 1.35);
      sun.position.set(cx + span * 0.6, span * 2, cz + span * 0.3);
      sun.target.position.set(cx, 0, cz);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const sc = sun.shadow.camera;
      sc.left = -span;
      sc.right = span;
      sc.top = span;
      sc.bottom = -span;
      sc.far = span * 5;
      sun.shadow.radius = 4;
      scene.add(sun, sun.target);

      const disposables: Array<{ dispose: () => void }> = [];
      const mat = (color: number, extra: Record<string, unknown> = {}) => {
        const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
        disposables.push(m);
        return m;
      };
      const geo = <T extends { dispose: () => void }>(g: T) => {
        disposables.push(g);
        return g;
      };

      // Podstawa i podłogi pomieszczeń
      const base = new THREE.Mesh(geo(new THREE.BoxGeometry(b.maxX - b.minX + 0.4, 0.08, b.maxZ - b.minZ + 0.4)), mat(0xe2e8f0));
      base.position.set(cx, -0.04, cz);
      base.receiveShadow = true;
      scene.add(base);
      // Podłogi z wykrytych pomieszczeń (prostokąty wierszami scalone w jedną siatkę na pokój).
      const rooms = detectPlanRooms(meta);
      for (const room of rooms) {
        const positions: number[] = [];
        for (const [x0, z0, x1, z1] of room.rects) {
          positions.push(x0, 0.005, z0, x0, 0.005, z1, x1, 0.005, z0, x1, 0.005, z0, x0, 0.005, z1, x1, 0.005, z1);
        }
        const g = geo(new THREE.BufferGeometry());
        g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        g.computeVertexNormals();
        const floor = new THREE.Mesh(g, mat(WET.test(`${room.key} ${room.label}`) ? 0xe7edf3 : 0xeadfcf, { side: THREE.DoubleSide }));
        floor.receiveShadow = true;
        scene.add(floor);
      }

      // Ściany z grubością i delikatną krawędzią
      const wallMat = mat(0xf8fafc);
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x94a3b8 });
      disposables.push(edgeMat);
      const addBox = (x1: number, z1: number, x2: number, z2: number, y0: number, y1: number, thick: number, material: unknown, edges = false) => {
        const len = Math.hypot(x2 - x1, z2 - z1);
        if (len < 0.08) return;
        const g = geo(new THREE.BoxGeometry(len, y1 - y0, thick));
        const mesh = new THREE.Mesh(g, material);
        mesh.position.set((x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2);
        mesh.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        if (edges) {
          const lines = new THREE.LineSegments(geo(new THREE.EdgesGeometry(g)), edgeMat);
          lines.position.copy(mesh.position);
          lines.rotation.copy(mesh.rotation);
          scene.add(lines);
        }
      };
      for (const wall of meta.walls || []) addBox(wall.x1, wall.z1, wall.x2, wall.z2, 0, wallH, 0.12, wallMat, true);

      // Okna (szkło) i drzwi (jaśniejsza płyta)
      const glass = mat(0x7dd3fc, { transparent: true, opacity: 0.55, roughness: 0.1 });
      const door = mat(0xd6c7b0);
      for (const o of meta.openings || []) {
        if (o.kind === 'window') addBox(o.x1, o.z1, o.x2, o.z2, 0.8, wallH + 0.01, 0.14, glass);
        else if (o.kind === 'door') addBox(o.x1, o.z1, o.x2, o.z2, 0, wallH + 0.01, 0.14, door);
      }

      // Meble
      // Te same pozycje co na rzucie: równolegle do ścian, w swoim pokoju, bez wchodzenia w ściany.
      for (const obj of placePlanObjects(meta, rooms)) {
        const w = Math.max(0.2, obj.widthM - 0.03);
        const d = Math.max(0.2, obj.depthM - 0.03);
        const h = Math.max(0.2, Math.min(2.2, obj.heightM || 0.7));
        const mesh = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), mat(OBJECT_COLOR[obj.category] ?? 0xd4d4d8));
        mesh.position.set(obj.centerX, h / 2, obj.centerZ);
        mesh.rotation.y = -(obj.rotationDeg * Math.PI) / 180;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
      }

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(cx, 0, cz);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.maxPolarAngle = Math.PI * 0.45;
      controls.minDistance = span * 0.7;
      controls.maxDistance = span * 3;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;
      controls.addEventListener('start', () => {
        controls.autoRotate = false;
      });

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      let visible = true;
      const io = new IntersectionObserver(([entry]) => {
        visible = Boolean(entry?.isIntersecting);
      });
      io.observe(host);
      let frame = 0;
      const loop = () => {
        frame = requestAnimationFrame(loop);
        if (!visible || document.hidden) return;
        controls.update();
        renderer.render(scene, camera);
      };
      loop();

      cleanup = () => {
        cancelAnimationFrame(frame);
        ro.disconnect();
        io.disconnect();
        controls.dispose();
        disposables.forEach((item) => item.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => {});
    return () => {
      disposed = true;
      cleanup();
    };
  }, [meta]);

  return (
    <div
      ref={hostRef}
      className={className || 'relative h-[min(440px,62vw)] w-full cursor-grab bg-[#eef2f6] active:cursor-grabbing'}
      aria-label="Model 3D mieszkania — przeciągnij, aby obrócić"
    />
  );
}
