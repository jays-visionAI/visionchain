import { createSignal, Show, For, onMount, createMemo } from 'solid-js';
import { Bot, Play, Pause, Settings, Clock, Zap, ArrowUpRight, Shield, RefreshCw, ChevronRight, AlertTriangle, CheckCircle, Trash2, Copy } from 'lucide-solid';

// Agent Gateway API URL - environment-aware
const AGENT_API_URL = (() => {
    if (typeof window !== 'undefined' && window.location.hostname.includes('staging')) {
        return 'https://us-central1-visionchain-staging.cloudfunctions.net/agentGateway';
    }
    return 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';
})();

interface AgentHostingProps {
    walletAddress: () => string;
    userEmail: () => string;
}

interface HostedAgent {
    agent_name: string;
    api_key: string;
    wallet_address: string;
    status: 'active' | 'paused' | 'insufficient_balance' | 'error' | 'setup';
    llm_model: string;
    system_prompt: string;
    trigger_type: string;
    interval_minutes: number;
    allowed_actions: string[];
    total_vcn_spent: number;
    execution_count: number;
    last_execution: string | null;
    vcn_balance: string;
}

// SVG Icons as inline strings to avoid emoji usage
const icons = {
    robot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><rect width="18" height="10" x="3" y="11" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" x2="8" y1="16" y2="16"/><line x1="16" x2="16" y1="16" y2="16"/></svg>`,
    spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364"/></svg>`,
};

// LLM selection is handled by ZYNK AI Router - users don't need to choose

const AVAILABLE_ACTIONS = [
    { id: 'balance', label: 'Check Balance', desc: 'View VCN token balance', icon: '0', risk: 'low' },
    { id: 'transfer', label: 'Transfer VCN', desc: 'Send VCN to addresses', icon: '1', risk: 'high' },
    { id: 'stake', label: 'Stake VCN', desc: 'Stake tokens for rewards', icon: '2', risk: 'medium' },
    { id: 'unstake', label: 'Unstake VCN', desc: 'Request unstaking', icon: '3', risk: 'medium' },
    { id: 'network_info', label: 'Network Info', desc: 'Query chain status', icon: '4', risk: 'low' },
    { id: 'leaderboard', label: 'Leaderboard', desc: 'Check RP rankings', icon: '5', risk: 'low' },
];

const TRIGGER_OPTIONS = [
    { value: 5, label: 'Every 5 min', cost: '~216 VCN/mo' },
    { value: 30, label: 'Every 30 min', cost: '~36 VCN/mo' },
    { value: 60, label: 'Every hour', cost: '~18 VCN/mo' },
    { value: 1440, label: 'Once daily', cost: '~0.75 VCN/mo' },
];

