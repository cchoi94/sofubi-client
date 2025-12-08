import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import * as THREE from "three";

export interface CompassRef {
  updateRotation: (quaternion: THREE.Quaternion) => void;
}

interface CompassProps {
  onRotate: (dx: number, dy: number) => void;
  className?: string;
}

export const Compass = forwardRef<CompassRef, CompassProps>(
  ({ onRotate, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const lastMousePos = useRef<{ x: number; y: number } | null>(null);
    
    // Three.js refs
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const pivotRef = useRef<THREE.Group | null>(null);

    // Initialize/Update rotationImperatively
    useImperativeHandle(ref, () => ({
      updateRotation: (quaternion: THREE.Quaternion) => {
        if (pivotRef.current) {
          pivotRef.current.quaternion.copy(quaternion);
          // Trigger render
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
             rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        }
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      // 1. Setup Scene
      const width = 128; // Fixed size for the widget
      const height = 128;
      
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // 2. Setup Camera (Orthographic is best for Gizmos)
      const frustumSize = 2.5; 
      const aspect = width / height;
      const camera = new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2,
        (frustumSize * aspect) / 2,
        frustumSize / 2,
        frustumSize / -2,
        0.1,
        1000
      );
      camera.position.set(0, 0, 10);
      camera.lookAt(0, 0, 0);
      cameraRef.current = camera;

      // 3. Setup Renderer
      const renderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: true,
        preserveDrawingBuffer: true 
      });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height);
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // 4. Lights (to show volume)
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Higher ambient
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); // Stronger key light
      dirLight.position.set(5, 10, 7);
      scene.add(dirLight);
      
      const backLight = new THREE.DirectionalLight(0xffffff, 1.0); // Stronger rim brightness
      backLight.position.set(-5, -2, -10);
      scene.add(backLight);

      // 5. Create Gizmo Objects
      const pivotGroup = new THREE.Group();
      scene.add(pivotGroup);
      pivotRef.current = pivotGroup;

      // Shared Geometry Config
      // TorusGeometry(radius, tube, radialSegments, tubularSegments)
      const torusRadius = 0.8;
      const tubeRadius = 0.04; // Thickness
      const radialSegments = 32; // Higher quality cross-section
      const tubularSegments = 64;

      // Red X-Axis Ring (YZ Plane)
      const geoX = new THREE.TorusGeometry(torusRadius, tubeRadius, radialSegments, tubularSegments);
      const matX = new THREE.MeshStandardMaterial({ 
       color: 0x4ade80, // Green-400
        roughness: 0.1, 
        metalness: 0.4,
        emissive: 0x15803d, // Green glow
        emissiveIntensity: 0.2
      });
      const meshX = new THREE.Mesh(geoX, matX);
      meshX.rotation.y = Math.PI / 2; // Face X-axis
      pivotGroup.add(meshX);

      // Green Y-Axis Ring (XZ Plane)
      const geoY = new THREE.TorusGeometry(torusRadius, tubeRadius, radialSegments, tubularSegments);
      const matY = new THREE.MeshStandardMaterial({ 
        color: 0xf87171, // Red-400
        roughness: 0.1, 
        metalness: 0.4,
        emissive: 0x991b1b, // Red glow
        emissiveIntensity: 0.2
      });
      const meshY = new THREE.Mesh(geoY, matY);
      meshY.rotation.x = Math.PI / 2; // Face Y-axis
      pivotGroup.add(meshY);

      // Blue Z-Axis Ring (XY Plane)
      const geoZ = new THREE.TorusGeometry(torusRadius, tubeRadius, radialSegments, tubularSegments);
      const matZ = new THREE.MeshStandardMaterial({ 
        color: 0x60a5fa, // Blue-400
        roughness: 0.1, 
        metalness: 0.4,
        emissive: 0x1e40af, // Blue glow
        emissiveIntensity: 0.2
      });
      const meshZ = new THREE.Mesh(geoZ, matZ);
      // Default orientation lies on XY plane (Facing Z)
      pivotGroup.add(meshZ);

      // Center Sphere (White/Silver)
      const geoSphere = new THREE.SphereGeometry(0.2, 32, 16);
      const matSphere = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.8 // Silver center
      });
      const sphere = new THREE.Mesh(geoSphere, matSphere);
      pivotGroup.add(sphere);

      // Background Sphere
      const geoBg = new THREE.SphereGeometry(1.0, 32, 16);
      const matBg = new THREE.MeshBasicMaterial({
          color: 0x09090b, // Zinc-950 (Darker)
          transparent: true,
          opacity: 0.4, // More visible container
          side: THREE.BackSide,
          depthWrite: false
      });
      const bgSphere = new THREE.Mesh(geoBg, matBg);
      scene.add(bgSphere);

      // Initial Render
      renderer.render(scene, camera);

      // Cleanup
      return () => {
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }
        renderer.dispose();
      };
    }, []);

    // Interaction Handlers (Same as before)
    useEffect(() => {
      const handlePointerMove = (e: PointerEvent) => {
        if (!isDragging || !lastMousePos.current) return;

        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;

        lastMousePos.current = { x: e.clientX, y: e.clientY };
        onRotate(dx, dy);
      };

      const handlePointerUp = () => {
        setIsDragging(false);
        lastMousePos.current = null;
        document.body.style.cursor = "";
      };

      if (isDragging) {
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        document.body.style.cursor = "grabbing";
      }

      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        document.body.style.cursor = "";
      };
    }, [isDragging, onRotate]);

    return (
      <div
        ref={containerRef}
        className={`fixed top-6 right-6 z-20 w-32 h-32 cursor-grab active:cursor-grabbing rounded-full ${className}`}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
          lastMousePos.current = { x: e.clientX, y: e.clientY };
        }}
        aria-label="3D Compass"
      />
    );
  }
);
Compass.displayName = "Compass";
