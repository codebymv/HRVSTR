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
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const animationIdRef = useRef<number>();

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true // Transparent background
    });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // Transparent
    rendererRef.current = renderer;
    
    mountRef.current.appendChild(renderer.domElement);

    // Create leaf geometry (simple diamond/leaf shape)
    const leafGeometry = new THREE.PlaneGeometry(0.2, 0.3);
    const leafMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });

    // Create multiple leaves with random properties
    const leaves: Array<{
      mesh: THREE.Mesh;
      fallSpeed: number;
      rotationSpeed: number;
      swayAmount: number;
      initialX: number;
    }> = [];

    for (let i = 0; i < leafCount; i++) {
      const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
      
      // Random starting positions
      leaf.position.x = (Math.random() - 0.5) * 4;
      leaf.position.y = 3 + Math.random() * 2; // Start above view
      leaf.position.z = (Math.random() - 0.5) * 2;
      
      // Random rotation
      leaf.rotation.z = Math.random() * Math.PI * 2;
      
      scene.add(leaf);
      
      leaves.push({
        mesh: leaf,
        fallSpeed: 0.01 + Math.random() * 0.02, // 0.01 - 0.03
        rotationSpeed: (Math.random() - 0.5) * 0.1,
        swayAmount: 0.5 + Math.random() * 0.5,
        initialX: leaf.position.x
      });
    }

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      
      const time = Date.now() * 0.001;
      
      leaves.forEach((leafData) => {
        const { mesh, fallSpeed, rotationSpeed, swayAmount, initialX } = leafData;
        
        // Fall down
        mesh.position.y -= fallSpeed;
        
        // Gentle swaying motion
        mesh.position.x = initialX + Math.sin(time + mesh.position.y) * swayAmount * 0.3;
        
        // Rotation
        mesh.rotation.z += rotationSpeed;
        
        // Reset leaf when it falls below view
        if (mesh.position.y < -3) {
          mesh.position.y = 3 + Math.random() * 2;
          mesh.position.x = (Math.random() - 0.5) * 4;
          leafData.initialX = mesh.position.x;
        }
      });
      
      renderer.render(scene, camera);
    };

    animate();

    // Cleanup function
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      leafGeometry.dispose();
      leafMaterial.dispose();
    };
  }, [width, height, leafCount]);

  return (
    <div 
      ref={mountRef} 
      style={{ 
        width: `${width}px`, 
        height: `${height}px`,
        display: 'inline-block'
      }} 
    />
  );
};

export default FallingLeaves3D; 