export default function AgentHosting(props: AgentHostingProps) {
    const [activeTab, setActiveTab] = createSignal<'overview' | 'setup' | 'logs'>('overview');
    const [agents, setAgents] = createSignal<HostedAgent[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [setupStep, setSetupStep] = createSignal(1);

    // Setup form state
    const [agentName, setAgentName] = createSignal('');
    const [selectedModel, setSelectedModel] = createSignal('deepseek-chat');
    const [systemPrompt, setSystemPrompt] = createSignal('');
    const [triggerInterval, setTriggerInterval] = createSignal(60);
    const [selectedActions, setSelectedActions] = createSignal<string[]>(['balance', 'network_info']);
    const [maxVcnPerAction, setMaxVcnPerAction] = createSignal(5);
    const [isRegistering, setIsRegistering] = createSignal(false);
    const [registerError, setRegisterError] = createSignal('');
    const [deletingAgent, setDeletingAgent] = createSignal('');
    const [showDeleteConfirm, setShowDeleteConfirm] = createSignal('');

    // Logs
    const [logs, setLogs] = createSignal<any[]>([]);

    const estimatedMonthlyCost = createMemo(() => {
        const interval = triggerInterval();
        const executionsPerMonth = (30 * 24 * 60) / interval;
        const costPerExecution = 0.05; // Minimum tier (read-only)
        return (executionsPerMonth * costPerExecution).toFixed(1);
    });

    onMount(async () => {
        await loadAgents();
    });

    const loadAgents = async () => {
        setLoading(true);
        try {
            // Check localStorage for saved agent API key
            const savedKey = localStorage.getItem('vcn_agent_api_key');
            if (savedKey) {
                const resp = await fetch(AGENT_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'profile', api_key: savedKey }),
                });
                const data = await resp.json();
                if (data.success && data.agent) {
                    setAgents([{
                        agent_name: data.agent.agent_name,
                        api_key: savedKey,
                        wallet_address: data.agent.wallet_address,
                        status: data.agent.hosting?.enabled ? 'active' : 'setup',
                        llm_model: data.agent.hosting?.llm_model || 'deepseek-chat',
                        system_prompt: data.agent.hosting?.system_prompt || '',
                        trigger_type: 'interval',
                        interval_minutes: data.agent.hosting?.trigger?.interval_minutes || 60,
                        allowed_actions: data.agent.hosting?.allowed_actions || [],
                        total_vcn_spent: data.agent.hosting?.total_vcn_spent || 0,
                        execution_count: data.agent.hosting?.execution_count || 0,
                        last_execution: data.agent.hosting?.last_execution || null,
                        vcn_balance: data.agent.balance_vcn || data.agent.balance || '0',
                    }]);
                }
            }
        } catch (err) {
            console.error('[AgentHosting] Failed to load agents:', err);
        }
        setLoading(false);
    };

    const handleRegisterAndSetup = async () => {
        if (!agentName().trim()) return;
        setIsRegistering(true);
        setRegisterError('');

        try {
            const resp = await fetch(AGENT_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'register',
                    agent_name: agentName().trim(),
                    platform: 'visionchain-hosting',
                    owner_email: props.userEmail(),
                }),
            });
            const data = await resp.json();

            if (data.success && data.agent) {
                localStorage.setItem('vcn_agent_api_key', data.agent.api_key);
                setAgents([{
                    agent_name: data.agent.agent_name,
                    api_key: data.agent.api_key,
                    wallet_address: data.agent.wallet_address,
                    status: 'setup',
                    llm_model: 'deepseek-chat',
                    system_prompt: '',
                    trigger_type: 'interval',
                    interval_minutes: 60,
                    allowed_actions: [],
                    total_vcn_spent: 0,
                    execution_count: 0,
                    last_execution: null,
                    vcn_balance: '100',
                }]);
                setSetupStep(2); // Skip to behavior config (was step 3)
            } else {
                setRegisterError(data.error || 'Registration failed');
            }
        } catch (err: any) {
            setRegisterError(err.message || 'Network error');
        }
        setIsRegistering(false);
    };

    const toggleAction = (actionId: string) => {
        const current = selectedActions();
        if (current.includes(actionId)) {
            setSelectedActions(current.filter(a => a !== actionId));
        } else {
            setSelectedActions([...current, actionId]);
        }
    };

    const handleStartAgent = async () => {
        const agent = agents()[0];
        if (!agent) return;

        try {
            // Save hosting configuration
            const resp = await fetch(AGENT_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'configure_hosting',
                    api_key: agent.api_key,
                    llm_model: selectedModel(),
                    system_prompt: systemPrompt(),
                    trigger: {
                        type: 'interval',
                        interval_minutes: triggerInterval(),
                    },
                    allowed_actions: selectedActions(),
                    max_vcn_per_action: maxVcnPerAction(),
                }),
            });
            const configData = await resp.json();
            if (configData.success) {
                // Also toggle hosting on
                await fetch(AGENT_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'toggle_hosting',
                        api_key: agent.api_key,
                        enabled: true,
                    }),
                });
                setAgents(prev => prev.map(a =>
                    a.agent_name === agent.agent_name
                        ? { ...a, status: 'active', llm_model: selectedModel(), system_prompt: systemPrompt(), interval_minutes: triggerInterval(), allowed_actions: selectedActions() }
                        : a
                ));
                setActiveTab('overview');
            }
        } catch (err) {
            console.error('[AgentHosting] Failed to start agent:', err);
        }
    };

    const handleToggleAgent = async (agentName: string, currentStatus: string) => {
        const agent = agents().find(a => a.agent_name === agentName);
        if (!agent) return;

        const newStatus = currentStatus === 'active' ? 'paused' : 'active';
        try {
            await fetch(AGENT_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'toggle_hosting',
                    api_key: agent.api_key,
                    enabled: newStatus === 'active',
                }),
            });
            setAgents(prev => prev.map(a =>
                a.agent_name === agentName ? { ...a, status: newStatus as any } : a
            ));
        } catch (err) {
            console.error('[AgentHosting] Toggle failed:', err);
        }
    };

    const handleDeleteAgent = async (agentName: string) => {
        const agent = agents().find(a => a.agent_name === agentName);
        if (!agent) return;

        setDeletingAgent(agentName);
        try {
            const resp = await fetch(AGENT_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete_agent',
                    api_key: agent.api_key,
                }),
            });
            const data = await resp.json();
            if (data.success) {
                setAgents(agents().filter(a => a.agent_name !== agentName));
                localStorage.removeItem('vcn_agent_api_key');
                setShowDeleteConfirm('');
                setSetupStep(1);
            }
        } catch (err) {
            console.error('[AgentHosting] Delete failed:', err);
        }
        setDeletingAgent('');
    };

    const loadLogs = async () => {
        const agent = agents()[0];
        if (!agent) return;

        try {
            const resp = await fetch(AGENT_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'hosting_logs',
                    api_key: agent.api_key,
                    limit: 50,
                }),
            });
            const data = await resp.json();
            if (data.success && data.logs) {
                setLogs(data.logs);
            }
        } catch (err) {
            console.error('[AgentHosting] Failed to load logs:', err);
        }
    };

    return (
        <div class="agent-hosting">
            <style>{`
                .agent-hosting {
                    padding: 24px;
                    max-width: 900px;
                    margin: 0 auto;
                    color: #e2e8f0;
                }
                .ah-header {
                    margin-bottom: 32px;
                }
                .ah-title {
                    font-size: 28px;
                    font-weight: 900;
                    color: white;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .ah-subtitle {
                    font-size: 14px;
                    color: #94a3b8;
                    line-height: 1.6;
                }
                .ah-tabs {
                    display: flex;
                    gap: 4px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 12px;
                    padding: 4px;
                    margin-bottom: 24px;
                    border: 1px solid rgba(255,255,255,0.06);
                }
                .ah-tab {
                    flex: 1;
                    padding: 10px 16px;
                    border-radius: 8px;
                    border: none;
                    background: transparent;
                    color: #94a3b8;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                .ah-tab.active {
                    background: rgba(6,182,212,0.15);
                    color: #22d3ee;
                    box-shadow: 0 0 20px rgba(6,182,212,0.1);
                }
                .ah-tab:hover:not(.active) {
                    background: rgba(255,255,255,0.04);
                    color: white;
                }
                .ah-card {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 16px;
                    padding: 24px;
                    margin-bottom: 16px;
                    transition: all 0.3s;
                }
                .ah-card:hover {
                    border-color: rgba(6,182,212,0.2);
                }
                .ah-card-title {
                    font-size: 16px;
                    font-weight: 700;
                    color: white;
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .ah-empty-state {
                    text-align: center;
                    padding: 60px 24px;
                }
                .ah-empty-icon {
                    width: 80px;
                    height: 80px;
                    border-radius: 24px;
                    background: linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.1));
                    border: 1px solid rgba(6,182,212,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                }
                .ah-empty-title {
                    font-size: 22px;
                    font-weight: 800;
                    color: white;
                    margin-bottom: 8px;
                }
                .ah-empty-desc {
                    font-size: 14px;
                    color: #94a3b8;
                    max-width: 400px;
                    margin: 0 auto 32px;
                    line-height: 1.6;
                }
                .ah-btn-primary {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #06b6d4, #3b82f6);
                    border: none;
                    border-radius: 12px;
                    color: white;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.3s;
                    box-shadow: 0 4px 20px rgba(6,182,212,0.3);
                }
                .ah-btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 30px rgba(6,182,212,0.4);
                }
                .ah-btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }
                .ah-input {
                    width: 100%;
                    padding: 12px 16px;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 10px;
                    color: white;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                }
                .ah-input:focus {
                    border-color: rgba(6,182,212,0.5);
                }
                .ah-textarea {
                    width: 100%;
                    min-height: 120px;
                    padding: 12px 16px;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 10px;
                    color: white;
                    font-size: 13px;
                    font-family: 'SF Mono', 'Fira Code', monospace;
                    line-height: 1.6;
                    outline: none;
                    resize: vertical;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                }
                .ah-textarea:focus {
                    border-color: rgba(6,182,212,0.5);
                }
                .ah-label {
                    display: block;
                    font-size: 12px;
                    font-weight: 600;
                    color: #94a3b8;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .ah-model-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 12px;
                }
                .ah-model-card {
                    padding: 16px;
                    background: rgba(0,0,0,0.2);
                    border: 2px solid rgba(255,255,255,0.06);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .ah-model-card.selected {
                    border-color: #06b6d4;
                    background: rgba(6,182,212,0.08);
                }
                .ah-model-card:hover:not(.selected) {
                    border-color: rgba(255,255,255,0.15);
                }
                .ah-model-name {
                    font-size: 14px;
                    font-weight: 700;
                    color: white;
                    margin-bottom: 4px;
                }
                .ah-model-meta {
                    font-size: 11px;
                    color: #64748b;
                }
                .ah-action-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: 8px;
                }
                .ah-action-chip {
                    padding: 10px 14px;
                    background: rgba(0,0,0,0.2);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .ah-action-chip.selected {
                    border-color: #06b6d4;
                    background: rgba(6,182,212,0.1);
                }
                .ah-action-chip:hover:not(.selected) {
                    border-color: rgba(255,255,255,0.12);
                }
                .ah-action-label {
                    font-size: 12px;
                    font-weight: 600;
                    color: white;
                }
                .ah-action-desc {
                    font-size: 10px;
                    color: #64748b;
                }
                .ah-trigger-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 8px;
                }
                .ah-trigger-card {
                    padding: 12px 16px;
                    background: rgba(0,0,0,0.2);
                    border: 2px solid rgba(255,255,255,0.06);
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                }
                .ah-trigger-card.selected {
                    border-color: #06b6d4;
                    background: rgba(6,182,212,0.08);
                }
                .ah-trigger-label {
                    font-size: 13px;
                    font-weight: 600;
                    color: white;
                }
                .ah-trigger-cost {
                    font-size: 10px;
                    color: #64748b;
                    margin-top: 4px;
                }
                .ah-agent-card {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 16px;
                    padding: 20px;
                    margin-bottom: 12px;
                }
                .ah-agent-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 16px;
                }
                .ah-agent-name {
                    font-size: 18px;
                    font-weight: 800;
                    color: white;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .ah-status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 10px;
                    border-radius: 8px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .ah-status-active {
                    background: rgba(16,185,129,0.15);
                    color: #34d399;
                    border: 1px solid rgba(16,185,129,0.3);
                }
                .ah-status-paused {
                    background: rgba(245,158,11,0.15);
                    color: #fbbf24;
                    border: 1px solid rgba(245,158,11,0.3);
                }
                .ah-status-setup {
                    background: rgba(99,102,241,0.15);
                    color: #818cf8;
                    border: 1px solid rgba(99,102,241,0.3);
                }
                .ah-status-error {
                    background: rgba(239,68,68,0.15);
                    color: #f87171;
                    border: 1px solid rgba(239,68,68,0.3);
                }
                .ah-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                }
                @media (max-width: 640px) {
                    .ah-stats-grid { grid-template-columns: repeat(2, 1fr); }
                    .ah-trigger-grid { grid-template-columns: 1fr; }
                    .ah-action-grid { grid-template-columns: 1fr; }
                }
                .ah-stat {
                    background: rgba(0,0,0,0.2);
                    border: 1px solid rgba(255,255,255,0.04);
                    border-radius: 12px;
                    padding: 14px;
                    text-align: center;
                }
                .ah-stat-value {
                    font-size: 20px;
                    font-weight: 800;
                    color: white;
                }
                .ah-stat-label {
                    font-size: 10px;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-top: 4px;
                }
                .ah-toggle-btn {
                    padding: 8px 16px;
                    border-radius: 10px;
                    border: none;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .ah-toggle-active {
                    background: rgba(245,158,11,0.15);
                    color: #fbbf24;
                    border: 1px solid rgba(245,158,11,0.3);
                }
                .ah-toggle-paused {
                    background: rgba(16,185,129,0.15);
                    color: #34d399;
                    border: 1px solid rgba(16,185,129,0.3);
                }
                .ah-cost-banner {
                    background: linear-gradient(135deg, rgba(6,182,212,0.1), rgba(59,130,246,0.05));
                    border: 1px solid rgba(6,182,212,0.2);
                    border-radius: 12px;
                    padding: 16px 20px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-top: 20px;
                }
                .ah-cost-label {
                    font-size: 12px;
                    color: #94a3b8;
                    font-weight: 600;
                }
                .ah-cost-value {
                    font-size: 24px;
                    font-weight: 900;
                    color: #22d3ee;
                }
                .ah-cost-unit {
                    font-size: 12px;
                    color: #64748b;
                    margin-left: 4px;
                }
                .ah-step-indicator {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 24px;
                }
                .ah-step-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.1);
                    transition: all 0.3s;
                }
                .ah-step-dot.active {
                    background: #06b6d4;
                    box-shadow: 0 0 10px rgba(6,182,212,0.5);
                }
                .ah-step-dot.done {
                    background: #34d399;
                }
                .ah-fee-breakdown {
                    margin-top: 16px;
                    padding: 16px;
                    background: rgba(0,0,0,0.2);
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.04);
                }
                .ah-fee-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 6px 0;
                    font-size: 12px;
                }
                .ah-fee-label {
                    color: #94a3b8;
                }
                .ah-fee-value {
                    color: white;
                    font-weight: 600;
                }
                .ah-fee-divider {
                    border-top: 1px solid rgba(255,255,255,0.06);
                    margin: 8px 0;
                }
                .ah-error {
                    background: rgba(239,68,68,0.1);
                    border: 1px solid rgba(239,68,68,0.3);
                    border-radius: 10px;
                    padding: 10px 14px;
                    color: #f87171;
                    font-size: 13px;
                    margin-top: 12px;
                }
                .ah-log-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 14px 16px;
                    background: rgba(0,0,0,0.15);
                    border-radius: 10px;
                    margin-bottom: 8px;
                    border: 1px solid rgba(255,255,255,0.04);
                }
                .ah-log-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    margin-top: 5px;
                    flex-shrink: 0;
                }
                .ah-log-success { background: #34d399; }
                .ah-log-error { background: #f87171; }
                .ah-log-time {
                    font-size: 10px;
                    color: #64748b;
                    font-family: monospace;
                }
                .ah-log-msg {
                    font-size: 12px;
                    color: #e2e8f0;
                    margin-top: 2px;
                }
                .ah-log-cost {
                    margin-left: auto;
                    font-size: 11px;
                    color: #fbbf24;
                    font-weight: 600;
                    white-space: nowrap;
                }
            `}</style>

            {/* Header */}
            <div class="ah-header">
                <h1 class="ah-title">
                    <Bot class="w-7 h-7 text-cyan-400" />
                    Agent Hosting
                </h1>
                <p class="ah-subtitle">
                    Create autonomous AI agents that run on Vision Chain's infrastructure.
                    No server needed -- powered by VCN tokens.
                </p>
            </div>

            {/* Tabs */}
            <div class="ah-tabs">
                <button
                    class={`ah-tab ${activeTab() === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    <Bot class="w-4 h-4" /> My Agents
                </button>
                <button
                    class={`ah-tab ${activeTab() === 'setup' ? 'active' : ''}`}
                    onClick={() => setActiveTab('setup')}
                >
                    <Settings class="w-4 h-4" /> Setup
                </button>
                <button
                    class={`ah-tab ${activeTab() === 'logs' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('logs'); loadLogs(); }}
                >
                    <Clock class="w-4 h-4" /> Logs
                </button>
            </div>

            {/* Overview Tab */}
            <Show when={activeTab() === 'overview'}>
                <Show when={loading()}>
                    <div class="ah-card" style="text-align: center; padding: 40px;">
                        <RefreshCw class="w-6 h-6 text-cyan-400 animate-spin" style="margin: 0 auto 12px;" />
                        <p style="color: #94a3b8; font-size: 13px;">Loading agents...</p>
                    </div>
                </Show>

                <Show when={!loading() && agents().length === 0}>
                    <div class="ah-card ah-empty-state">
                        <div class="ah-empty-icon">
                            <Bot class="w-10 h-10 text-cyan-400" />
                        </div>
                        <h2 class="ah-empty-title">No Agents Yet</h2>
                        <p class="ah-empty-desc">
                            Deploy your first autonomous AI agent on Vision Chain.
                            It runs 24/7, makes decisions, and executes on-chain actions -- all powered by VCN.
                        </p>
                        <button class="ah-btn-primary" onClick={() => setActiveTab('setup')}>
                            <Zap class="w-4 h-4" /> Create Agent
                        </button>

                        {/* Pricing Info */}
                        <div class="ah-fee-breakdown" style="max-width: 380px; margin: 24px auto 0;">
                            <div class="ah-fee-row">
                                <span class="ah-fee-label">Read-only (balance, network, leaderboard)</span>
                                <span class="ah-fee-value">0.05 VCN</span>
                            </div>
                            <div class="ah-fee-row">
                                <span class="ah-fee-label">Medium (transactions query)</span>
                                <span class="ah-fee-value">0.1 VCN</span>
                            </div>
                            <div class="ah-fee-row">
                                <span class="ah-fee-label">On-chain write (transfer, stake, unstake)</span>
                                <span class="ah-fee-value">0.5 VCN</span>
                            </div>
                            <div class="ah-fee-divider" />
                            <div class="ah-fee-row">
                                <span class="ah-fee-label">Initial funding</span>
                                <span class="ah-fee-value" style="color: #34d399;">100 VCN FREE</span>
                            </div>
                        </div>
                    </div>
                </Show>

                <Show when={!loading() && agents().length > 0}>
                    <For each={agents()}>
                        {(agent) => {
                            const successRate = () => agent.execution_count > 0 ? Math.round(((agent.execution_count - (agent as any).error_count || 0) / agent.execution_count) * 100) : 0;
                            const lastExecAgo = () => {
                                if (!agent.last_execution) return 'Never';
                                const diff = Date.now() - new Date(agent.last_execution).getTime();
                                if (diff < 60000) return 'Just now';
                                if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                                if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                                return `${Math.floor(diff / 86400000)}d ago`;
                            };
                            const balancePercent = () => Math.min(100, (parseFloat(agent.vcn_balance) / 100) * 100);
                            const balanceColor = () => {
                                const bal = parseFloat(agent.vcn_balance);
                                if (bal > 20) return '#34d399';
                                if (bal > 5) return '#fbbf24';
                                return '#f87171';
                            };

                            return (
                                <div class="ah-agent-card">
                                    <div class="ah-agent-header">
                                        <div class="ah-agent-name">
                                            <Bot class="w-5 h-5 text-cyan-400" />
                                            {agent.agent_name}
                                            <span class={`ah-status-badge ah-status-${agent.status}`}>
                                                {agent.status === 'active' && <><Play class="w-3 h-3" /> Running</>}
                                                {agent.status === 'paused' && <><Pause class="w-3 h-3" /> Paused</>}
                                                {agent.status === 'setup' && <><Settings class="w-3 h-3" /> Setup</>}
                                                {agent.status === 'error' && <><AlertTriangle class="w-3 h-3" /> Error</>}
                                                {agent.status === 'insufficient_balance' && <><AlertTriangle class="w-3 h-3" /> Low Balance</>}
                                            </span>
                                        </div>
                                        <Show when={agent.status !== 'setup'}>
                                            <button
                                                class={`ah-toggle-btn ${agent.status === 'active' ? 'ah-toggle-active' : 'ah-toggle-paused'}`}
                                                onClick={() => handleToggleAgent(agent.agent_name, agent.status)}
                                            >
                                                {agent.status === 'active' ? <><Pause class="w-3.5 h-3.5" /> Pause</> : <><Play class="w-3.5 h-3.5" /> Start</>}
                                            </button>
                                        </Show>
                                        <Show when={agent.status === 'setup'}>
                                            <button class="ah-btn-primary" style="padding: 8px 16px; font-size: 12px;" onClick={() => { setSetupStep(2); setActiveTab('setup'); }}>
                                                <Settings class="w-3.5 h-3.5" /> Configure
                                            </button>
                                        </Show>
                                    </div>

                                    {/* Wallet Address */}
                                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px; padding: 8px 12px; background: rgba(6,182,212,0.05); border: 1px solid rgba(6,182,212,0.15); border-radius: 8px;">
                                        <span style="font-size: 11px; color: #64748b; white-space: nowrap;">Wallet:</span>
                                        <span style="font-size: 11px; color: #e2e8f0; font-family: monospace; overflow: hidden; text-overflow: ellipsis;">
                                            {agent.wallet_address}
                                        </span>
                                        <button
                                            style="flex-shrink: 0; background: none; border: none; cursor: pointer; padding: 2px; color: #64748b;"
                                            onClick={() => { navigator.clipboard.writeText(agent.wallet_address); }}
                                            title="Copy address"
                                        >
                                            <Copy class="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {/* VCN Balance Bar */}
                                    <div style="margin-bottom: 16px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                            <span style="font-size: 12px; color: #94a3b8; font-weight: 600;">VCN Balance</span>
                                            <span style={`font-size: 14px; font-weight: 800; color: ${balanceColor()};`}>{parseFloat(agent.vcn_balance).toFixed(2)} VCN</span>
                                        </div>
                                        <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
                                            <div style={`height: 100%; width: ${balancePercent()}%; background: ${balanceColor()}; border-radius: 3px; transition: width 0.5s ease;`} />
                                        </div>
                                    </div>

                                    <div class="ah-stats-grid">
                                        <div class="ah-stat">
                                            <div class="ah-stat-value">{agent.execution_count}</div>
                                            <div class="ah-stat-label">Executions</div>
                                        </div>
                                        <div class="ah-stat">
                                            <div class="ah-stat-value">{agent.total_vcn_spent.toFixed(1)}</div>
                                            <div class="ah-stat-label">VCN Spent</div>
                                        </div>
                                        <div class="ah-stat">
                                            <div class="ah-stat-value" style="color: #34d399;">{successRate()}%</div>
                                            <div class="ah-stat-label">Success Rate</div>
                                        </div>
                                        <div class="ah-stat">
                                            <div class="ah-stat-value" style="font-size: 14px;">{lastExecAgo()}</div>
                                            <div class="ah-stat-label">Last Run</div>
                                        </div>
                                    </div>

                                    {/* Configuration Summary */}
                                    <Show when={agent.status !== 'setup'}>
                                        <div style="margin-top: 16px; padding: 16px; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid rgba(255,255,255,0.04);">
                                            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;">Configuration</div>
                                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                                <div style="font-size: 12px;">
                                                    <span style="color: #64748b;">AI: </span>
                                                    <span style="color: #e2e8f0; font-weight: 600;">ZYNK AI</span>
                                                </div>
                                                <div style="font-size: 12px;">
                                                    <span style="color: #64748b;">Schedule: </span>
                                                    <span style="color: #e2e8f0; font-weight: 600;">Every {agent.interval_minutes}min</span>
                                                </div>
                                                <div style="font-size: 12px; grid-column: span 2;">
                                                    <span style="color: #64748b;">Actions: </span>
                                                    <span style="color: #e2e8f0; font-weight: 600;">
                                                        {agent.allowed_actions.length > 0 ? agent.allowed_actions.join(', ') : 'None configured'}
                                                    </span>
                                                </div>
                                                <Show when={agent.system_prompt}>
                                                    <div style="font-size: 12px; grid-column: span 2;">
                                                        <span style="color: #64748b;">Prompt: </span>
                                                        <span style="color: #94a3b8; font-style: italic;">
                                                            {agent.system_prompt.length > 80 ? agent.system_prompt.substring(0, 80) + '...' : agent.system_prompt}
                                                        </span>
                                                    </div>
                                                </Show>
                                            </div>
                                            <div style="display: flex; gap: 8px; margin-top: 12px;">
                                                <button
                                                    style="padding: 6px 12px; background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.2); border-radius: 8px; color: #22d3ee; font-size: 11px; font-weight: 600; cursor: pointer;"
                                                    onClick={() => { setSetupStep(2); setActiveTab('setup'); setSelectedModel(agent.llm_model); setSystemPrompt(agent.system_prompt); setSelectedActions(agent.allowed_actions); setTriggerInterval(agent.interval_minutes); }}
                                                >
                                                    <Settings class="w-3 h-3" style="display: inline; vertical-align: middle; margin-right: 4px;" /> Edit Config
                                                </button>
                                                <button
                                                    style="padding: 6px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #94a3b8; font-size: 11px; font-weight: 600; cursor: pointer;"
                                                    onClick={() => { setActiveTab('logs'); loadLogs(); }}
                                                >
                                                    <Clock class="w-3 h-3" style="display: inline; vertical-align: middle; margin-right: 4px;" /> View Logs
                                                </button>
                                            </div>
                                        </div>
                                    </Show>

                                    {/* Delete Agent */}
                                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05);">
                                        <Show when={showDeleteConfirm() !== agent.agent_name}>
                                            <button
                                                style="padding: 6px 12px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); border-radius: 8px; color: #f87171; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;"
                                                onClick={() => setShowDeleteConfirm(agent.agent_name)}
                                            >
                                                <Trash2 class="w-3 h-3" /> Delete Agent
                                            </button>
                                        </Show>
                                        <Show when={showDeleteConfirm() === agent.agent_name}>
                                            <div style="display: flex; align-items: center; gap: 8px;">
                                                <span style="font-size: 11px; color: #f87171; font-weight: 600;">Permanently delete this agent?</span>
                                                <button
                                                    style="padding: 5px 12px; background: #ef4444; border: none; border-radius: 6px; color: white; font-size: 11px; font-weight: 700; cursor: pointer;"
                                                    onClick={() => handleDeleteAgent(agent.agent_name)}
                                                    disabled={deletingAgent() === agent.agent_name}
                                                >
                                                    {deletingAgent() === agent.agent_name ? 'Deleting...' : 'Confirm'}
                                                </button>
                                                <button
                                                    style="padding: 5px 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #94a3b8; font-size: 11px; cursor: pointer;"
                                                    onClick={() => setShowDeleteConfirm('')}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </Show>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </Show>
            </Show>

            {/* Setup Tab */}
            <Show when={activeTab() === 'setup'}>
                {/* Step Indicator */}
                <div class="ah-step-indicator">
                    <div class={`ah-step-dot ${setupStep() === 1 ? 'active' : setupStep() > 1 ? 'done' : ''}`} />
                    <div class={`ah-step-dot ${setupStep() === 2 ? 'active' : setupStep() > 2 ? 'done' : ''}`} />
                    <div class={`ah-step-dot ${setupStep() === 3 ? 'active' : ''}`} />
                </div>

                {/* Step 1: Name & Register */}
                <Show when={setupStep() === 1}>
                    <div class="ah-card">
                        <div class="ah-card-title">
                            <Bot class="w-5 h-5 text-cyan-400" />
                            Step 1: Create Your Agent
                        </div>
                        <div style="margin-bottom: 16px;">
                            <label class="ah-label">Agent Name</label>
                            <input
                                type="text"
                                class="ah-input"
                                placeholder="e.g. my-trading-bot"
                                value={agentName()}
                                onInput={(e) => setAgentName(e.currentTarget.value)}
                            />
                        </div>
                        <button
                            class="ah-btn-primary"
                            disabled={!agentName().trim() || isRegistering()}
                            onClick={handleRegisterAndSetup}
                        >
                            {isRegistering() ? <><RefreshCw class="w-4 h-4 animate-spin" /> Registering...</> : <><Zap class="w-4 h-4" /> Register & Get 100 VCN</>}
                        </button>
                        <Show when={registerError()}>
                            <div class="ah-error">{registerError()}</div>
                        </Show>
                    </div>
                </Show>


                {/* Step 2: Behavior & Actions */}
                <Show when={setupStep() === 2}>
                    <div class="ah-card">
                        <div class="ah-card-title">
                            <Shield class="w-5 h-5 text-cyan-400" />
                            Step 2: Define Behavior
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label class="ah-label">System Prompt</label>
                            <textarea
                                class="ah-textarea"
                                placeholder="Describe what your agent should do. Example: Monitor my VCN balance. If it drops below 50 VCN, alert me. Never transfer more than 10 VCN at once."
                                value={systemPrompt()}
                                onInput={(e) => setSystemPrompt(e.currentTarget.value)}
                            />
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label class="ah-label">Allowed Actions</label>
                            <div class="ah-action-grid">
                                <For each={AVAILABLE_ACTIONS}>
                                    {(action) => (
                                        <div
                                            class={`ah-action-chip ${selectedActions().includes(action.id) ? 'selected' : ''}`}
                                            onClick={() => toggleAction(action.id)}
                                        >
                                            <div>
                                                <div class="ah-action-label">{action.label}</div>
                                                <div class="ah-action-desc">{action.desc}</div>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>

                        <div style="margin-bottom: 16px;">
                            <label class="ah-label">Max VCN per Action</label>
                            <input
                                type="number"
                                class="ah-input"
                                style="max-width: 120px;"
                                value={maxVcnPerAction()}
                                onInput={(e) => setMaxVcnPerAction(Number(e.currentTarget.value))}
                                min="1"
                                max="100"
                            />
                        </div>

                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                            <button class="ah-tab" onClick={() => setSetupStep(1)}>Back</button>
                            <button class="ah-btn-primary" onClick={() => setSetupStep(3)}>
                                Next <ChevronRight class="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </Show>

                {/* Step 3: Trigger & Cost */}
                <Show when={setupStep() === 3}>
                    <div class="ah-card">
                        <div class="ah-card-title">
                            <Clock class="w-5 h-5 text-cyan-400" />
                            Step 3: Execution Schedule
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label class="ah-label">Run Frequency</label>
                            <div class="ah-trigger-grid">
                                <For each={TRIGGER_OPTIONS}>
                                    {(opt) => (
                                        <div
                                            class={`ah-trigger-card ${triggerInterval() === opt.value ? 'selected' : ''}`}
                                            onClick={() => setTriggerInterval(opt.value)}
                                        >
                                            <div class="ah-trigger-label">{opt.label}</div>
                                            <div class="ah-trigger-cost">{opt.cost}</div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>

                        {/* Cost Breakdown */}
                        <div class="ah-cost-banner">
                            <div>
                                <div class="ah-cost-label">Estimated Monthly Cost</div>
                                <div class="ah-cost-value">
                                    {estimatedMonthlyCost()}
                                    <span class="ah-cost-unit">VCN/mo</span>
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 11px; color: #94a3b8;">Fee Distribution</div>
                                <div style="font-size: 12px; color: white; font-weight: 600;">70% Protocol / 30% Node Pool</div>
                            </div>
                        </div>

                        <div class="ah-fee-breakdown">
                            <div class="ah-fee-row">
                                <span class="ah-fee-label">Read-only actions</span>
                                <span class="ah-fee-value">0.05 VCN</span>
                            </div>
                            <div class="ah-fee-row">
                                <span class="ah-fee-label">Medium actions</span>
                                <span class="ah-fee-value">0.1 VCN</span>
                            </div>
                            <div class="ah-fee-row">
                                <span class="ah-fee-label">On-chain write actions</span>
                                <span class="ah-fee-value">0.5 VCN</span>
                            </div>
                            <div class="ah-fee-divider" />
                            <div class="ah-fee-row">
                                <span class="ah-fee-label">Your initial balance</span>
                                <span class="ah-fee-value" style="color: #34d399;">100 VCN</span>
                            </div>
                        </div>

                        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;">
                            <button class="ah-tab" onClick={() => setSetupStep(2)}>Back</button>
                            <button
                                class="ah-btn-primary"
                                onClick={handleStartAgent}
                                disabled={!systemPrompt().trim() || selectedActions().length === 0}
                            >
                                <Play class="w-4 h-4" /> Deploy Agent
                            </button>
                        </div>
                    </div>
                </Show>
            </Show>

            {/* Logs Tab */}
            <Show when={activeTab() === 'logs'}>
                {/* Stats Summary */}
                <Show when={logs().length > 0}>
                    <div class="ah-card" style="margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                            <div style="font-size: 14px; font-weight: 700; color: white;">Execution History</div>
                            <button
                                style="padding: 6px 12px; background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.2); border-radius: 8px; color: #22d3ee; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;"
                                onClick={() => loadLogs()}
                            >
                                <RefreshCw class="w-3 h-3" /> Refresh
                            </button>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                            <div class="ah-stat">
                                <div class="ah-stat-value">{logs().length}</div>
                                <div class="ah-stat-label">Total Logs</div>
                            </div>
                            <div class="ah-stat">
                                <div class="ah-stat-value" style="color: #34d399;">{logs().filter((l: any) => l.status === 'success').length}</div>
                                <div class="ah-stat-label">Success</div>
                            </div>
                            <div class="ah-stat">
                                <div class="ah-stat-value" style="color: #f87171;">{logs().filter((l: any) => l.status !== 'success').length}</div>
                                <div class="ah-stat-label">Errors</div>
                            </div>
                            <div class="ah-stat">
                                <div class="ah-stat-value" style="color: #fbbf24;">{logs().reduce((sum: number, l: any) => sum + (l.vcn_cost || 0), 0).toFixed(1)}</div>
                                <div class="ah-stat-label">VCN Total</div>
                            </div>
                        </div>
                    </div>
                </Show>

                <Show when={logs().length === 0}>
                    <div class="ah-card" style="text-align: center; padding: 40px;">
                        <Clock class="w-8 h-8 text-gray-600" style="margin: 0 auto 12px;" />
                        <p style="color: #64748b; font-size: 13px;">No execution logs yet.</p>
                        <p style="color: #475569; font-size: 12px; margin-top: 4px;">Logs will appear here once your agent starts running.</p>
                    </div>
                </Show>
                <Show when={logs().length > 0}>
                    <For each={logs()}>
                        {(log: any) => (
                            <div class="ah-log-item" style="flex-direction: column; gap: 8px;">
                                <div style="display: flex; align-items: flex-start; gap: 12px; width: 100%;">
                                    <div class={`ah-log-dot ${log.status === 'success' ? 'ah-log-success' : 'ah-log-error'}`} />
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                                            <div class="ah-log-time">{new Date(log.timestamp).toLocaleString()}</div>
                                            <Show when={log.llm_model}>
                                                <span style="font-size: 9px; padding: 2px 6px; background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.2); border-radius: 4px; color: #22d3ee; font-weight: 600;">
                                                    ZYNK AI
                                                </span>
                                            </Show>
                                        </div>
                                        <div class="ah-log-msg" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 500px;">
                                            {log.llm_response
                                                ? (log.llm_response.length > 120 ? log.llm_response.substring(0, 120) + '...' : log.llm_response)
                                                : log.error_message || 'Execution completed'}
                                        </div>
                                    </div>
                                    <div class="ah-log-cost">-{(log.vcn_cost || 0).toFixed(2)} VCN</div>
                                </div>
                                {/* Actions taken */}
                                <Show when={log.actions_taken && log.actions_taken.length > 0}>
                                    <div style="margin-left: 20px; display: flex; flex-wrap: wrap; gap: 4px;">
                                        <For each={log.actions_taken}>
                                            {(action: string) => (
                                                <span style="font-size: 10px; padding: 2px 8px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); border-radius: 4px; color: #818cf8; font-weight: 600;">
                                                    {action}
                                                </span>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </div>
                        )}
                    </For>
                </Show>
            </Show>
        </div>
    );
}
