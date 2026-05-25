"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere } from "@react-three/drei";
import * as THREE from "three";

function getPointOnSphere(radius: number) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta) * radius,
    Math.sin(phi) * Math.sin(theta) * radius,
    Math.cos(phi) * radius,
  );
}

function GlobeMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const pointData = useMemo(() => {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const pts: THREE.Vector3[] = [];

    for (let i = 0; i < count; i++) {
      const p = getPointOnSphere(2);
      pts.push(p.clone());
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const hue = 0.5 + Math.random() * 0.3;
      const c = new THREE.Color().setHSL(hue, 0.9, 0.5 + Math.random() * 0.2);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = 0.02 + Math.random() * 0.04;
    }

    const linePositions: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = pts[i].distanceTo(pts[j]);
        if (d < 0.9 && Math.random() < 0.04) {
          linePositions.push(pts[i].x, pts[i].y, pts[i].z);
          linePositions.push(pts[j].x, pts[j].y, pts[j].z);
        }
      }
    }

    return { positions, colors, sizes, linePositions };
  }, []);

  const pulseTime = useRef(0);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
    }
    if (glowRef.current) {
      glowRef.current.rotation.x += delta * 0.015;
      glowRef.current.rotation.y += delta * 0.025;
    }
    pulseTime.current += delta;
    if (pointsRef.current && pointsRef.current.geometry.attributes.size) {
      const sizes = pointsRef.current.geometry.attributes.size
        .array as Float32Array;
      for (let i = 0; i < sizes.length; i++) {
        sizes[i] =
          0.025 + Math.sin(pulseTime.current * 2 + i * 0.08) * 0.02 + 0.005;
      }
      pointsRef.current.geometry.attributes.size.needsUpdate = true;
    }
    if (linesRef.current) {
      linesRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      {/* كرة خارجية شفافة بخريطة سلكية */}
      <Sphere args={[2, 64, 64]}>
        <meshPhongMaterial
          color="#00e5ff"
          wireframe
          transparent
          opacity={0.08}
        />
      </Sphere>

      {/* طبقة توهج داخلية */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.98, 32, 32]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.03} />
      </mesh>

      {/* النقاط المضيئة النابضة */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2500}
            array={pointData.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={2500}
            array={pointData.colors}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            count={2500}
            array={pointData.sizes}
            itemSize={1}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.025}
          transparent
          opacity={0.9}
          vertexColors
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* خطوط الربط بين النقاط */}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={pointData.linePositions.length / 3}
            array={new Float32Array(pointData.linePositions)}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      {/* حلقات حول الكرة - متعددة الألوان */}
      <mesh rotation={[Math.PI / 2, 0.2, 0]}>
        <torusGeometry args={[2.3, 0.006, 24, 120]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.25} />
      </mesh>
      <mesh rotation={[Math.PI / 3, 0.4, 0.3]}>
        <torusGeometry args={[2.55, 0.004, 24, 120]} />
        <meshBasicMaterial color="#bf5af2" transparent opacity={0.15} />
      </mesh>
      <mesh rotation={[Math.PI / 6, -0.3, 0.5]}>
        <torusGeometry args={[2.7, 0.003, 16, 100]} />
        <meshBasicMaterial color="#39ff14" transparent opacity={0.1} />
      </mesh>
      <mesh rotation={[Math.PI / 1.5, 0.5, 0.7]}>
        <torusGeometry args={[2.45, 0.005, 20, 110]} />
        <meshBasicMaterial color="#ffca28" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const count = 700;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds: number[] = [];
    for (let i = 0; i < count; i++) {
      const r = 2.5 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
      positions[i * 3 + 2] = Math.cos(phi) * r;
      speeds.push(0.002 + Math.random() * 0.006);
      const c = new THREE.Color().setHSL(
        0.5 + Math.random() * 0.3,
        0.8,
        0.4 + Math.random() * 0.3,
      );
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    return { positions, colors, speeds };
  }, []);

  useFrame((_, delta) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.02;
      particlesRef.current.rotation.x += delta * 0.008;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={700}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={700}
          array={particles.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        transparent
        opacity={0.35}
        vertexColors
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function DynamicLights() {
  const light1Ref = useRef<THREE.PointLight>(null);
  const light2Ref = useRef<THREE.PointLight>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta * 0.3;
    if (light1Ref.current) {
      light1Ref.current.position.x = Math.sin(timeRef.current) * 8;
      light1Ref.current.position.z = Math.cos(timeRef.current) * 8;
      light1Ref.current.intensity = 0.4 + Math.sin(timeRef.current * 1.5) * 0.2;
    }
    if (light2Ref.current) {
      light2Ref.current.position.x = Math.sin(timeRef.current + 2) * 7;
      light2Ref.current.position.z = Math.cos(timeRef.current + 2) * 7;
      light2Ref.current.intensity =
        0.3 + Math.cos(timeRef.current * 1.2) * 0.15;
    }
  });

  return (
    <>
      <pointLight
        ref={light1Ref}
        position={[8, 4, 0]}
        intensity={0.5}
        color="#00e5ff"
      />
      <pointLight
        ref={light2Ref}
        position={[-6, -3, 6]}
        intensity={0.4}
        color="#bf5af2"
      />
      <ambientLight intensity={0.15} />
    </>
  );
}

export default function CyberGlobe() {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <DynamicLights />
        <GlobeMesh />
        <FloatingParticles />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          rotateSpeed={0.3}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
