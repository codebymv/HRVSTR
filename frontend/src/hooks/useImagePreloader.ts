import { useState, useEffect } from 'react';

interface UseImagePreloaderOptions {
  images: string[];
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

interface UseImagePreloaderReturn {
  isLoading: boolean;
  imagesLoaded: boolean;
  loadedImages: Set<string>;
  progress: number;
}

export const useImagePreloader = ({
  images,
  onLoad,
  onError
}: UseImagePreloaderOptions): UseImagePreloaderReturn => {
  const [isLoading, setIsLoading] = useState(true);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (images.length === 0) {
      setIsLoading(false);
      setImagesLoaded(true);
      return;
    }

    setIsLoading(true);
    setImagesLoaded(false);
    setLoadedImages(new Set());

    const preloadImages = images.map(src => {
      return new Promise<string>((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
          setLoadedImages(prev => new Set([...prev, src]));
          resolve(src);
        };
        
        img.onerror = () => {
          const error = new Error(`Failed to load image: ${src}`);
          reject(error);
        };
        
        img.src = src;
      });
    });

    Promise.allSettled(preloadImages)
      .then((results) => {
        const successful = results.filter(result => result.status === 'fulfilled').length;
        const failed = results.filter(result => result.status === 'rejected');
        
        if (failed.length > 0) {
          const errors = failed.map(result => 
            result.status === 'rejected' ? result.reason : new Error('Unknown error')
          );
          console.warn('Some images failed to preload:', errors);
          onError?.(new Error(`${failed.length} images failed to load`));
        }
        
        // Add a delay to prevent mobile flash/reload issues
        // This ensures smooth transition between loading and loaded states
        // Longer delay on mobile devices for better stability
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const delay = isMobile ? 200 : 100;
        
        setTimeout(() => {
          setImagesLoaded(successful > 0 || images.length === 0);
          setIsLoading(false);
          onLoad?.();
        }, delay);
      })
      .catch(error => {
        console.error('Critical error during image preloading:', error);
        setImagesLoaded(true); // Fail gracefully
        setIsLoading(false);
        onError?.(error);
      });
  }, [images]); // Removed onLoad and onError from dependencies to prevent infinite loop

  const progress = images.length > 0 ? (loadedImages.size / images.length) * 100 : 100;

  return {
    isLoading,
    imagesLoaded,
    loadedImages,
    progress
  };
}; 