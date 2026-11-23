import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Line, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { ThreatState } from '../../types/chemistry';
import { THREATS } from '../../data/waves';

// ─────────────────────────────────────────────────────────────────────────────
// Visualised disruptors: plasma orbs, lightning, shockwave rings, H₂O jets.
// Each reads its mutable engine state every frame (no React re-render).
// ─────────────────────────────────────────────────────────────────────────────

const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false } as const;

export default function ThreatParticle({ threat }: { threat: ThreatState }) {
  const spec = THREATS[threat.specId];
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!group.current) return;
    group.current.position.set(threat.position[0], 0, threat.position[2]);
    if (body.current) body.current.rotation.y = threat.heading;
    if (bar.current) {
      const f = Math.max(0, threat.hp / threat.maxHp);
      bar.current.scale.x = Math.max(0.001, f);
      bar.current.position.x = -(1 - f) * 0.25;
    }
  });

  let visual: JSX.Element;
  switch (spec.type) {
    case 'thermal':
      visual = <ThermalOrb color={spec.color} plasma={!!spec.plasma} cryo={!!spec.cryo} />;
      break;
    case 'electrical':
      visual = <ArcBolt color={spec.color} big={spec.intensity > 2} />;
      break;
    case 'shear':
      visual = <Shockwave color={spec.color} glancing={spec.shearMode === 'glancing'} />;
      break;
    case 'solvent':
      visual = <SolventJet color={spec.color} solventKind={spec.solventKind ?? 'polar'} />;
      break;
  }

  return (
    <group ref={group}>
      <group ref={body}>{visual}</group>
      <Billboard position={[0, 1.05, 0]}>
        <mesh>
          <planeGeometry args={[0.52, 0.06]} />
          <meshBasicMaterial color="#0f172a" transparent opacity={0.8} />
        </mesh>
        <mesh ref={bar} position-z={0.001}>
          <planeGeometry args={[0.5, 0.04]} />
          <meshBasicMaterial color={spec.color} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

function ThermalOrb({ color, plasma, cryo }: { color: string; plasma: boolean; cryo: boolean }) {
  const glow = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const seed = useMemo(() => Math.random() * 10, []);
  const size = plasma ? 1.45 : cryo ? 1.12 : 1;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    const p = 1 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05;
    glow.current?.scale.setScalar(p * size);
    halo.current?.scale.setScalar((1.1 + Math.sin(t * 3) * 0.15) * size);
    if (cryo && glow.current) glow.current.rotation.y = t * 1.4;
  });
  return (
    <group position-y={0.5}>
      <mesh scale={size} rotation={cryo ? [0.6, 0.4, 0.2] : [0, 0, 0]}>
        {cryo ? <octahedronGeometry args={[0.16, 0]} /> : <sphereGeometry args={[0.13, 16, 12]} />}
        <meshBasicMaterial color={cryo ? '#e0f2fe' : plasma ? '#ffffff' : '#fff7ed'} toneMapped={false} />
      </mesh>
      <mesh ref={glow}>
        {cryo ? <octahedronGeometry args={[0.24, 0]} /> : <sphereGeometry args={[0.24, 16, 12]} />}
        <meshBasicMaterial color={color} opacity={0.55} wireframe={cryo} {...additive} />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.42, 16, 12]} />
        <meshBasicMaterial color={cryo ? '#0284c7' : plasma ? '#8b5cf6' : '#ef4444'} opacity={0.16} {...additive} />
      </mesh>
      <Sparkles count={plasma ? 22 : cryo ? 16 : 12} scale={plasma ? 1.2 : 0.85} size={plasma ? 5 : 3} speed={cryo ? 0.9 : 1.6} color={color} />
    </group>
  );
}

const BOLT_SEGMENTS = 9;
function boltPoints(spread: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= BOLT_SEGMENTS; i++) {
    const y = 1.0 - (i / BOLT_SEGMENTS) * 0.98;
    const s = i === 0 || i === BOLT_SEGMENTS ? 0.02 : spread;
    pts.push(new THREE.Vector3((Math.random() - 0.5) * s, y, (Math.random() - 0.5) * s));
  }
  return pts;
}

