import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

interface FallingLeaves3DProps {
  width?: number;
  height?: number;
  leafCount?: number;
  isPremium?: boolean;
  isLightTheme?: boolean;
}

const FallingLeaves3D: React.FC<FallingLeaves3DProps> = ({
  width = 128,
  height = 128,
  leafCount = 6,
  isPremium = false,
  isLightTheme = false
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animationIdRef = useRef<number>();

  // Create more varied leaf shapes for premium experience
  const createLeafShape = (variation = 0) => {
    const shape = new THREE.Shape();
    
    // Basic leaf shape
    if (variation === 0) {
      shape.moveTo(0, 0.5);
      shape.quadraticCurveTo(0.3, 0.3, 0.2, 0);
      shape.quadraticCurveTo(0.3, -0.3, 0, -0.5);
      shape.quadraticCurveTo(-0.3, -0.3, -0.2, 0);
      shape.quadraticCurveTo(-0.3, 0.3, 0, 0.5);
    } 
    // Elongated leaf
    else if (variation === 1) {
      shape.moveTo(0, 0.6);
      shape.quadraticCurveTo(0.2, 0.4, 0.15, 0.1);
      shape.quadraticCurveTo(0.3, -0.2, 0, -0.6);
      shape.quadraticCurveTo(-0.3, -0.2, -0.15, 0.1);
      shape.quadraticCurveTo(-0.2, 0.4, 0, 0.6);
    }
    // Rounder leaf
    else {
      shape.moveTo(0, 0.45);
      shape.quadraticCurveTo(0.35, 0.25, 0.25, 0);
      shape.quadraticCurveTo(0.35, -0.25, 0, -0.45);
      shape.quadraticCurveTo(-0.35, -0.25, -0.25, 0);
      shape.quadraticCurveTo(-0.35, 0.25, 0, 0.45);
    }
    
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

    // Enhanced lighting for premium feel
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 5, 3);
    scene.add(dirLight);
    
    // Add subtle point light for highlights
    const pointLight = new THREE.PointLight(0x4477ff, 0.2, 10);
    pointLight.position.set(0, 2, 2);
    scene.add(pointLight);

    // Create leaf geometries with variations
    const leafGeometries = [
      createLeafShape(0),
      createLeafShape(1),
      createLeafShape(2)
    ];

    // Base material with premium settings
    const baseMaterial = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity: 0.95, // Further increased opacity for better visibility
      emissive: 0x333333,
      emissiveIntensity: 0.08, // Increased emissive intensity for subtle glow
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
      rotationSpeed: number;
    }> = [];

    // Create more dynamic field of leaves
    for (let i = 0; i < leafCount; i++) {
      // Randomly select geometry variation
      const geometryIndex = Math.floor(Math.random() * leafGeometries.length);
      const leafGeometry = leafGeometries[geometryIndex];
      
      const leaf = new THREE.Mesh(leafGeometry.clone(), baseMaterial.clone());
      // Smaller leaf size
      const size = 0.5 + Math.random() * 0.4;

      // Enhanced color palette - subtle blue-green-teal gradient for premium look
      let hue, saturation, lightness;
      if (isPremium) {
        // Premium leaves have a blue-teal palette
        hue = 180 + Math.random() * 40; // 180-220 (blue to teal range)
        saturation = 60 + Math.random() * 30; // 60-90% - more vibrant colors for better visibility
        
        // Adjust lightness based on theme for better contrast
        if (isLightTheme) {
          lightness = 30 + Math.random() * 30; // 30-60%, better contrast for light theme
        } else {
          lightness = 50 + Math.random() * 35; // 50-85%, brighter for dark theme
        }
      } else {
        // Default leaves are green
        hue = 80 + Math.random() * 40; // 80-120 (green range)
        saturation = 55 + Math.random() * 35; // 55-90% - more vibrant colors for better visibility
        
        // Adjust lightness based on theme for better contrast
        if (isLightTheme) {
          lightness = 30 + Math.random() * 25; // 30-55%, better contrast for light theme
        } else {
          lightness = 45 + Math.random() * 35; // 45-80%, brighter for dark theme
        }
      }
      
      const color = new THREE.Color().setHSL(hue, saturation, lightness);
      (leaf.material as THREE.MeshLambertMaterial).color = color;

      // More distributed z-depth for parallax effect
      const z = (Math.random() - 0.5) * 3;
      leaf.scale.setScalar(size * (1 - Math.abs(z) * 0.2));

      // Wider distribution horizontally and vertically
      const spreadFactor = width > 400 ? 6 : 4;
      leaf.position.set(
        (Math.random() - 0.5) * spreadFactor, 
        3 + Math.random() * 4, 
        z
      );
      
      leaf.rotation.set(
        Math.random() * Math.PI, 
        Math.random() * Math.PI, 
        Math.random() * Math.PI
      );

      scene.add(leaf);

      leaves.push({
        mesh: leaf,
        fallSpeed: 0.005 + Math.random() * 0.01, // Slightly slower for elegance
        tumbleAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        phase: Math.random() * Math.PI * 2,
        swayStrength: 0.3 + Math.random() * 0.4,
        initialX: leaf.position.x,
        zDepth: z,
        rotationSpeed: 0.005 + Math.random() * 0.01 // Variable rotation speed
      });
    }

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      const t = Date.now() * 0.0005; // Slower time factor for more elegant motion

      // Subtle movement for point light to create dynamic lighting
      pointLight.position.x = Math.sin(t * 0.5) * 2;
      pointLight.position.z = Math.cos(t * 0.5) * 2 + 3;

      for (const leaf of leaves) {
        const { mesh, fallSpeed, tumbleAxis, phase, swayStrength, initialX, rotationSpeed, zDepth } = leaf;

        // More complex vertical motion with multiple sine waves
        const yFlutter = 
          Math.sin(t * 2 + phase) * 0.3 + 
          Math.sin(t * 3.7 + phase * 2) * 0.1;
          
        mesh.position.y -= fallSpeed * (1 + yFlutter);

        // Enhanced horizontal sway with dual frequency
        const sway = 
          Math.sin(t * 1.2 + phase) * swayStrength + 
          Math.sin(t * 2.3 + phase * 0.7) * (swayStrength * 0.3);
          
        mesh.position.x = initialX + sway;

        // Z-axis motion for depth
        mesh.position.z += Math.cos(t + phase) * 0.002;

        // Variable rotation speed based on z position (parallax)
        mesh.rotateOnAxis(tumbleAxis, rotationSpeed * (1 - Math.abs(zDepth) * 0.1));

        // Reset position when leaf falls below view
        if (mesh.position.y < -3.5) {
          const spreadFactor = width > 400 ? 6 : 4;
          mesh.position.y = 4 + Math.random() * 3;
          mesh.position.x = (Math.random() - 0.5) * spreadFactor;
          mesh.position.z = (Math.random() - 0.5) * 3;
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
      // Clean up all resources
      renderer.dispose();
      leafGeometries.forEach(geometry => geometry.dispose());
      baseMaterial.dispose();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });
    };
  }, [width, height, leafCount, isPremium]);

  return (
    <div
      ref={mountRef}
      style={{ width: `${width}px`, height: `${height}px`, display: 'inline-block' }}
    />
  );
};

export default FallingLeaves3D;
