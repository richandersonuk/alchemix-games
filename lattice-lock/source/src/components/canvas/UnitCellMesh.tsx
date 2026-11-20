import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import type { BondKind, UnitCell } from '../../types/chemistry';

// ─────────────────────────────────────────────────────────────────────────────
// Procedural unit-cell renderer. Atoms and bonds are instanced, so each
// cell costs a handful of draw calls regardless of atom count.
// ─────────────────────────────────────────────────────────────────────────────

const SPHERE_LOW = new THREE.SphereGeometry(1, 14, 10);
const SPHERE_HIGH = new THREE.SphereGeometry(1, 32, 24);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
const UP = new THREE.Vector3(0, 1, 0);

const BOND_STYLE: Record<BondKind, { radius: number; color: string; dashed: boolean; group: 'solid' | 'metallic' | 'dashed' }> = {
  covalent: { radius: 0.032, color: '#e2e8f0', dashed: false, group: 'solid' },
  ionic: { radius: 0.018, color: '#94a3b8', dashed: false, group: 'solid' },
  metallic: { radius: 0.012, color: '#fcd34d', dashed: false, group: 'metallic' },
  hydrogen: { radius: 0.014, color: '#60a5fa', dashed: true, group: 'dashed' },
  intermolecular: { radius: 0.012, color: '#a78bfa', dashed: true, group: 'dashed' },
};

export function cellRadius(cell: UnitCell) {
  let r = 0;
  for (const a of cell.atoms) r = Math.max(r, Math.hypot(...a.position) + a.radius);
  if (cell.box) r = Math.max(r, Math.hypot(...cell.box) / 2);
  return r || 1;
}

interface Segment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  color: THREE.Color;
}

interface Props {
  cell: UnitCell;
  /** World radius the cell is scaled to fit. */
  fitRadius?: number;
  detail?: 'low' | 'high';
  highlightCoordination?: boolean;
  showBonds?: boolean;
  showElectrons?: boolean;
  showBox?: boolean;
  /** Tint mixed into every atom (damage / hydration feedback). */
  tint?: string;
  tintAmount?: number;
}

