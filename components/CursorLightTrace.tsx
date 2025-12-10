import React, { useEffect, useRef } from 'react';

const CursorLightTrace: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    
    // Initial center (start at center of screen)
    mouseRef.current = { x: width / 2, y: height / 2 };

    const handleResize = () => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
        mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    handleResize();

    // Configuration
    const numStars = 150;
    const speed = 12; // Speed of incoming light
    const focalLength = 150; // Controls the "zoom" feel
    const stars: { x: number, y: number, z: number }[] = [];
    
    // Initialize stars with random positions
    for(let i=0; i<numStars; i++) {
        stars.push({
            x: Math.random() * width * 4 - width * 2, // Wider spread to cover corners when moving mouse
            y: Math.random() * height * 4 - height * 2,
            z: Math.random() * width
        });
    }

    let animationFrameId: number;

    const animate = () => {
        ctx.clearRect(0, 0, width, height);

        // Center point follows cursor
        const cx = mouseRef.current.x;
        const cy = mouseRef.current.y;

        stars.forEach(star => {
            // Move star towards camera (decrease Z)
            star.z -= speed;

            // Reset if passed camera
            if (star.z <= 0) {
                star.x = Math.random() * width * 4 - width * 2;
                star.y = Math.random() * height * 4 - height * 2;
                star.z = width;
            }

            // Calculate current 2D position based on perspective projection
            const x = (star.x / star.z) * focalLength + cx;
            const y = (star.y / star.z) * focalLength + cy;

            // Calculate tail position (where it was previously/further back)
            // Use a multiplier for tail length
            const tailZ = star.z + 80; 
            const tailX = (star.x / tailZ) * focalLength + cx;
            const tailY = (star.y / tailZ) * focalLength + cy;

            // Only draw if within reasonable bounds (optimization)
            if (x >= -50 && x <= width + 50 && y >= -50 && y <= height + 50) {
                 // Opacity fades as it gets closer to simulate passing by, or fades in from distance
                 // We want them to look like light traces.
                 const alpha = Math.min(1, (1 - star.z / width) * 0.8);
                 const lineWidth = Math.max(0.05, (1 - star.z / width) * 2);

                 const gradient = ctx.createLinearGradient(tailX, tailY, x, y);
                 gradient.addColorStop(0, 'rgba(41, 151, 255, 0)'); // Fade out tail
                 gradient.addColorStop(1, `rgba(255, 255, 255, ${alpha})`); // Bright head

                 ctx.beginPath();
                 ctx.strokeStyle = gradient;
                 ctx.lineWidth = lineWidth;
                 ctx.lineCap = 'round';
                 ctx.moveTo(tailX, tailY);
                 ctx.lineTo(x, y);
                 ctx.stroke();
            }
        });

        animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousemove', handleMouseMove);
        cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen" />;
};

export default CursorLightTrace;