import React, { useEffect, useRef } from 'react';

const ConstellationEffect: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    
    // Resize handler to fit parent container
    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        width = parent.clientWidth;
        height = parent.clientHeight;
        canvas.width = width;
        canvas.height = height;
      }
    };
    
    window.addEventListener('resize', resize);
    resize();

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Configuration
    // Higher density divisor = fewer particles. 
    // Adjusted for a balance between performance and "busy-ness"
    const particleCount = Math.floor((width * height) / 10000); 
    const connectionDist = 120;
    const mouseInteractionDist = 180;

    interface Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
        size: number;
        baseSize: number;
        pulseAngle: number;
        pulseSpeed: number;
    }

    const particles: Particle[] = [];

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.2, // Increased base velocity for dynamism
        vy: (Math.random() - 0.5) * 1.2,
        size: Math.random() * 2 + 1,
        baseSize: Math.random() * 2 + 1,
        pulseAngle: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03
      });
    }

    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      
      particles.forEach((p, i) => {
        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off walls
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Pulse size and calculate twinkle
        p.pulseAngle += p.pulseSpeed;
        p.size = p.baseSize + Math.sin(p.pulseAngle) * 0.5;

        // Mouse Interaction
        const dx = p.x - mouseRef.current.x;
        const dy = p.y - mouseRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouseInteractionDist) {
            // Repulsion effect: push particles slightly away from cursor
            const force = (mouseInteractionDist - dist) / mouseInteractionDist;
            const angle = Math.atan2(dy, dx);
            const moveX = Math.cos(angle) * force * 2; // Strength of push
            const moveY = Math.sin(angle) * force * 2;
            
            p.x += moveX;
            p.y += moveY;

            // Draw Connection to Mouse
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.strokeStyle = `rgba(59, 130, 246, ${force * 0.6})`; // Blue connection
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw Particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
        // Twinkle opacity
        const opacity = 0.4 + (Math.sin(p.pulseAngle) + 1) * 0.2;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`; 
        ctx.fill();

        // Draw Connections between nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < connectionDist) {
            const opacity = (1 - dist2 / connectionDist) * 0.25;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(200, 200, 255, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      });
      
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

export default ConstellationEffect;