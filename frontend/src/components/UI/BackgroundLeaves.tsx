import React, { useState, useEffect } from 'react';
import FallingLeaves3D from './FallingLeaves3D';

interface BackgroundLeavesProps {
  opacity?: number;
  leafCount?: number;
  isLight?: boolean;
}

const BackgroundLeaves: React.FC<BackgroundLeavesProps> = ({
  opacity = 0.15,
  leafCount = 15,
  isLight = false
}) => {
  const [dimensions, setDimensions] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 1000, 
    height: typeof window !== 'undefined' ? window.innerHeight : 800 
  });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    // Set initial dimensions
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 hidden md:block" style={{ opacity }}>
      <FallingLeaves3D
        width={dimensions.width}
        height={dimensions.height}
        leafCount={leafCount}
        isPremium={true}
        isLightTheme={isLight}
      />
    </div>
  );
};

export default BackgroundLeaves;
