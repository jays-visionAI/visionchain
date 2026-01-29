import { createSignal, onMount, onCleanup, Show, Switch, Match } from 'solid-js';
import ApexCharts from 'apexcharts';

export interface ChartData {
    type: 'line' | 'bar' | 'pie' | 'donut' | 'area' | 'radar' | 'radialBar' | 'heatmap' | 'treemap';
    title?: string;
    subtitle?: string;
    labels?: string[];
    series: any[];
    height?: number;
    colors?: string[];
    options?: any;
}

interface VisionChartProps {
    data: ChartData;
}

// Premium color palette
const DEFAULT_COLORS = [
    '#00E396', '#008FFB', '#FEB019', '#FF4560', '#775DD0',
    '#3F51B5', '#03A9F4', '#4CAF50', '#F9CE1D', '#FF9800'
];

export function VisionChart(props: VisionChartProps) {
    let chartRef: HTMLDivElement | undefined;
    let chartInstance: ApexCharts | null = null;

    const buildOptions = () => {
        const data = props.data;
        const isPieType = ['pie', 'donut', 'radialBar'].includes(data.type);

        const baseOptions: ApexCharts.ApexOptions = {
            chart: {
                type: data.type,
                height: data.height || 280,
                background: 'transparent',
                toolbar: { show: false },
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800,
                    animateGradually: { enabled: true, delay: 150 },
                    dynamicAnimation: { enabled: true, speed: 350 }
                },
                dropShadow: {
                    enabled: true,
                    color: '#000',
                    top: 8,
                    left: 0,
                    blur: 10,
                    opacity: 0.2
                }
            },
            colors: data.colors || DEFAULT_COLORS,
            theme: { mode: 'dark' },
            title: data.title ? {
                text: data.title,
                align: 'left',
                style: { fontSize: '16px', fontWeight: 700, color: '#fff' }
            } : undefined,
            subtitle: data.subtitle ? {
                text: data.subtitle,
                align: 'left',
                style: { fontSize: '12px', color: '#9ca3af' }
            } : undefined,
            grid: {
                borderColor: 'rgba(255,255,255,0.1)',
                strokeDashArray: 4
            },
            stroke: {
                curve: 'smooth',
                width: data.type === 'area' ? 2 : 3
            },
            fill: data.type === 'area' ? {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.4,
                    opacityTo: 0.1,
                    stops: [0, 90, 100]
                }
            } : undefined,
            dataLabels: {
                enabled: isPieType,
                style: { fontSize: '12px', fontWeight: 600 }
            },
            legend: {
                show: true,
                position: isPieType ? 'bottom' : 'top',
                horizontalAlign: 'left',
                labels: { colors: '#9ca3af' }
            },
            tooltip: {
                theme: 'dark',
                style: { fontSize: '12px' }
            },
            xaxis: !isPieType && data.labels ? {
                categories: data.labels,
                labels: { style: { colors: '#9ca3af', fontSize: '11px' } },
                axisBorder: { color: 'rgba(255,255,255,0.1)' },
                axisTicks: { color: 'rgba(255,255,255,0.1)' }
            } : undefined,
            yaxis: !isPieType ? {
                labels: {
                    style: { colors: '#9ca3af', fontSize: '11px' },
                    formatter: (val: number) => {
                        if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
                        if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
                        return val.toFixed(2);
                    }
                }
            } : undefined,
            plotOptions: {
                pie: {
                    donut: {
                        size: data.type === 'donut' ? '65%' : '0%',
                        labels: {
                            show: data.type === 'donut',
                            name: { show: true, fontSize: '14px', color: '#fff' },
                            value: { show: true, fontSize: '20px', color: '#00E396', fontWeight: 700 },
                            total: {
                                show: true,
                                label: 'Total',
                                color: '#9ca3af',
                                formatter: (w: any) => {
                                    return w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0).toLocaleString();
                                }
                            }
                        }
                    }
                },
                bar: {
                    borderRadius: 4,
                    distributed: data.series.length === 1,
                    dataLabels: { position: 'top' }
                },
                radialBar: {
                    hollow: { size: '50%' },
                    track: { background: 'rgba(255,255,255,0.1)' },
                    dataLabels: {
                        name: { fontSize: '14px', color: '#9ca3af' },
                        value: { fontSize: '24px', color: '#fff', fontWeight: 700 }
                    }
                },
                radar: {
                    polygons: {
                        strokeColors: 'rgba(255,255,255,0.1)',
                        connectorColors: 'rgba(255,255,255,0.1)'
                    }
                }
            },
            ...props.data.options
        };

        // Handle series format based on chart type
        if (isPieType) {
            return {
                ...baseOptions,
                series: data.series,
                labels: data.labels
            };
        }

        return {
            ...baseOptions,
            series: data.series
        };
    };

    onMount(() => {
        if (chartRef) {
            const options = buildOptions();
            chartInstance = new ApexCharts(chartRef, options);
            chartInstance.render();
        }
    });

    onCleanup(() => {
        if (chartInstance) {
            chartInstance.destroy();
        }
    });

    return (
        <div class="vision-chart-container rounded-2xl bg-[#0d0d0f]/80 border border-white/10 p-4 my-3 backdrop-blur-xl">
            <div ref={chartRef} />
        </div>
    );
}

// Parser function to extract chart data from AI response
export function parseChartBlocks(content: string): { text: string; charts: ChartData[] } {
    const charts: ChartData[] = [];
    const chartRegex = /```vision-chart\s*([\s\S]*?)```/g;

    let match;
    let cleanContent = content;

    while ((match = chartRegex.exec(content)) !== null) {
        try {
            const jsonStr = match[1].trim();
            const chartData = JSON.parse(jsonStr) as ChartData;

            // Validate chart data
            if (chartData.type && chartData.series) {
                charts.push(chartData);
            }
        } catch (e) {
            console.warn('[VisionChart] Failed to parse chart data:', e);
        }

        // Remove chart block from content
        cleanContent = cleanContent.replace(match[0], '');
    }

    return { text: cleanContent.trim(), charts };
}

// Quick chart generators for common use cases
export const ChartTemplates = {
    priceHistory: (symbol: string, prices: number[], labels: string[]): ChartData => ({
        type: 'area',
        title: `${symbol} Price History`,
        labels,
        series: [{ name: symbol, data: prices }],
        colors: ['#00E396']
    }),

    portfolioAllocation: (assets: { name: string; value: number }[]): ChartData => ({
        type: 'donut',
        title: 'Portfolio Allocation',
        labels: assets.map(a => a.name),
        series: assets.map(a => a.value)
    }),

    comparison: (title: string, categories: string[], datasets: { name: string; data: number[] }[]): ChartData => ({
        type: 'bar',
        title,
        labels: categories,
        series: datasets
    }),

    performance: (metrics: { label: string; value: number }[]): ChartData => ({
        type: 'radialBar',
        title: 'Performance Metrics',
        labels: metrics.map(m => m.label),
        series: metrics.map(m => m.value)
    }),

    trend: (title: string, dataPoints: { date: string; value: number }[]): ChartData => ({
        type: 'line',
        title,
        labels: dataPoints.map(d => d.date),
        series: [{ name: 'Value', data: dataPoints.map(d => d.value) }]
    })
};
