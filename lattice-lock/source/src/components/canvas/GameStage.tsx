import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Line, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { engine, useStructureTick, useUiTick } from '../../hooks/useEngine';
import { LATTICES, BONDING_META } from '../../data/lattices';
import { DAMAGE_META } from '../../data/waves';
import { getActiveCoreTile, getActiveLanesWorldPoints, GRID_H, GRID_W, isBuildable, isPathTile, tileToWorld } from '../../engine/map';
import type { TowerState, Verdict } from '../../types/chemistry';
import UnitCellMesh from './UnitCellMesh';
import { useSettings } from '../../engine/settings';
import type { LayoutMode } from '../../hooks/useLayout';
import ThreatParticle from './ThreatParticle';

// ─────────────────────────────────────────────────────────────────────────────
// Main 3D stage: grid, lane, core, towers, threats, beams and particle FX.
// ─────────────────────────────────────────────────────────────────────────────

export default function GameStage({ attract = false, layout = 'desktop' }: { attract?: boolean; layout?: LayoutMode }) {
  const { quality } = useSettings();
  const high = quality === 'high';
  return (
    <Canvas
      key={quality}
      className="!absolute inset-0 touch-none"
      shadows={high}
      dpr={high ? [1, 2] : [1, 1.25]}
      camera={{ position: [0.5, 14.5, 12.5], fov: 42, near: 0.1, far: 200 }}
      gl={{ antialias: high, toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'high-performance' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <color attach="background" args={['#04060c']} />
      <fog attach="fog" args={['#04060c', 22, 48]} />
      <ambientLight intensity={high ? 0.45 : 0.7} />
      <hemisphereLight args={['#93c5fd', '#0b1020', 0.5]} />
      <directionalLight
        position={[7, 14, 6]}
        intensity={1.5}
        castShadow={high}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <Stars radius={60} depth={30} count={high ? 1800 : 500} factor={3} saturation={0.4} fade speed={0.4} />
      <EngineDriver />
      <Board interactive={!attract} />
      {!attract && <PlacementGhost />}
      <Core />
      <Towers />
      <Threats />
      <Beams />
      <Effects />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableRotate={!attract}
        enableZoom={!attract}
        autoRotate={attract}
        autoRotateSpeed={0.35}
        minPolarAngle={0.25}
        maxPolarAngle={1.25}
        minDistance={5}
        maxDistance={60}
        enableDamping
        dampingFactor={0.08}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }}
      />
      <CameraFit layout={layout} />
    </Canvas>
  );
}

/**
 * Frames the 14×9 board for the current screen. In portrait the camera swings
 * 90° so the long axis of the board runs up the screen (spawn at top, core at
 * the bottom). Re-runs only when the viewport shape or layout changes, so it
 * never fights the player's own orbiting/zooming.
 */
function CameraFit({ layout }: { layout: LayoutMode }) {
  const { camera, size, scene } = useThree();
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void; maxDistance: number } | null;
  useEffect(() => {
    if (!controls) return;
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const portrait = layout === 'portrait';
    // Board extents as seen on screen (+ margin)
    const across = (portrait ? GRID_H : GRID_W) + 1.2;
    const deep = (portrait ? GRID_W : GRID_H) + 1.2;
    const vf = (cam.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    // HUD occupies part of the screen on compact layouts
    const usableW = layout === 'landscape' ? 0.78 : layout === 'desktop' ? 0.62 : 1;
    const usableH = portrait ? 0.62 : layout === 'landscape' ? 0.8 : 0.82;
    const dW = across / 2 / Math.tan((hf * usableW) / 2);
    const dH = (deep * 0.72) / 2 / Math.tan((vf * usableH) / 2);
    const d = Math.min(55, Math.max(12, dW, dH));
    const elev = 0.9; // ~52° above the board
    const target = portrait ? new THREE.Vector3(0.9, 0, 0) : layout === 'landscape' ? new THREE.Vector3(-0.6, 0, 0.6) : new THREE.Vector3(0.6, 0, 1.0);
    const dir = portrait ? new THREE.Vector3(Math.cos(elev), Math.sin(elev), 0) : new THREE.Vector3(0, Math.sin(elev), Math.cos(elev));
    camera.position.copy(target).addScaledVector(dir, d);
    controls.target.copy(target);
    controls.maxDistance = Math.max(30, d * 1.5);
    controls.update();
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = d * 1.1;
      scene.fog.far = d * 2.6;
    }
  }, [layout, size.width, size.height, controls, camera, scene]);
  return null;
}

