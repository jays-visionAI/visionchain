import { onMount, onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';

const LightSpeedBackground = (): JSX.Element => {
    let canvasRef: HTMLCanvasElement | undefined;

    onMount(() => {
        const canvas = canvasRef;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;

        // Set canvas size
        const setSize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };
        setSize();
        window.addEventListener('resize', setSize);

        // Star properties
        const stars: { x: number, y: number, z: number }[] = [];
        const numStars = 250; // Reduced for performance
        const speed = 12; // Speed of travel (slowed down for smoother effect)
        const focalLength = 300; // FOV

        // Initialize stars
        for (let i = 0; i < numStars; i++) {
            stars.push({
                x: Math.random() * width * 4 - width * 2,
                y: Math.random() * height * 4 - height * 2,
                z: Math.random() * width // Random depth
            });
        }

        let animationFrameId: number;

        const animate = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 1)';
            ctx.clearRect(0, 0, width, height); // Clear frame

            const cx = width / 2;
            const cy = height / 2;

            stars.forEach(star => {
                // Move star towards camera (decrease Z)
                star.z -= speed;

                // Reset if passed camera
                if (star.z <= 0) {
                    star.x = Math.random() * width * 4 - width * 2;
                    star.y = Math.random() * height * 4 - height * 2;
                    star.z = width;
                }

                // Calculate current 2D position
                const x = (star.x / star.z) * focalLength + cx;
                const y = (star.y / star.z) * focalLength + cy;

                // Calculate "tail" position (previous position for streak effect)
                // The factor added to star.z controls the streak length
                const tailZ = star.z + 150;
                const tailX = (star.x / tailZ) * focalLength + cx;
                const tailY = (star.y / tailZ) * focalLength + cy;

                // Only draw if roughly within bounds
                if (x >= -100 && x <= width + 100 && y >= -100 && y <= height + 100) {
                    // Opacity increases as it gets closer
                    const alpha = Math.min(1, (1 - star.z / width) * 1.5);

                    // Thickness increases as it gets closer
                    const lineWidth = Math.max(0.1, (1 - star.z / width) * 3);

                    // Gradient for motion blur trail (fade out tail)
                    const gradient = ctx.createLinearGradient(tailX, tailY, x, y);
                    gradient.addColorStop(0, `rgba(41, 151, 255, 0)`); // Blueish transparent tail
                    gradient.addColorStop(1, `rgba(255, 255, 255, ${alpha})`); // White bright head

                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = lineWidth;
                    ctx.lineCap = 'round';

                    ctx.beginPath();
                    ctx.moveTo(tailX, tailY);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                }
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        onCleanup(() => {
            window.removeEventListener('resize', setSize);
            cancelAnimationFrame(animationFrameId);
        });
    });

    return <canvas ref={canvasRef} class="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen" />;
};

export default LightSpeedBackground;