"use client";

import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor, Sparkles } from "@react-three/drei";
import * as THREE from "three";

const WIDTH = 18;
const DEPTH = 10;

/* Simplex noise 3D (Ashima Arts / Stefan Gustavson, MIT) */
const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uEnergy;
uniform float uScroll;
uniform vec3 uMouse;
uniform float uMouseStrength;
attribute float aRow;
varying float vRow;
varying float vHeight;
varying float vEdge;
${NOISE_GLSL}
void main() {
  vec3 p = position;
  float t = uTime * 0.32;
  float envelope = exp(-pow(p.x / 5.8, 2.0));
  float n = snoise(vec3(p.x * 0.26, p.z * 0.34 - t * 0.7, t * 0.45));
  float n2 = snoise(vec3(p.x * 0.85, p.z * 0.6 + t, t * 1.2)) * 0.32;
  float wave = sin(p.x * 1.5 - t * 3.2 + p.z * 0.65) * 0.2;
  float h = (n * 1.15 + n2 + wave) * envelope;

  float d = distance(p.xz, uMouse.xz);
  float ripple = exp(-d * d * 0.32) * (0.85 + 0.3 * sin(d * 5.0 - uTime * 5.5)) * uMouseStrength;
  h += ripple;

  h *= 1.0 + uEnergy * 2.4;
  h += sin(p.x * 5.5 + uTime * 11.0 + p.z) * uEnergy * 0.35 * envelope;

  p.y += h;
  p.y -= uScroll * 1.6;

  vHeight = h;
  vRow = aRow;
  vEdge = smoothstep(${(WIDTH / 2).toFixed(1)}, ${(WIDTH / 2 - 3).toFixed(1)}, abs(p.x));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uHighlight;
uniform vec3 uShadow;
uniform float uScroll;
varying float vRow;
varying float vHeight;
varying float vEdge;
void main() {
  float heat = smoothstep(-0.25, 1.15, vHeight);
  vec3 color = mix(uShadow, uHighlight, heat);
  // bande speculari: riflesso da metallo cromato
  color += vec3(0.18) * sin(vHeight * 14.0 + vRow * 6.0);
  color += uHighlight * pow(max(vHeight, 0.0), 3.0) * 0.35;
  float depth = mix(0.12, 1.0, vRow * vRow);
  float alpha = vEdge * depth * (0.42 + clamp(vHeight, 0.0, 1.6) * 0.75);
  alpha *= 1.0 - clamp(uScroll, 0.0, 1.0) * 0.85;
  gl_FragColor = vec4(color, alpha);
}
`;

function Waveform({ reduced, compact }: { reduced: boolean; compact: boolean }) {
  const { camera } = useThree();
  const group = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    // Su mobile meno linee e meno vertici: stesso look, un terzo del costo GPU
    const ROWS = compact ? 34 : 58;
    const COLS = compact ? 140 : 240;
    const positions = new Float32Array(ROWS * COLS * 3);
    const rows = new Float32Array(ROWS * COLS);
    const indices: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      const z = -DEPTH / 2 + (r / (ROWS - 1)) * DEPTH;
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        positions[i * 3] = -WIDTH / 2 + (c / (COLS - 1)) * WIDTH;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = z;
        rows[i] = r / (ROWS - 1);
        if (c < COLS - 1) indices.push(i, i + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aRow", new THREE.BufferAttribute(rows, 1));
    g.setIndex(indices);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), WIDTH);
    return g;
  }, [compact]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uEnergy: { value: 0 },
          uScroll: { value: 0 },
          uMouse: { value: new THREE.Vector3(0, 0, 2) },
          uMouseStrength: { value: 0 },
          uHighlight: { value: new THREE.Color("#FFFFFF") },
          uShadow: { value: new THREE.Color("#5A5A5A") },
        },
      }),
    [],
  );

  const helpers = useMemo(
    () => ({
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      hit: new THREE.Vector3(),
      raycaster: new THREE.Raycaster(),
      lastPointer: new THREE.Vector2(99, 99),
      activity: 0,
      lastScroll: 0,
    }),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const u = material.uniforms;
    u.uTime.value += dt * (reduced ? 0.15 : 1);

    // Mouse → proiezione sul piano della forma d'onda
    const pointer = state.pointer;
    const moved = pointer.distanceToSquared(helpers.lastPointer) > 1e-6;
    helpers.lastPointer.copy(pointer);
    helpers.activity = moved ? 1 : Math.max(0, helpers.activity - dt * 0.35);
    helpers.raycaster.setFromCamera(pointer, camera);
    if (helpers.raycaster.ray.intersectPlane(helpers.plane, helpers.hit)) {
      (u.uMouse.value as THREE.Vector3).lerp(helpers.hit, 1 - Math.exp(-dt * 6));
    }
    u.uMouseStrength.value = THREE.MathUtils.lerp(u.uMouseStrength.value, 0.25 + helpers.activity * 0.75, 1 - Math.exp(-dt * 3));

        // Energia dallo scroll (funziona anche su mobile, dove non c'è il mouse)
    const y = window.scrollY;
    const velocity = Math.abs(y - helpers.lastScroll) / Math.max(dt, 1e-3);
    helpers.lastScroll = y;
    u.uEnergy.value = THREE.MathUtils.lerp(u.uEnergy.value, Math.min(velocity / 2500, 0.6), 1 - Math.exp(-dt * 4));
    const scroll = typeof window !== "undefined" ? window.scrollY / window.innerHeight : 0;
    u.uScroll.value = THREE.MathUtils.lerp(u.uScroll.value, scroll, 1 - Math.exp(-dt * 8));

    // Parallax della camera sul movimento del mouse
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, pointer.x * 0.12, 1 - Math.exp(-dt * 2));
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -pointer.y * 0.06, 1 - Math.exp(-dt * 2));
      group.current.position.y = -u.uScroll.value * 0.6;
    }
  });

  return (
    <group ref={group}>
      <lineSegments geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}

function CameraRig() {
  const { camera } = useThree();
  useLayoutEffect(() => {
    camera.position.set(0, 3.1, 7.8);
    camera.lookAt(0, -0.2, 0);
  }, [camera]);
  return null;
}

export default function WaveformScene({
  eventSource,
  active,
  reduced,
  compact,
  onReady,
}: {
  eventSource: RefObject<HTMLElement | null>;
  active: boolean;
  reduced: boolean;
  compact: boolean;
  onReady: () => void;
}) {
  const [dpr, setDpr] = useState(compact ? 1.25 : 1.5);

  return (
    <Canvas
      dpr={[1, dpr]}
      frameloop={active ? "always" : "never"}
      camera={{ fov: 40, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      eventSource={eventSource as RefObject<HTMLElement>}
      eventPrefix="client"
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        onReady();
      }}
      aria-hidden="true"
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.75)} />
      <CameraRig />
      <fog attach="fog" args={["#0D0D0D", 8, 20]} />
      <Waveform reduced={reduced} compact={compact} />
      <Sparkles count={compact ? 30 : 70} scale={[16, 5, 9]} position={[0, 1.2, 0]} size={2.2} speed={reduced ? 0 : 0.25} opacity={0.55} color="#E6E6E6" />
      <Sparkles count={compact ? 16 : 40} scale={[16, 5, 9]} position={[0, 1.4, 0]} size={1.6} speed={reduced ? 0 : 0.18} opacity={0.4} color="#9A9A9A" />
    </Canvas>
  );
}