function ArcBolt({ color, big }: { color: string; big: boolean }) {
  const main = useRef<any>(null);
  const branch = useRef<any>(null);
  const orb = useRef<THREE.Mesh>(null);
  const timer = useRef(0);
  const init = useMemo(() => boltPoints(0.3), []);
  useFrame((_, dt) => {
    timer.current += dt;
    if (timer.current > 0.06) {
      timer.current = 0;
      const a = boltPoints(big ? 0.34 : 0.2);
      main.current?.geometry?.setPositions(a.flatMap((p) => [p.x, p.y, p.z]));
      const b = boltPoints(big ? 0.5 : 0.3).map((p) => p.multiplyScalar(0.7).add(new THREE.Vector3(0.1, 0.25, 0)));
      branch.current?.geometry?.setPositions(b.flatMap((p) => [p.x, p.y, p.z]));
      orb.current?.scale.setScalar(0.85 + Math.random() * 0.4);
    }
  });
  return (
    <group>
      <Line ref={main} points={init} color={color} lineWidth={big ? 3 : 2} transparent opacity={0.95} toneMapped={false} />
      {big && <Line ref={branch} points={init} color="#e0f2fe" lineWidth={1.2} transparent opacity={0.7} toneMapped={false} />}
      <mesh ref={orb} position-y={0.55}>
        <sphereGeometry args={[big ? 0.22 : 0.13, 14, 10]} />
        <meshBasicMaterial color={color} opacity={0.35} {...additive} />
      </mesh>
      <mesh position-y={0.03} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.05, big ? 0.28 : 0.16, 20]} />
        <meshBasicMaterial color={color} opacity={0.5} {...additive} />
      </mesh>
    </group>
  );
}

function Shockwave({ color, glancing }: { color: string; glancing: boolean }) {
  const rings = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];
  const seed = useMemo(() => Math.random(), []);
  useFrame(({ clock }) => {
    rings.forEach((r, i) => {
      if (!r.current) return;
      const ph = (clock.elapsedTime * 1.6 + i / 3 + seed) % 1;
      r.current.scale.setScalar(0.4 + ph * 1.1);
      r.current.position.z = 0.15 - ph * 0.35;
      (r.current.material as THREE.MeshBasicMaterial).opacity = (1 - ph) * 0.85;
    });
  });
  return (
    <group position-y={0.42} rotation-z={glancing ? Math.PI / 4 : 0}>
      {rings.map((r, i) => (
        <mesh key={i} ref={r}>
          <torusGeometry args={[0.3, 0.03, 8, 36]} />
          <meshBasicMaterial color={color} {...additive} />
        </mesh>
      ))}
      <mesh rotation-x={Math.PI / 2} position-z={0.18}>
        <coneGeometry args={[0.14, 0.34, 4]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} metalness={0.6} roughness={0.3} flatShading />
      </mesh>
    </group>
  );
}

function WaterMolecule() {
  // Bent H₂O, H–O–H ≈ 104.5°
  const a = (104.5 / 2) * (Math.PI / 180);
  const d = 0.085;
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.06, 12, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#7f1d1d" roughness={0.3} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[Math.sin(a) * d * s, Math.cos(a) * d, 0]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function HexaneChain() {
  // Zig-zag non-polar C₆ backbone
  return (
    <group>
      {[-2, -1, 0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.055, (i % 2 ? 1 : -1) * 0.028, 0]}>
          <sphereGeometry args={[0.038, 10, 8]} />
          <meshStandardMaterial color="#84cc16" emissive="#365314" roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function HydroniumIon() {
  // Pyramidal H₃O⁺
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.058, 12, 8]} />
        <meshStandardMaterial color="#4ade80" emissive="#14532d" roughness={0.25} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const ang = (i / 3) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(ang) * 0.075, 0.045, Math.sin(ang) * 0.075]}>
            <sphereGeometry args={[0.032, 10, 8]} />
            <meshStandardMaterial color="#f8fafc" emissive="#22c55e" emissiveIntensity={0.35} roughness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

function SolventJet({ color, solventKind }: { color: string; solventKind: 'polar' | 'nonpolar' | 'acid' }) {
  const orbit = useRef<THREE.Group>(null);
  const blob = useRef<THREE.Mesh>(null);
  const seed = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }, dt) => {
    if (orbit.current) {
      orbit.current.rotation.y += dt * 2.2;
      orbit.current.rotation.x = Math.sin(clock.elapsedTime + seed) * 0.4;
    }
    if (blob.current) {
      const t = clock.elapsedTime * 5 + seed;
      blob.current.scale.set(1 + Math.sin(t) * 0.08, 1 + Math.cos(t * 1.3) * 0.1, 1 + Math.sin(t * 0.7) * 0.08);
    }
  });
  return (
    <group position-y={0.4}>
      <mesh ref={blob}>
        <sphereGeometry args={[0.2, 20, 14]} />
        <meshPhysicalMaterial color={color} transparent opacity={0.45} roughness={0.05} transmission={0} clearcoat={1} emissive={color} emissiveIntensity={0.35} />
      </mesh>
      <group ref={orbit}>
        {[0, 1, 2, 3].map((i) => {
          const ang = (i / 4) * Math.PI * 2;
          return (
            <group key={i} position={[Math.cos(ang) * 0.32, (i % 2 ? 0.06 : -0.06), Math.sin(ang) * 0.32]} rotation={[ang, ang * 2, 0]}>
              {solventKind === 'nonpolar' ? <HexaneChain /> : solventKind === 'acid' ? <HydroniumIon /> : <WaterMolecule />}
            </group>
          );
        })}
      </group>
    </group>
  );
}
