import * as THREE from "three";
import type { UVIsland } from "./floodFill";
import {
  getIslandTrianglePositions,
  getIslandTriangleNormals,
} from "./floodFill";

// ============================================================================
// TYPES
// ============================================================================

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number; // 0-1, starts at 1
  maxLife: number;
  size: number;
  opacity: number;
}

export interface SporeSystem {
  points: THREE.Points;
  particles: Particle[];
  emitting: boolean;
  dispose: () => void;
}

export interface SporeConfig {
  maxParticles: number;
  particleSize: number;
  emissionRate: number; // particles per second
  speed: number;
  speedVariation: number;
  lifetime: number;
  lifetimeVariation: number;
  gravity: number;
  spread: number; // How much particles spread from normal direction
  fadeStart: number; // When to start fading (0-1 of life)
  color: THREE.Color | string;
}

const DEFAULT_CONFIG: SporeConfig = {
  maxParticles: 200,
  particleSize: 0.015,
  emissionRate: 60,
  speed: 0.3,
  speedVariation: 0.15,
  lifetime: 1.5,
  lifetimeVariation: 0.5,
  gravity: 0.05,
  spread: 0.4,
  fadeStart: 0.3,
  color: "#ffffff",
};

// ============================================================================
// SPORE VERTEX SHADER
// ============================================================================

const sporeVertexShader = `
attribute float aOpacity;
attribute float aSize;

varying float vOpacity;

void main() {
  vOpacity = aOpacity;
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (300.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
}
`;

// ============================================================================
// SPORE FRAGMENT SHADER
// ============================================================================

const sporeFragmentShader = `
uniform vec3 uColor;
varying float vOpacity;

void main() {
  // Circular particle with soft edges
  vec2 center = gl_PointCoord - vec2(0.5);
  float dist = length(center);
  
  // Soft circle falloff
  float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
  
  // Apply particle opacity
  alpha *= vOpacity;
  
  if (alpha < 0.01) discard;
  
  gl_FragColor = vec4(uColor, alpha);
}
`;

// ============================================================================
// CREATE SPORE SYSTEM
// ============================================================================

