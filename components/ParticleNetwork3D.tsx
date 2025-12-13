import { onMount, onCleanup } from 'solid-js';
import type { JSX } from 'solid-js';

const ParticleNetwork3D = (): JSX.Element => {
    let canvasRef: HTMLCanvasElement | undefined;
    let containerRef: HTMLDivElement | undefined;

    onMount(() => {
        const canvas = canvasRef;
        const container = containerRef;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = container.clientWidth;
        let height = container.clientHeight;

        // Config - Enhanced for Depth
        const particleCount = 180; // Increased count for larger volume
        const connectionDistance = 110;
        const focalLength = 320; // Lower focal length = Stronger 3D perspective distortion
        const sphereRadius = 500; // Larger radius = More depth range

        // Strict White & Grey Palette
        const colors = [
            { r: 255, g: 255, b: 255 }, // White
            { r: 180, g: 180, b: 185 }, // Light Grey
            { r: 100, g: 100, b: 105 }, // Darker Grey
        ];

        interface Point3D {
            x: number;
            y: number;
            z: number;
            baseX: number;
            baseY: number;
            baseZ: number;
            color: { r: number, g: number, b: number };
            size: number;
        }

        let particles: Point3D[] = [];
        let animationFrameId: number;

        // Rotation state
        let rotX = 0;
        let rotY = 0;

        // Interactive Rotation Targets
        let targetRotX = 0;
        let targetRotY = 0;

        const initParticles = () => {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = Math.cbrt(Math.random()) * sphereRadius;

                const x = r * Math.sin(phi) * Math.cos(theta);
                const y = r * Math.sin(phi) * Math.sin(theta);
                const z = r * Math.cos(phi);

                particles.push({
                    x, y, z,
                    baseX: x, baseY: y, baseZ: z,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    // Varying base sizes for texture
                    size: Math.random() * 1.5 + 0.5
                });
            }
        };

        const handleResize = () => {
            if (!container || !canvas) return;
            width = container.clientWidth;
            height = container.clientHeight;
            canvas.width = width;
            canvas.height = height;
        };

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - width / 2) / (width / 2);
            const y = (e.clientY - rect.top - height / 2) / (height / 2);

            targetRotY = x * 0.4;
            targetRotX = y * 0.4;
        };

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);

            // Continuous slow rotation + mouse interaction
            rotY += (targetRotY - rotY) * 0.04 + 0.0015;
            rotX += (targetRotX - rotX) * 0.04;

            const cosY = Math.cos(rotY);
            const sinY = Math.sin(rotY);
            const cosX = Math.cos(rotX);
            const sinX = Math.sin(rotX);

            const projected = particles.map(p => {
                let x1 = p.baseX * cosY - p.baseZ * sinY;
                let z1 = p.baseZ * cosY + p.baseX * sinY;

                let y1 = p.baseY * cosX - z1 * sinX;
                let z2 = z1 * cosX + p.baseY * sinX;

                // Perspective Projection
                const depth = focalLength + z2;
                const scale = focalLength / depth;

                const x2d = x1 * scale + width / 2;
                const y2d = y1 * scale + height / 2;

                return {
                    x3d: x1, y3d: y1, z3d: z2,
                    x2d, y2d, scale,
                    color: p.color,
                    baseSize: p.size
                };
            });

            // Painter's Algorithm: Sort by depth (farthest first)
            projected.sort((a, b) => b.z3d - a.z3d);

            for (let i = 0; i < projected.length; i++) {
                const p1 = projected[i];

                // Render only if in front of camera plane
                if (p1.z3d > -focalLength + 20) {
                    // Alpha fades based on depth (scale) to create "fog" effect
                    // p1.scale is small when far away, large when close
                    const alpha = Math.max(0, Math.min(0.9, (p1.scale - 0.2) * 1.2));

                    if (alpha > 0.05) {
                        // Connections
                        for (let j = i + 1; j < projected.length; j++) {
                            const p2 = projected[j];

                            const dx = p1.x3d - p2.x3d;
                            const dy = p1.y3d - p2.y3d;
                            const dz = p1.z3d - p2.z3d;
                            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                            if (dist < connectionDistance) {
                                // Fainter lines, proportional to particle visibility
                                const linkAlpha = (1 - dist / connectionDistance) * alpha * 0.25;

                                if (linkAlpha > 0.01) {
                                    ctx.beginPath();
                                    ctx.moveTo(p1.x2d, p1.y2d);
                                    ctx.lineTo(p2.x2d, p2.y2d);
                                    ctx.strokeStyle = `rgba(${p1.color.r}, ${p1.color.g}, ${p1.color.b}, ${linkAlpha})`;
                                    ctx.lineWidth = 0.2; // Fine lines
                                    ctx.stroke();
                                }
                            }
                        }

                        // Particles
                        ctx.beginPath();
                        // Draw size scales with perspective
                        const drawSize = Math.max(0.1, p1.baseSize * p1.scale * 0.8);
                        ctx.arc(p1.x2d, p1.y2d, drawSize, 0, Math.PI * 2);

                        ctx.fillStyle = `rgba(${p1.color.r}, ${p1.color.g}, ${p1.color.b}, ${alpha})`;

                        // Subtle Glow Logic - Intensity increases as particles get closer (scale increases)
                        if (p1.scale > 0.6) {
                            ctx.shadowBlur = (p1.scale - 0.6) * 15; // Dynamic blur based on depth
                            ctx.shadowColor = `rgba(${p1.color.r}, ${p1.color.g}, ${p1.color.b}, ${alpha * 0.6})`;
                        } else {
                            ctx.shadowBlur = 0;
                        }

                        ctx.fill();

                        // Reset shadow for next operations (performance)
                        ctx.shadowBlur = 0;
                    }
                }
            }

            animationFrameId = requestAnimationFrame(animate);
        };

        initParticles();
        handleResize();
        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);
        animate();

        onCleanup(() => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        });
    });

    return (
        <div ref={containerRef} class="absolute inset-0 w-full h-full pointer-events-none">
            <canvas ref={canvasRef} class="block w-full h-full" />
        </div>
    );
};

export default ParticleNetwork3D;