export default function UnitCellMesh({
  cell,
  fitRadius = 0.4,
  detail = 'low',
  highlightCoordination = false,
  showBonds = true,
  showElectrons = true,
  showBox = true,
  tint,
  tintAmount = 0,
}: Props) {
  const scale = fitRadius / cellRadius(cell);
  const atomsRef = useRef<THREE.InstancedMesh>(null);
  const solidRef = useRef<THREE.InstancedMesh>(null);
  const metalRef = useRef<THREE.InstancedMesh>(null);
  const dashRef = useRef<THREE.InstancedMesh>(null);

  const neighbours = useMemo(() => {
    const set = new Set<number>();
    if (cell.centreAtomId === undefined) return set;
    for (const b of cell.bonds) {
      if (b.kind === 'intermolecular') continue;
      if (b.a === cell.centreAtomId) set.add(b.b);
      if (b.b === cell.centreAtomId) set.add(b.a);
    }
    return set;
  }, [cell]);

  const highlightOn = highlightCoordination && cell.centreAtomId !== undefined;

  const segments = useMemo(() => {
    const groups: Record<'solid' | 'metallic' | 'dashed', Segment[]> = { solid: [], metallic: [], dashed: [] };
    const hl = new THREE.Color('#fde047');
    const dim = new THREE.Color('#1e293b');
    for (const b of cell.bonds) {
      const st = BOND_STYLE[b.kind];
      const A = cell.atoms[b.a];
      const B = cell.atoms[b.b];
      const pa = new THREE.Vector3(...A.position);
      const pb = new THREE.Vector3(...B.position);
      const involves = b.a === cell.centreAtomId || b.b === cell.centreAtomId;
      let color = new THREE.Color(st.color);
      let radius = st.radius;
      if (highlightOn) {
        if (involves && b.kind !== 'intermolecular') {
          color = hl.clone();
          radius *= 1.6;
        } else color.lerp(dim, 0.7);
      }
      // Trim bond ends so they meet atom surfaces
      const dir = pb.clone().sub(pa);
      const len = dir.length();
      dir.normalize();
      const s = pa.clone().addScaledVector(dir, A.radius * 0.8);
      const e = pb.clone().addScaledVector(dir, -B.radius * 0.8);
      if (st.dashed) {
        const n = Math.max(2, Math.round(len / 0.09));
        for (let i = 0; i < n; i++) {
          const t0 = i / n;
          const t1 = (i + 0.5) / n;
          groups[st.group].push({ start: s.clone().lerp(e, t0), end: s.clone().lerp(e, t1), radius, color });
        }
      } else groups[st.group].push({ start: s, end: e, radius, color });
    }
    return groups;
  }, [cell, highlightOn]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const c = new THREE.Color();
    const tintC = tint ? new THREE.Color(tint) : null;
    const dim = new THREE.Color('#0f172a');
    const white = new THREE.Color('#ffffff');

    const atoms = atomsRef.current;
    if (atoms) {
      cell.atoms.forEach((a, i) => {
        let r = a.radius;
        c.set(a.color);
        if (highlightOn) {
          if (i === cell.centreAtomId) {
            c.lerp(white, 0.35);
            r *= 1.15;
          } else if (!neighbours.has(i)) {
            c.lerp(dim, 0.75);
            r *= 0.6;
          }
        }
        if (tintC && tintAmount > 0) c.lerp(tintC, tintAmount);
        m.compose(v.set(...a.position), q.identity(), sc.set(r, r, r));
        atoms.setMatrixAt(i, m);
        atoms.setColorAt(i, c);
      });
      atoms.instanceMatrix.needsUpdate = true;
      if (atoms.instanceColor) atoms.instanceColor.needsUpdate = true;
    }

    const write = (mesh: THREE.InstancedMesh | null, segs: Segment[]) => {
      if (!mesh) return;
      segs.forEach((s, i) => {
        const dir = s.end.clone().sub(s.start);
        const len = dir.length();
        q.setFromUnitVectors(UP, dir.normalize());
        v.copy(s.start).lerp(s.end, 0.5);
        m.compose(v, q, sc.set(s.radius, len, s.radius));
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, s.color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    write(solidRef.current, segments.solid);
    write(metalRef.current, segments.metallic);
    write(dashRef.current, segments.dashed);
  }, [cell, segments, highlightOn, neighbours, tint, tintAmount]);

  const boxGeo = useMemo(() => (cell.box ? new THREE.EdgesGeometry(new THREE.BoxGeometry(...cell.box)) : null), [cell]);

  const polyhedron = useMemo(() => {
    if (!highlightOn || neighbours.size < 4) return null;
    try {
      const pts = [...neighbours].map((i) => new THREE.Vector3(...cell.atoms[i].position));
      const g = new ConvexGeometry(pts);
      return { mesh: g, edges: new THREE.EdgesGeometry(g, 1) };
    } catch {
      return null;
    }
  }, [cell, highlightOn, neighbours]);

  const sphereGeo = detail === 'high' ? SPHERE_HIGH : SPHERE_LOW;
  const radius = useMemo(() => cellRadius(cell), [cell]);

  return (
    <group scale={scale}>
      <instancedMesh key={`a-${cell.atoms.length}-${detail}`} ref={atomsRef} args={[sphereGeo, undefined, cell.atoms.length]} castShadow={detail === 'low'}>
        <meshStandardMaterial roughness={0.28} metalness={0.15} />
      </instancedMesh>
      {showBonds && segments.solid.length > 0 && (
        <instancedMesh key={`s-${segments.solid.length}`} ref={solidRef} args={[CYL, undefined, segments.solid.length]}>
          <meshStandardMaterial roughness={0.5} metalness={0.1} />
        </instancedMesh>
      )}
      {showBonds && segments.metallic.length > 0 && (
        <instancedMesh key={`m-${segments.metallic.length}`} ref={metalRef} args={[CYL, undefined, segments.metallic.length]}>
          <meshBasicMaterial transparent opacity={0.35} depthWrite={false} />
        </instancedMesh>
      )}
      {showBonds && segments.dashed.length > 0 && (
        <instancedMesh key={`d-${segments.dashed.length}`} ref={dashRef} args={[CYL, undefined, segments.dashed.length]}>
          <meshBasicMaterial transparent opacity={0.8} />
        </instancedMesh>
      )}
      {showBox && boxGeo && (
        <lineSegments geometry={boxGeo}>
          <lineBasicMaterial color="#38bdf8" transparent opacity={0.28} />
        </lineSegments>
      )}
      {polyhedron && (
        <group>
          <mesh geometry={polyhedron.mesh}>
            <meshBasicMaterial color="#fde047" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <lineSegments geometry={polyhedron.edges}>
            <lineBasicMaterial color="#fde047" transparent opacity={0.6} />
          </lineSegments>
        </group>
      )}
      {showElectrons && cell.electronSea === 'volume' && <ElectronSea radius={radius * 0.92} count={detail === 'high' ? 160 : 45} />}
      {showElectrons && cell.electronSea === 'layers' &&
        (cell.layerHeights ?? [0]).map((y, i) => (
          <ElectronSea key={i} radius={radius * 0.85} count={detail === 'high' ? 70 : 18} planarY={y} />
        ))}
    </group>
  );
}

/** Drifting delocalised electrons: a 3D sea for metals, or a plane per graphite layer. */
function ElectronSea({ radius, count, planarY }: { radius: number; count: number; planarY?: number }) {
  const planar = planarY !== undefined;
  const { geo, vel } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = radius * Math.cbrt(Math.random());
      const th = Math.random() * Math.PI * 2;
      const ph = planar ? Math.PI / 2 : Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = planar ? planarY! + 0.035 : r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      vel[i * 3] = (Math.random() - 0.5) * 0.8;
      vel[i * 3 + 1] = planar ? 0 : (Math.random() - 0.5) * 0.8;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g, vel };
  }, [count, radius, planar, planarY]);

  useFrame((_, dt) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    const d = Math.min(dt, 0.05);
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      vel[ix] += (Math.random() - 0.5) * 2 * d;
      vel[ix + 2] += (Math.random() - 0.5) * 2 * d;
      if (!planar) vel[ix + 1] += (Math.random() - 0.5) * 2 * d;
      a[ix] += vel[ix] * d;
      a[ix + 1] += vel[ix + 1] * d;
      a[ix + 2] += vel[ix + 2] * d;
      const cy = planar ? planarY! + 0.035 : 0;
      const rr = Math.hypot(a[ix], planar ? 0 : a[ix + 1] - cy, a[ix + 2]);
      if (rr > radius) {
        vel[ix] *= -1;
        vel[ix + 1] *= -1;
        vel[ix + 2] *= -1;
        a[ix] *= radius / rr;
        a[ix + 2] *= radius / rr;
        if (!planar) a[ix + 1] *= radius / rr;
      }
    }
    p.needsUpdate = true;
  });

  return (
    <group>
      <points geometry={geo}>
        <pointsMaterial color="#67e8f9" size={0.05} sizeAttenuation transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </points>
      {planar ? (
        <mesh position-y={planarY} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[radius, 6]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ) : (
        <mesh>
          <sphereGeometry args={[radius, 24, 16]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </group>
  );
}