export function createSporeSystem(
  config: Partial<SporeConfig> = {}
): SporeSystem {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Create geometry with particle attributes
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(cfg.maxParticles * 3);
  const opacities = new Float32Array(cfg.maxParticles);
  const sizes = new Float32Array(cfg.maxParticles);

  // Initialize all positions far away (will be updated when particles spawn)
  for (let i = 0; i < cfg.maxParticles; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = -1000; // Off screen
    positions[i * 3 + 2] = 0;
    opacities[i] = 0;
    sizes[i] = cfg.particleSize;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aOpacity", new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  // Create material
  const material = new THREE.ShaderMaterial({
    vertexShader: sporeVertexShader,
    fragmentShader: sporeFragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(cfg.color) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // Create points mesh
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  // Particle pool
  const particles: Particle[] = [];

  return {
    points,
    particles,
    emitting: false,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

// ============================================================================
// SPORE EMITTER
// ============================================================================

export interface SporeEmitter {
  system: SporeSystem;
  config: SporeConfig;
  emissionAccumulator: number;
  sourcePositions: Float32Array | null;
  sourceNormals: Float32Array | null;
  worldMatrix: THREE.Matrix4;
  setSource: (
    island: UVIsland | null,
    geometry: THREE.BufferGeometry | null,
    mesh: THREE.Mesh | null
  ) => void;
  setColor: (color: THREE.Color | string) => void;
  setEmitting: (emitting: boolean) => void;
  update: (deltaTime: number) => void;
  dispose: () => void;
}

export function createSporeEmitter(
  scene: THREE.Scene,
  config: Partial<SporeConfig> = {}
): SporeEmitter {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const system = createSporeSystem(cfg);
  scene.add(system.points);

  let sourcePositions: Float32Array | null = null;
  let sourceNormals: Float32Array | null = null;
  let worldMatrix = new THREE.Matrix4();
  let emissionAccumulator = 0;

  const tempVec = new THREE.Vector3();
  const tempNormal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();

  const setSource = (
    island: UVIsland | null,
    geometry: THREE.BufferGeometry | null,
    mesh: THREE.Mesh | null
  ) => {
    if (!island || !geometry || !mesh) {
      sourcePositions = null;
      sourceNormals = null;
      return;
    }

    sourcePositions = getIslandTrianglePositions(island, geometry);
    sourceNormals = getIslandTriangleNormals(island, geometry);

    // Get world matrix from mesh hierarchy
    mesh.updateWorldMatrix(true, false);
    worldMatrix.copy(mesh.matrixWorld);
    normalMatrix.getNormalMatrix(worldMatrix);
  };

  const setColor = (color: THREE.Color | string) => {
    (system.points.material as THREE.ShaderMaterial).uniforms.uColor.value =
      new THREE.Color(color);
  };

  const setEmitting = (emitting: boolean) => {
    system.emitting = emitting;
  };

  const spawnParticle = (): Particle | null => {
    if (!sourcePositions || !sourceNormals || sourcePositions.length === 0) {
      return null;
    }

    // Pick a random vertex from the source
    const vertexCount = sourcePositions.length / 3;
    const vertexIndex = Math.floor(Math.random() * vertexCount);

    // Get position in local space
    tempVec.set(
      sourcePositions[vertexIndex * 3],
      sourcePositions[vertexIndex * 3 + 1],
      sourcePositions[vertexIndex * 3 + 2]
    );

    // Transform to world space
    tempVec.applyMatrix4(worldMatrix);

    // Get normal in local space
    tempNormal.set(
      sourceNormals[vertexIndex * 3],
      sourceNormals[vertexIndex * 3 + 1],
      sourceNormals[vertexIndex * 3 + 2]
    );

    // Transform normal to world space
    tempNormal.applyMatrix3(normalMatrix).normalize();

    // Create velocity along normal with some spread
    const spread = cfg.spread;
    const velocity = new THREE.Vector3(
      tempNormal.x + (Math.random() - 0.5) * spread,
      tempNormal.y + (Math.random() - 0.5) * spread,
      tempNormal.z + (Math.random() - 0.5) * spread
    );
    velocity.normalize();

    const speedMult =
      cfg.speed + (Math.random() - 0.5) * cfg.speedVariation * 2;
    velocity.multiplyScalar(speedMult);

    const lifetime =
      cfg.lifetime + (Math.random() - 0.5) * cfg.lifetimeVariation * 2;

    return {
      position: tempVec.clone(),
      velocity,
      life: 1,
      maxLife: lifetime,
      size: cfg.particleSize * (0.8 + Math.random() * 0.4),
      opacity: 1,
    };
  };

  const update = (deltaTime: number) => {
    const positions = system.points.geometry.getAttribute(
      "position"
    ) as THREE.BufferAttribute;
    const opacities = system.points.geometry.getAttribute(
      "aOpacity"
    ) as THREE.BufferAttribute;
    const sizes = system.points.geometry.getAttribute(
      "aSize"
    ) as THREE.BufferAttribute;

    // Emit new particles if emitting
    if (system.emitting && sourcePositions) {
      emissionAccumulator += deltaTime * cfg.emissionRate;

      while (
        emissionAccumulator >= 1 &&
        system.particles.length < cfg.maxParticles
      ) {
        const particle = spawnParticle();
        if (particle) {
          system.particles.push(particle);
        }
        emissionAccumulator -= 1;
      }

      // Cap accumulator
      if (emissionAccumulator > 10) emissionAccumulator = 10;
    }

    // Update existing particles
    for (let i = system.particles.length - 1; i >= 0; i--) {
      const p = system.particles[i];

      // Update life
      p.life -= deltaTime / p.maxLife;

      if (p.life <= 0) {
        // Remove dead particle
        system.particles.splice(i, 1);
        continue;
      }

      // Apply gravity (subtle upward drift for spore effect)
      p.velocity.y += cfg.gravity * deltaTime;

      // Update position
      p.position.x += p.velocity.x * deltaTime;
      p.position.y += p.velocity.y * deltaTime;
      p.position.z += p.velocity.z * deltaTime;

      // Slow down over time
      p.velocity.multiplyScalar(0.98);

      // Calculate opacity based on life
      if (p.life < cfg.fadeStart) {
        p.opacity = p.life / cfg.fadeStart;
      } else {
        p.opacity = 1;
      }
    }

    // Update buffer attributes
    for (let i = 0; i < cfg.maxParticles; i++) {
      if (i < system.particles.length) {
        const p = system.particles[i];
        positions.setXYZ(i, p.position.x, p.position.y, p.position.z);
        opacities.setX(i, p.opacity);
        sizes.setX(i, p.size);
      } else {
        // Hide unused particles
        positions.setXYZ(i, 0, -1000, 0);
        opacities.setX(i, 0);
      }
    }

    positions.needsUpdate = true;
    opacities.needsUpdate = true;
    sizes.needsUpdate = true;
  };

  const dispose = () => {
    scene.remove(system.points);
    system.dispose();
  };

  return {
    system,
    config: cfg,
    emissionAccumulator,
    sourcePositions,
    sourceNormals,
    worldMatrix,
    setSource,
    setColor,
    setEmitting,
    update,
    dispose,
  };
}
