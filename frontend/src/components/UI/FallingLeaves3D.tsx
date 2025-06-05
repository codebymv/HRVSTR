import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface FallingLeaves3DProps {
  width?: number;
  height?: number;
  leafCount?: number;
}

const FallingLeaves3D: React.FC<FallingLeaves3DProps> = ({
  width = 128,
  height = 128,
  leafCount = 6
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animationIdRef = useRef<number>();

  const createLeafShape = () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.5);
    shape.quadraticCurveTo(0.3, 0.3, 0.2, 0);
    shape.quadraticCurveTo(0.3, -0.3, 0, -0.5);
    shape.quadraticCurveTo(-0.3, -0.3, -0.2, 0);
    shape.quadraticCurveTo(-0.3, 0.3, 0, 0.5);
    return new THREE.ShapeGeometry(shape);
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(2, 5, 3);
    scene.add(dirLight);

    // Geometry + Material
    const sharedGeometry = createLeafShape();
    const baseMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      emissive: 0x222222,
      emissiveIntensity: 0.03,
      side: THREE.DoubleSide
    });

    const leaves: Array<{
      mesh: THREE.Mesh;
      fallSpeed: number;
      tumbleAxis: THREE.Vector3;
      phase: number;
      swayStrength: number;
      initialX: number;
      zDepth: number;
    }> = [];

    for (let i = 0; i < leafCount; i++) {
      const leaf = new THREE.Mesh(sharedGeometry.clone(), baseMaterial.clone());
      const size = 0.7 + Math.random() * 0.6;
      const hueShift = 0.02 * (Math.random() - 0.5);
      const color = new THREE.Color().setHSL(0, 0, 0.9 + hueShift);
      (leaf.material as THREE.MeshLambertMaterial).color = color;

      const z = (Math.random() - 0.5) * 1.5;
      leaf.scale.setScalar(size * (1 - Math.abs(z) * 0.2));

      leaf.position.set((Math.random() - 0.5) * 4, 3 + Math.random() * 2, z);
      leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      scene.add(leaf);

      leaves.push({
        mesh: leaf,
        fallSpeed: 0.01 + Math.random() * 0.01,
        tumbleAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        phase: Math.random() * Math.PI * 2,
        swayStrength: 0.3 + Math.random() * 0.4,
        initialX: leaf.position.x,
        zDepth: z
      });
    }

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      const t = Date.now() * 0.001;

      for (const leaf of leaves) {
        const { mesh, fallSpeed, tumbleAxis, phase, swayStrength, initialX } = leaf;

        const yFlutter = Math.sin(t * 2 + phase) * 0.3;
        mesh.position.y -= fallSpeed * (1 + yFlutter);

        const sway = Math.sin(t * 1.5 + phase) * swayStrength;
        mesh.position.x = initialX + sway;

        mesh.position.z += Math.cos(t + phase) * 0.004;

        mesh.rotateOnAxis(tumbleAxis, 0.01);

        if (mesh.position.y < -3.5) {
          mesh.position.y = 3 + Math.random() * 2;
          mesh.position.x = (Math.random() - 0.5) * 4;
          mesh.position.z = (Math.random() - 0.5) * 1.5;
          leaf.initialX = mesh.position.x;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      sharedGeometry.dispose();
      baseMaterial.dispose();
    };
  }, [width, height, leafCount]);

  return (
    <div
      ref={mountRef}
      style={{ width: `${width}px`, height: `${height}px`, display: 'inline-block' }}
    />
  );
};

export default FallingLeaves3D;
