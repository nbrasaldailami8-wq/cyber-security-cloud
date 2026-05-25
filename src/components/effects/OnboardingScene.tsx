"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sphere, Html } from "@react-three/drei";
import * as THREE from "three";

function GlobeMesh() {
  const groupRef = useRef<THREE.Group>(null);

  // نقاط أكثر كثافة
  const points = useMemo(() => {
    const pts = [];
    const count = 5000;
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2;
      pts.push(
        Math.sin(phi) * Math.cos(theta) * r,
        Math.sin(phi) * Math.sin(theta) * r,
        Math.cos(phi) * r,
      );
    }
    return new Float32Array(pts);
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      {/* الكرة الخارجية الشفافة */}
      <Sphere args={[2, 80, 80]}>
        <meshPhongMaterial
          color="#00e5ff"
          wireframe
          transparent
          opacity={0.08}
        />
      </Sphere>

      {/* الكرة الداخلية - زجاجية */}
      <Sphere args={[1.95, 64, 64]}>
        <meshPhongMaterial
          color="#00e5ff"
          transparent
          opacity={0.04}
          emissive="#00e5ff"
          emissiveIntensity={0.1}
        />
      </Sphere>

      {/* النقاط المضيئة - كثافة عالية */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={5000}
            array={points}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.025}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* نقاط نيون زرقاء أكبر */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={800}
            array={points.slice(0, 2400)}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color="#00e5ff"
          size={0.04}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* حلقة 1 */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.3, 0.008, 32, 150]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.5} />
      </mesh>

      {/* حلقة 2 */}
      <mesh rotation={[Math.PI / 3, 0.4, 0]}>
        <torusGeometry args={[2.55, 0.005, 32, 150]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.3} />
      </mesh>

      {/* حلقة 3 */}
      <mesh rotation={[Math.PI / 6, -0.3, 0.5]}>
        <torusGeometry args={[2.7, 0.003, 16, 120]} />
        <meshBasicMaterial color="#bf5af2" transparent opacity={0.2} />
      </mesh>

      {/* حلقة 4 - بنفسجية */}
      <mesh rotation={[0, Math.PI / 4, Math.PI / 3]}>
        <torusGeometry args={[2.8, 0.004, 16, 100]} />
        <meshBasicMaterial color="#7a00ff" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

function FloatingParticles() {
  const particlesRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const pts = [];
    const count = 300;
    for (let i = 0; i < count; i++) {
      pts.push(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 4,
      );
    }
    return new Float32Array(pts);
  }, []);

  useFrame((_, delta) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.02;
      particlesRef.current.rotation.x += delta * 0.01;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={300}
          array={particles}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#00e5ff"
        size={0.03}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

interface OnboardingSceneProps {
  showCard?: boolean;
  title?: string;
  subtitle?: string;
  description?: string;
  children?: React.ReactNode;
}

export default function OnboardingScene({
  showCard = true,
  title,
  subtitle,
  description,
  children,
}: OnboardingSceneProps) {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 42 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{ background: "transparent" }}
      >
        {/* إضاءة محسنة */}
        <ambientLight intensity={0.4} />
        <pointLight position={[8, 6, 8]} intensity={0.8} color="#00e5ff" />
        <pointLight position={[-6, -4, -6]} intensity={0.4} color="#7a00ff" />
        <pointLight position={[0, 8, 0]} intensity={0.3} color="#ffffff" />

        <GlobeMesh />
        <FloatingParticles />

        {/* بطاقة المعلومات */}
        {showCard && (title || subtitle || description || children) && (
          <Html position={[0, -3.2, 0]} center style={{ width: "340px" }}>
            <div
              style={{
                background: "rgba(10, 16, 30, 0.6)",
                backdropFilter: "blur(25px)",
                WebkitBackdropFilter: "blur(25px)",
                border: "1px solid rgba(0, 229, 255, 0.2)",
                borderRadius: "20px",
                padding: "24px",
                textAlign: "center",
                color: "#e6edf3",
                fontFamily: "'Cairo', sans-serif",
                boxShadow: "0 0 50px rgba(0, 229, 255, 0.08)",
              }}
            >
              {title && (
                <h2
                  style={{
                    color: "#00e5ff",
                    fontSize: "1.5rem",
                    fontWeight: 800,
                    marginBottom: "8px",
                  }}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p
                  style={{
                    color: "#00e5ff",
                    fontSize: "0.9rem",
                    marginBottom: "12px",
                    opacity: 0.8,
                  }}
                >
                  {subtitle}
                </p>
              )}
              {description && (
                <p
                  style={{
                    color: "#e6edf3",
                    fontSize: "0.9rem",
                    lineHeight: 1.7,
                    whiteSpace: "pre-line",
                  }}
                >
                  {description}
                </p>
              )}
              {children}
            </div>
          </Html>
        )}
      </Canvas>
    </div>
  );
}