function EngineDriver() {
  useFrame((_, dt) => engine.update(dt));
  return null;
}

// ── Board ───────────────────────────────────────────────────────────────────

const TILE_GEO = new THREE.BoxGeometry(0.94, 0.18, 0.94);

function Board({ interactive }: { interactive: boolean }) {
  useStructureTick();
  const sector = engine.sectorId;
  const pointerType = useRef<string>('mouse');
  const ground = useRef<THREE.InstancedMesh>(null);
  const lane = useRef<THREE.InstancedMesh>(null);

  const tiles = useMemo(() => {
    const core = getActiveCoreTile();
    const g: [number, number][] = [];
    const p: [number, number][] = [];
    for (let x = 0; x < GRID_W; x++)
      for (let z = 0; z < GRID_H; z++) {
        if (x === core.x && z === core.z) continue;
        (isPathTile(x, z) ? p : g).push([x, z]);
      }
    return { g, p };
  }, [sector]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    tiles.g.forEach(([x, z], i) => {
      const [wx, , wz] = tileToWorld(x, z);
      m.makeTranslation(wx, -0.09, wz);
      ground.current!.setMatrixAt(i, m);
      c.set((x + z) % 2 ? '#111a2b' : '#0d1524');
      ground.current!.setColorAt(i, c);
    });
    tiles.p.forEach(([x, z], i) => {
      const [wx, , wz] = tileToWorld(x, z);
      m.makeTranslation(wx, -0.16, wz);
      lane.current!.setMatrixAt(i, m);
      c.set('#08283a');
      lane.current!.setColorAt(i, c);
    });
    ground.current!.instanceMatrix.needsUpdate = true;
    lane.current!.instanceMatrix.needsUpdate = true;
    ground.current!.instanceColor!.needsUpdate = true;
    lane.current!.instanceColor!.needsUpdate = true;
  }, [tiles]);

  const lanes = useMemo(
    () => getActiveLanesWorldPoints().map((pts) => pts.map((p) => new THREE.Vector3(p[0], 0.0, p[2]))),
    [sector],
  );

  const tileFromEvent = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const x = Math.round(e.point.x + (GRID_W - 1) / 2);
    const z = Math.round(e.point.z + (GRID_H - 1) / 2);
    if (x < 0 || x >= GRID_W || z < 0 || z >= GRID_H) return null;
    return { x, z };
  };

  return (
    <group>
      <instancedMesh key={`g-${sector}-${tiles.g.length}`} ref={ground} args={[TILE_GEO, undefined, tiles.g.length]} receiveShadow>
        <meshStandardMaterial roughness={0.85} metalness={0.2} />
      </instancedMesh>
      <instancedMesh key={`p-${sector}-${tiles.p.length}`} ref={lane} args={[TILE_GEO, undefined, tiles.p.length]} receiveShadow>
        <meshStandardMaterial roughness={0.4} metalness={0.4} emissive="#0e7490" emissiveIntensity={0.25} />
      </instancedMesh>
      {lanes.map((pts, idx) => (
        <LaneLine key={`${sector}-${idx}`} points={pts} />
      ))}
      {/* base slab */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <boxGeometry args={[GRID_W + 0.6, 0.2, GRID_H + 0.6]} />
        <meshStandardMaterial color="#060b14" roughness={0.9} />
      </mesh>
      <gridHelper args={[GRID_W, GRID_W, '#0e2a3a', '#0e2a3a']} position={[0, 0.002, 0]} scale={[1, 1, GRID_H / GRID_W]} />
      {/* spawn portals */}
      {lanes.map((pts, idx) => (
        <SpawnPortal key={`${sector}-portal-${idx}`} point={[pts[0].x, pts[0].y, pts[0].z]} />
      ))}
      {/* pointer catcher */}
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={0.02}
        visible={interactive}
        onPointerDown={(e) => {
          pointerType.current = e.nativeEvent.pointerType || 'mouse';
        }}
        onPointerMove={(e) => {
          if (!interactive || e.nativeEvent.pointerType !== 'mouse') return;
          e.stopPropagation();
          engine.setHover(tileFromEvent(e));
        }}
        onPointerOut={() => engine.setHover(null)}
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          const touch = pointerType.current !== 'mouse';
          if (e.delta > (touch ? 14 : 4)) return; // orbit drag, not a tap
          const t = tileFromEvent(e);
          if (!t) return;
          const placing = engine.selection.placing;
          const existing = engine.towerAt(t.x, t.z);
          if (placing && !existing) {
            if (touch) {
              // Two-step on touch: preview first, confirm with a second tap (or the Build button)
              const p = engine.selection.pending;
              if (p && p.x === t.x && p.z === t.z) engine.confirmPending();
              else engine.setPending(t);
            } else engine.placeTower(placing, t.x, t.z);
          } else if (existing) engine.selectTower(existing.id);
          else engine.clearSelection();
        }}
        onContextMenu={(e) => {
          e.nativeEvent.preventDefault();
          engine.clearSelection();
        }}
      >
        <planeGeometry args={[GRID_W, GRID_H]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function LaneLine({ points }: { points: THREE.Vector3[] }) {
  const dashRef = useRef<any>(null);
  useFrame((_, dt) => {
    const mat = dashRef.current?.material;
    if (mat) mat.dashOffset -= dt * 0.8;
  });
  return <Line ref={dashRef} points={points} color="#22d3ee" lineWidth={2} dashed dashSize={0.25} gapSize={0.2} transparent opacity={0.65} toneMapped={false} />;
}

function SpawnPortal({ point }: { point: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.8;
  });
  return (
    <group position={[point[0] + 0.3, 0.45, point[2]]} rotation-y={Math.PI / 2}>
      <mesh ref={ref}>
        <torusGeometry args={[0.45, 0.04, 8, 6]} />
        <meshBasicMaterial color="#f43f5e" toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color="#f43f5e" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Placement ghost / selection ring ────────────────────────────────────────

function PlacementGhost() {
  useUiTick();
  const { placing, towerId, pending } = engine.selection;
  const hover = pending ?? engine.selection.hover;
  const selTower = towerId !== null ? engine.towers.find((t) => t.id === towerId) : undefined;

  let ring: { pos: [number, number, number]; range: number; color: string } | null = null;
  let tile: { pos: [number, number, number]; color: string } | null = null;

  if (placing && hover) {
    const lat = LATTICES[placing];
    const ok = engine.canPlace(hover.x, hover.z) && engine.moles >= lat.cost;
    const pos = tileToWorld(hover.x, hover.z);
    tile = { pos, color: ok ? '#22d3ee' : '#f43f5e' };
    if (isBuildable(hover.x, hover.z)) ring = { pos, range: lat.stats.range, color: ok ? '#22d3ee' : '#f43f5e' };
  } else if (hover) {
    tile = { pos: tileToWorld(hover.x, hover.z), color: engine.towerAt(hover.x, hover.z) ? '#fde047' : '#334155' };
  }
  if (selTower) ring = { pos: selTower.position, range: LATTICES[selTower.latticeId].stats.range, color: '#fde047' };

  return (
    <group>
      {tile && (
        <mesh position={[tile.pos[0], 0.015, tile.pos[2]]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.96, 0.96]} />
          <meshBasicMaterial color={tile.color} transparent opacity={0.28} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {ring && (
        <mesh position={[ring.pos[0], 0.03, ring.pos[2]]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[ring.range - 0.04, ring.range, 64]} />
          <meshBasicMaterial color={ring.color} transparent opacity={0.7} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {ring && (
        <mesh position={[ring.pos[0], 0.025, ring.pos[2]]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[ring.range, 64]} />
          <meshBasicMaterial color={ring.color} transparent opacity={0.06} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// ── Core ────────────────────────────────────────────────────────────────────

function Core() {
  useStructureTick();
  const crystal = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const coreTile = getActiveCoreTile();
  const pos = tileToWorld(coreTile.x, coreTile.z);
  const cyan = useMemo(() => new THREE.Color('#22d3ee'), []);
  const red = useMemo(() => new THREE.Color('#f43f5e'), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (crystal.current) {
      crystal.current.rotation.y += dt * 0.6;
      crystal.current.position.y = 0.95 + Math.sin(t * 1.5) * 0.06;
    }
    if (shell.current) shell.current.rotation.y -= dt * 0.25;
    const health = engine.core / 100;
    tmp.copy(cyan).lerp(red, Math.max(engine.coreFlash, 1 - health) * 0.9);
    if (mat.current) {
      mat.current.emissive.copy(tmp);
      mat.current.emissiveIntensity = 0.6 + engine.coreFlash * 2 + Math.sin(t * 3) * 0.1;
    }
    if (light.current) {
      light.current.color.copy(tmp);
      light.current.intensity = 2.5 + engine.coreFlash * 6;
    }
  });
  return (
    <group position={pos}>
      <mesh position-y={0.1} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.58, 0.2, 6]} />
        <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh ref={crystal} castShadow>
        <octahedronGeometry args={[0.38, 0]} />
        <meshStandardMaterial ref={mat} color="#cffafe" metalness={0.2} roughness={0.1} emissive="#22d3ee" flatShading />
      </mesh>
      <mesh ref={shell} position-y={0.95}>
        <icosahedronGeometry args={[0.62, 0]} />
        <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.3} />
      </mesh>
      <pointLight ref={light} position-y={1.1} distance={6} decay={1.6} />
    </group>
  );
}

// ── Towers ──────────────────────────────────────────────────────────────────

function Towers() {
  useStructureTick();
  return (
    <>
      {engine.towers.map((t) => (
        <TowerMesh key={`${t.id}-${t.latticeId}`} tower={t} />
      ))}
    </>
  );
}

function TowerMesh({ tower }: { tower: TowerState }) {
  useUiTick();
  const lat = LATTICES[tower.latticeId];
  const cell = useMemo(() => lat.buildCell(), [lat]);
  const spin = useRef<THREE.Group>(null);
  const shake = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Mesh>(null);
  const barMat = useRef<THREE.MeshBasicMaterial>(null);
  const bubble = useRef<THREE.Mesh>(null);
  const enter = useRef(0);
  const hydrated = tower.hydratedUntil > engine.time;
  const selected = engine.selection.towerId === tower.id;
  const bondColor = BONDING_META[lat.bonding].color;

  useFrame(({ clock }, dt) => {
    enter.current = Math.min(1, enter.current + dt * 3);
    const e = 1 - Math.pow(1 - enter.current, 3);
    if (spin.current) {
      spin.current.rotation.y += dt * 0.35;
      spin.current.scale.setScalar(e);
    }
    if (shake.current) {
      const f = tower.hitFlash;
      const t = clock.elapsedTime;
      const k = tower.hitType === 'thermal' ? 0.05 : tower.hitType === 'shear' ? 0.08 : 0.025;
      shake.current.position.set(Math.sin(t * 61) * f * k, 0.78 + Math.sin(t * 47) * f * k * 0.5, Math.cos(t * 53) * f * k);
    }
    const frac = Math.max(0, tower.integrity / lat.stats.maxIntegrity);
    if (bar.current) {
      bar.current.scale.x = Math.max(0.001, frac);
      bar.current.position.x = -(1 - frac) * 0.3;
    }
    if (barMat.current) barMat.current.color.setHSL(0.33 * frac, 0.85, 0.55);
    if (bubble.current) {
      bubble.current.visible = tower.hydratedUntil > engine.time;
      bubble.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.04);
    }
  });

  return (
    <group position={tower.position}>
      <mesh position-y={0.09} castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.45, 0.18, 6]} />
        <meshStandardMaterial color="#111827" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position-y={0.185} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.3, 0.38, 6]} />
        <meshBasicMaterial color={selected ? '#fde047' : bondColor} toneMapped={false} />
      </mesh>
      <group ref={shake} position-y={0.78}>
        <group ref={spin}>
          <UnitCellMesh cell={cell} fitRadius={0.42} tint={hydrated ? '#38bdf8' : undefined} tintAmount={hydrated ? 0.35 : 0} />
        </group>
      </group>
      <mesh ref={bubble} position-y={0.78} visible={false}>
        <sphereGeometry args={[0.5, 20, 14]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.13} depthWrite={false} />
      </mesh>
      <Billboard position={[0, 1.42, 0]}>
        <mesh>
          <planeGeometry args={[0.64, 0.07]} />
          <meshBasicMaterial color="#020617" transparent opacity={0.85} />
        </mesh>
        <mesh ref={bar} position-z={0.001}>
          <planeGeometry args={[0.6, 0.045]} />
          <meshBasicMaterial ref={barMat} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

// ── Threats ─────────────────────────────────────────────────────────────────

function Threats() {
  useStructureTick();
  return (
    <>
      {engine.threats.map((t) => (
        <ThreatParticle key={t.id} threat={t} />
      ))}
    </>
  );
}

// ── Interaction beams ───────────────────────────────────────────────────────

const MAX_BEAMS = 128;
const VERDICT_COLOR: Record<Verdict, string> = { counter: '#34d399', neutral: '#fde047', weak: '#f43f5e' };

function Beams() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), []);
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), a: new THREE.Vector3(), b: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), up: new THREE.Vector3(0, 1, 0), d: new THREE.Vector3() }),
    [],
  );
  useFrame(({ clock }) => {
    const im = mesh.current;
    if (!im) return;
    const towers = new Map(engine.towers.map((t) => [t.id, t]));
    const threats = new Map(engine.threats.map((t) => [t.id, t]));
    let n = 0;
    for (const e of engine.engagements) {
      if (n >= MAX_BEAMS) break;
      const tw = towers.get(e.towerId);
      const th = threats.get(e.threatId);
      if (!tw || !th) continue;
      tmp.a.set(tw.position[0], 0.8, tw.position[2]);
      tmp.b.set(th.position[0], 0.45, th.position[2]);
      tmp.d.copy(tmp.b).sub(tmp.a);
      const len = tmp.d.length();
      tmp.q.setFromUnitVectors(tmp.up, tmp.d.normalize());
      const w = 0.018 + Math.abs(Math.sin(clock.elapsedTime * 30 + e.towerId)) * 0.014;
      tmp.m.compose(tmp.a.lerp(tmp.b, 0.5), tmp.q, tmp.s.set(w, len, w));
      im.setMatrixAt(n, tmp.m);
      tmp.c.set(e.verdict === 'neutral' ? DAMAGE_META[e.type].color : VERDICT_COLOR[e.verdict]);
      im.setColorAt(n, tmp.c);
      n++;
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, MAX_BEAMS]} frustumCulled={false}>
      <meshBasicMaterial transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

// ── Particle FX: sparks, shards, droplets ───────────────────────────────────

const MAX_PARTICLES = 2400;
const MAX_SHARDS = 220;

function Effects() {
  const { geo, vel, life, maxLife, base, grav } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_PARTICLES * 3).fill(-999);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
    return {
      geo: g,
      vel: new Float32Array(MAX_PARTICLES * 3),
      life: new Float32Array(MAX_PARTICLES),
      maxLife: new Float32Array(MAX_PARTICLES).fill(1),
      base: new Float32Array(MAX_PARTICLES * 3),
      grav: new Float32Array(MAX_PARTICLES),
    };
  }, []);
  const cursor = useRef(0);

  const shards = useRef<THREE.InstancedMesh>(null);
  const shardState = useMemo(
    () =>
      Array.from({ length: MAX_SHARDS }, () => ({
        p: new THREE.Vector3(0, -99, 0),
        v: new THREE.Vector3(),
        r: new THREE.Euler(),
        w: new THREE.Vector3(),
        life: 0,
        s: 1,
      })),
    [],
  );
  const shardCursor = useRef(0);
  const shardGeo = useMemo(() => new THREE.TetrahedronGeometry(0.07), []);

  const tmpC = useMemo(() => new THREE.Color(), []);
  const tmpM = useMemo(() => new THREE.Matrix4(), []);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const tmpS = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    const sm = shards.current;
    if (!sm) return;
    const white = new THREE.Color('#ffffff');
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_SHARDS; i++) {
      sm.setColorAt(i, white);
      sm.setMatrixAt(i, zero);
    }
    sm.instanceColor!.needsUpdate = true;
    sm.instanceMatrix.needsUpdate = true;
  }, []);

  const emit =(x: number, y: number, z: number, n: number, color: string, speed: number, up: number, g: number, lifeS: number) => {
    tmpC.set(color);
    const pos = geo.attributes.position.array as Float32Array;
    for (let k = 0; k < n; k++) {
      const i = cursor.current;
      cursor.current = (cursor.current + 1) % MAX_PARTICLES;
      const th = Math.random() * Math.PI * 2;
      const sp = speed * (0.3 + Math.random());
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      vel[i * 3] = Math.cos(th) * sp;
      vel[i * 3 + 1] = up * (0.4 + Math.random());
      vel[i * 3 + 2] = Math.sin(th) * sp;
      life[i] = maxLife[i] = lifeS * (0.6 + Math.random() * 0.6);
      base[i * 3] = tmpC.r;
      base[i * 3 + 1] = tmpC.g;
      base[i * 3 + 2] = tmpC.b;
      grav[i] = g;
    }
  };

  const emitShards = (x: number, y: number, z: number, n: number, color: string) => {
    tmpC.set(color);
    for (let k = 0; k < n; k++) {
      const i = shardCursor.current;
      shardCursor.current = (shardCursor.current + 1) % MAX_SHARDS;
      const s = shardState[i];
      s.p.set(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.3);
      const th = Math.random() * Math.PI * 2;
      const sp = 1.2 + Math.random() * 2;
      s.v.set(Math.cos(th) * sp, 1.5 + Math.random() * 2.5, Math.sin(th) * sp);
      s.w.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
      s.life = 1.6 + Math.random() * 0.6;
      s.s = 0.6 + Math.random() * 1.2;
      shards.current?.setColorAt(i, tmpC);
    }
    if (shards.current?.instanceColor) shards.current.instanceColor.needsUpdate = true;
  };

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    for (const ev of engine.drainEvents()) {
      const [x, y, z] = ev.position;
      switch (ev.kind) {
        case 'shatter':
          emitShards(x, y, z, 26, ev.color);
          emit(x, y, z, 50, '#e0f2fe', 2.2, 2.5, 6, 0.8);
          break;
        case 'melt':
          emit(x, y, z, 90, '#fb923c', 0.8, 2.2, -1.2, 1.4);
          emit(x, y, z, 40, '#fde047', 1.2, 1.5, -0.5, 0.9);
          break;
        case 'dissolve':
          emit(x, y, z, 90, '#38bdf8', 1.4, 2.5, 5, 1.1);
          emit(x, y, z, 30, ev.color, 1, 1.5, 3, 1.2);
          break;
        case 'zap':
          emit(x, y, z, 80, '#e0f2fe', 3, 1.5, 0, 0.5);
          break;
        case 'neutralise':
          emit(x, 0.5, z, 26, ev.color, 1.4, 1.2, 1.5, 0.6);
          break;
        case 'core':
          emit(x, 0.8, z, 70, '#f43f5e', 2.6, 2, 3, 0.9);
          break;
        case 'place':
          emit(x, y, z, 36, ev.color, 1.6, 0.6, 0, 0.6);
          break;
        case 'upgrade':
          emit(x, y, z, 70, ev.color, 0.6, 2.5, -0.5, 1.2);
          break;
        case 'graphitise':
          emitShards(x, y, z, 10, '#e0f2fe');
          emit(x, y, z, 80, '#c4b5fd', 1.2, 2, -0.6, 1.3);
          break;
      }
    }

    const pos = geo.attributes.position.array as Float32Array;
    const col = geo.attributes.color.array as Float32Array;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const ix = i * 3;
      if (life[i] <= 0) {
        pos[ix + 1] = -999;
        col[ix] = col[ix + 1] = col[ix + 2] = 0;
        continue;
      }
      vel[ix + 1] -= grav[i] * dt;
      vel[ix] *= 0.985;
      vel[ix + 2] *= 0.985;
      pos[ix] += vel[ix] * dt;
      pos[ix + 1] += vel[ix + 1] * dt;
      pos[ix + 2] += vel[ix + 2] * dt;
      if (pos[ix + 1] < 0.02) {
        pos[ix + 1] = 0.02;
        vel[ix + 1] *= -0.3;
      }
      const f = life[i] / maxLife[i];
      col[ix] = base[ix] * f;
      col[ix + 1] = base[ix + 1] * f;
      col[ix + 2] = base[ix + 2] * f;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

    const sm = shards.current;
    if (sm) {
      for (let i = 0; i < MAX_SHARDS; i++) {
        const s = shardState[i];
        if (s.life > 0) {
          s.life -= dt;
          s.v.y -= 9 * dt;
          s.p.addScaledVector(s.v, dt);
          if (s.p.y < 0.04) {
            s.p.y = 0.04;
            s.v.y *= -0.35;
            s.v.x *= 0.6;
            s.v.z *= 0.6;
            s.w.multiplyScalar(0.6);
          }
          s.r.x += s.w.x * dt;
          s.r.y += s.w.y * dt;
          s.r.z += s.w.z * dt;
        }
        const sc = s.life > 0 ? s.s * Math.min(1, s.life * 2) : 0;
        tmpM.compose(s.p, tmpQ.setFromEuler(s.r), tmpS.set(sc, sc, sc));
        sm.setMatrixAt(i, tmpM);
      }
      sm.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <points geometry={geo} frustumCulled={false}>
        <pointsMaterial size={0.07} vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} sizeAttenuation toneMapped={false} />
      </points>
      <instancedMesh ref={shards} args={[shardGeo, undefined, MAX_SHARDS]} frustumCulled={false} castShadow>
        <meshStandardMaterial metalness={0.3} roughness={0.15} emissive="#0e7490" emissiveIntensity={0.25} flatShading />
      </instancedMesh>
    </group>
  );
}
