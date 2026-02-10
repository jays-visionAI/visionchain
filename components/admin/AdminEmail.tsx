import { createSignal, For, Show, onMount, createEffect } from 'solid-js';
import { Mail, Eye, Send, RefreshCw, AlertCircle, Check, X, ChevronDown, Save, Code, Copy } from 'lucide-solid';
import { getFirebaseDb, getAdminFirebaseAuth } from '../../services/firebaseService';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'visionchain-d19ed';

function getAdminCloudFunctionUrl(fnName: string) {
    return `https://us-central1-${PROJECT_ID}.cloudfunctions.net/${fnName}`;
}

async function getAdminToken(): Promise<string> {
    const auth = getAdminFirebaseAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated as admin');
    return user.getIdToken();
}

// ============================================================
// Template variable definitions
// ============================================================
interface TemplateVariable {
    name: string;
    description: string;
    example: string;
}

interface TemplateDefinition {
    id: string;
    name: string;
    category: string;
    description: string;
    subject: string;
    bodyHtml: string;
    variables: TemplateVariable[];
}

// Default templates with variables
const DEFAULT_TEMPLATES: TemplateDefinition[] = [
    {
        id: 'verification',
        name: 'Device Verification',
        category: 'security',
        description: 'Sent when user logs in from a new device',
        subject: 'Your Vision Chain verification code: {{code}}',
        bodyHtml: `<h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Device Verification</h2>
<p style="margin:0 0 24px;font-size:14px;color:#888;line-height:1.6;">A new device is attempting to access your wallet. Enter the code below to verify this login.</p>
<div style="text-align:center;margin:24px 0;">
  <div style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:6px;color:#22d3ee;background:rgba(34,211,238,0.08);padding:16px 32px;border-radius:12px;border:1px solid rgba(34,211,238,0.15);">{{code}}</div>
</div>
<div style="background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.15);border-radius:12px;padding:16px 20px;margin:16px 0;">
  <p style="margin:0;font-size:13px;color:#22d3ee;line-height:1.5;"><strong>Device Info:</strong><br/>{{deviceInfo}}</p>
</div>
<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px 20px;margin:16px 0;">
  <p style="margin:0;font-size:13px;color:#ef4444;line-height:1.5;">This code expires in <strong>15 minutes</strong>. If you didn't request this, someone may be trying to access your account.</p>
</div>`,
        variables: [
            { name: 'code', description: 'Verification code (6 digits)', example: '847291' },
            { name: 'deviceInfo', description: 'Browser, OS, IP, location details', example: 'Chrome 120 / macOS 14.2 / 203.230.xxx.xxx / Seoul, KR' },
        ],
    },
    {
        id: 'suspicious',
        name: 'Suspicious Activity Alert',
        category: 'security',
        description: 'Sent when unusual login behavior is detected',
        subject: 'Security Alert: {{reason}}',
        bodyHtml: `<h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Security Alert</h2>
<p style="margin:0 0 24px;font-size:14px;color:#888;line-height:1.6;">We detected suspicious activity on your Vision Chain account.</p>
<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px 20px;margin:16px 0;">
  <p style="margin:0;font-size:13px;color:#ef4444;line-height:1.5;"><strong>Reason:</strong> {{reason}}</p>
</div>
<div style="background:rgba(255,255,255,0.03);padding:14px 16px;border-radius:10px;margin:0 0 20px;">
  <p style="margin:0;font-size:12px;font-family:'SF Mono',monospace;color:#888;line-height:1.6;word-break:break-all;">{{details}}</p>
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="border-top:1px solid rgba(255,255,255,0.04);"></td></tr></table>
<p style="margin:0 0 6px;font-size:13px;color:#ccc;font-weight:600;">If this wasn't you, please:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0 8px;">
  <tr><td style="padding:4px 0;font-size:13px;color:#888;">&bull; Change your password immediately</td></tr>
  <tr><td style="padding:4px 0;font-size:13px;color:#888;">&bull; Review your recent account activity</td></tr>
  <tr><td style="padding:4px 0;font-size:13px;color:#888;">&bull; Enable two-factor authentication</td></tr>
</table>`,
        variables: [
            { name: 'reason', description: 'Alert reason', example: 'Multiple failed login attempts' },
            { name: 'details', description: 'Activity details', example: '5 failed attempts from IP 91.132.xxx.xxx in the last 10 minutes' },
        ],
    },
    {
        id: 'passwordReset',
        name: 'Password Reset Code',
        category: 'security',
        description: 'Sent when user requests a password reset',
        subject: 'Your Vision Chain password reset code',
        bodyHtml: `<div style="text-align:center;margin:0 0 24px;">
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="28" cy="28" r="26" stroke="#f59e0b" stroke-width="2" fill="none" opacity="0.3"/>
    <rect x="20" y="18" width="16" height="20" rx="3" stroke="#f59e0b" stroke-width="2" fill="none"/>
    <circle cx="28" cy="28" r="2" fill="#f59e0b"/>
    <line x1="28" y1="30" x2="28" y2="34" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
    <path d="M22 18v-4a6 6 0 0112 0v4" stroke="#f59e0b" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>
</div>
<h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Password Reset Request</h2>
<p style="margin:0 0 24px;font-size:14px;color:#888;line-height:1.6;">Use the verification code below to reset your Vision Chain password.</p>
<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px 20px;margin:16px 0;">
  <p style="margin:0;font-size:13px;color:#ef4444;line-height:1.5;">If you did not request this password reset, please ignore this email. Your account remains secure.</p>
</div>
<div style="text-align:center;margin:24px 0;">
  <div style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:6px;color:#22d3ee;background:rgba(34,211,238,0.08);padding:16px 32px;border-radius:12px;border:1px solid rgba(34,211,238,0.15);">{{code}}</div>
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin:0 0 24px;overflow:hidden;">
  <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Account</td><td align="right" style="padding:10px 16px;font-size:14px;font-weight:700;color:#fff;">{{email}}</td></tr>
  <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Valid For</td><td align="right" style="padding:10px 16px;font-size:14px;font-weight:700;color:#fff;">15 minutes</td></tr>
</table>`,
        variables: [
            { name: 'code', description: 'Reset verification code', example: '582043' },
            { name: 'email', description: 'User email address', example: 'user@example.com' },
        ],
    },
    {
        id: 'passwordChanged',
        name: 'Password Changed Confirmation',
        category: 'security',
        description: 'Sent after password is successfully changed',
        subject: 'Your Vision Chain password has been changed',
        bodyHtml: `<h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Password Changed Successfully</h2>
<p style="margin:0 0 24px;font-size:14px;color:#888;line-height:1.6;">Your Vision Chain account password has been updated.</p>
<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px 20px;margin:16px 0;">
  <p style="margin:0;font-size:13px;color:#ef4444;line-height:1.5;">If you did not make this change, please contact support immediately and secure your account.</p>
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin:0 0 24px;overflow:hidden;">
  <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Account</td><td align="right" style="padding:10px 16px;font-size:14px;font-weight:700;color:#fff;">{{email}}</td></tr>
  <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Changed At</td><td align="right" style="padding:10px 16px;font-size:14px;font-weight:700;color:#fff;">{{timestamp}}</td></tr>
  <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Status</td><td align="right" style="padding:10px 16px;font-size:14px;font-weight:700;color:#22c55e;">Confirmed</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td align="center">
    <a href="https://visionchain.co/login" target="_blank" style="display:inline-block;background:#22d3ee;color:#000;font-size:13px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.5px;text-transform:uppercase;">Login to Vision Chain</a>
  </td></tr>
</table>
<p style="margin:0;font-size:11px;color:#555;">For security reasons, you may need to log in again on all devices.</p>`,
        variables: [
            { name: 'email', description: 'User email address', example: 'user@example.com' },
            { name: 'timestamp', description: 'Date/time of change', example: '2026-02-10 09:15 KST' },
        ],
    },
    {
        id: 'weeklyReport',
        name: 'Weekly Activity Report',
        category: 'weeklyReport',
        description: 'Weekly summary of user activity and portfolio',
        subject: 'Your Weekly Vision Chain Report - {{weekRange}}',
        bodyHtml: `<h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Weekly Activity Report</h2>
<p style="margin:0 0 24px;font-size:14px;color:#888;line-height:1.6;">Here's your weekly summary for {{weekRange}}.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin:0 0 24px;overflow:hidden;">
  <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Wallet</td><td align="right" style="padding:10px 16px;font-size:14px;font-weight:700;color:#fff;">{{walletAddress}}</td></tr>
  <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">VCN Balance</td><td align="right" style="padding:10px 16px;font-size:14px;font-weight:700;color:#22d3ee;">{{vcnBalance}} VCN</td></tr>
  <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Staking Actions</td><td align="right" style="padding:10px 16px;font-size:14px;font-weight:700;color:#fff;">{{stakingActions}}</td></tr>
  <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Bridge Transfers</td><td align="right" style="padding:10px 16px;font-size:14px;font-weight:700;color:#fff;">{{bridgeTransfers}}</td></tr>
  <tr><td style="padding:10px 16px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;">New Referrals</td><td align="right" style="padding:10px 16px;font-size:14px;font-weight:700;color:#a855f7;">{{newReferrals}}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td align="center">
    <a href="https://visionchain.co/wallet" target="_blank" style="display:inline-block;background:#22d3ee;color:#000;font-size:13px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.5px;text-transform:uppercase;">View Dashboard</a>
  </td></tr>
</table>`,
        variables: [
            { name: 'weekRange', description: 'Week date range', example: 'Feb 3 - Feb 9, 2026' },
            { name: 'walletAddress', description: 'Truncated wallet address', example: '0x6872...1d31' },
            { name: 'vcnBalance', description: 'Current VCN balance', example: '12,500.00' },
            { name: 'stakingActions', description: 'Number of staking actions', example: '3' },
            { name: 'bridgeTransfers', description: 'Number of bridge transfers', example: '1' },
            { name: 'newReferrals', description: 'Number of new referrals', example: '2' },
        ],
    },
];

// Email base layout wrapper
function wrapWithBaseLayout(bodyContent: string, previewText: string): string {
    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vision Chain</title>
</head>
<body style="margin:0;padding:0;background-color:#08080a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08080a;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:linear-gradient(145deg,#111113,#0d0d0f);border:1px solid rgba(255,255,255,0.06);border-radius:20px;overflow:hidden;">
        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;">
                  <circle cx="16" cy="16" r="15" stroke="#22d3ee" stroke-width="2" fill="none"/>
                  <path d="M16 6 L22 16 L16 26 L10 16 Z" fill="#22d3ee" opacity="0.3"/>
                  <path d="M16 10 L20 16 L16 22 L12 16 Z" fill="#22d3ee"/>
                </svg>
                <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:0.5px;margin-left:10px;vertical-align:middle;">Vision Chain</span>
              </td>
              <td align="right">
                <span style="font-size:10px;font-weight:700;color:#22d3ee;background:rgba(34,211,238,0.1);padding:4px 10px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;">Testnet</span>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px;">${bodyContent}</td></tr>
        <tr><td style="padding:20px 32px 28px;border-top:1px solid rgba(255,255,255,0.04);">
          <p style="margin:0 0 8px;font-size:11px;color:#555;line-height:1.5;">This is an automated message from Vision Chain. Do not reply to this email.</p>
          <p style="margin:0;font-size:10px;color:#333;">&copy; 2026 Vision Chain &middot; Powered by VISAI</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function replaceVariables(html: string, vars: TemplateVariable[]): string {
    let result = html;
    for (const v of vars) {
        result = result.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), v.example);
    }
    return result;
}

// Category display info
const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
    security: { label: 'Security Alerts', color: 'amber' },
    staking: { label: 'Staking', color: 'cyan' },
    referral: { label: 'Referral', color: 'purple' },
    bridge: { label: 'Bridge', color: 'blue' },
    weeklyReport: { label: 'Weekly Report', color: 'green' },
    lifecycle: { label: 'Onboarding', color: 'pink' },
    announcements: { label: 'Announcements', color: 'orange' },
};

const CATEGORIES = ['security', 'staking', 'referral', 'bridge', 'weeklyReport', 'lifecycle', 'announcements'];

interface CategoryStat { optedIn: number; optedOut: number; }
interface EmailStats { totalUsers: number; categoryStats: Record<string, CategoryStat>; }

export default function AdminEmail() {
    const [activeTab, setActiveTab] = createSignal<'templates' | 'subscriptions'>('templates');
    const [templates, setTemplates] = createSignal<TemplateDefinition[]>([]);
    const [selectedTemplate, setSelectedTemplate] = createSignal<string | null>(null);
    const [editingTemplate, setEditingTemplate] = createSignal<TemplateDefinition | null>(null);
    const [stats, setStats] = createSignal<EmailStats | null>(null);
    const [statsLoading, setStatsLoading] = createSignal(false);
    const [error, setError] = createSignal('');
    const [saving, setSaving] = createSignal(false);
    const [saveSuccess, setSaveSuccess] = createSignal('');
    const [sendingTest, setSendingTest] = createSignal<string | null>(null);
    const [sendSuccess, setSendSuccess] = createSignal('');
    const [showPreview, setShowPreview] = createSignal(false);
    const [testPopoverFor, setTestPopoverFor] = createSignal<string | null>(null);
    const [testEmailTarget, setTestEmailTarget] = createSignal('');

    // Initialize test email with admin's email
    createEffect(() => {
        const auth = getAdminFirebaseAuth();
        if (auth.currentUser?.email && !testEmailTarget()) {
            setTestEmailTarget(auth.currentUser.email);
        }
    });

    onMount(async () => {
        await loadTemplates();
    });

    // Load templates from Firestore (or use defaults)
    const loadTemplates = async () => {
        try {
            const db = getFirebaseDb();
            const loadedTemplates: TemplateDefinition[] = [];

            for (const defaultTpl of DEFAULT_TEMPLATES) {
                const docRef = doc(db, 'emailTemplates', defaultTpl.id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    loadedTemplates.push({
                        ...defaultTpl,
                        subject: data.subject || defaultTpl.subject,
                        bodyHtml: data.bodyHtml || defaultTpl.bodyHtml,
                    });
                } else {
                    loadedTemplates.push(defaultTpl);
                }
            }

            setTemplates(loadedTemplates);
        } catch (err: any) {
            console.error('[AdminEmail] Load templates error:', err);
            setTemplates(DEFAULT_TEMPLATES);
        }
    };

    const loadStats = async () => {
        setStatsLoading(true);
        try {
            const db = getFirebaseDb();
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const categoryStats: Record<string, CategoryStat> = {};
            for (const cat of CATEGORIES) {
                categoryStats[cat] = { optedIn: 0, optedOut: 0 };
            }
            usersSnapshot.forEach((doc) => {
                const prefs = doc.data().emailPreferences || {};
                for (const cat of CATEGORIES) {
                    if (prefs[cat] !== false) categoryStats[cat].optedIn++;
                    else categoryStats[cat].optedOut++;
                }
            });
            setStats({ totalUsers: usersSnapshot.size, categoryStats });
        } catch (err: any) {
            setError(err.message || 'Failed to load stats');
        } finally {
            setStatsLoading(false);
        }
    };

    const saveTemplate = async (tpl: TemplateDefinition) => {
        setSaving(true);
        setSaveSuccess('');
        try {
            const db = getFirebaseDb();
            await setDoc(doc(db, 'emailTemplates', tpl.id), {
                subject: tpl.subject,
                bodyHtml: tpl.bodyHtml,
                updatedAt: new Date().toISOString(),
                updatedBy: getAdminFirebaseAuth().currentUser?.email || 'admin',
            }, { merge: true });

            // Update local state
            setTemplates((prev) => prev.map((t) => t.id === tpl.id ? tpl : t));
            setSaveSuccess(`"${tpl.name}" template saved successfully`);
            setTimeout(() => setSaveSuccess(''), 4000);
        } catch (err: any) {
            setError(err.message || 'Failed to save template');
            setTimeout(() => setError(''), 5000);
        } finally {
            setSaving(false);
        }
    };

    const handleSendTest = async (templateId: string, targetEmail: string) => {
        if (!targetEmail || !targetEmail.includes('@')) {
            setError('Please enter a valid email address');
            setTimeout(() => setError(''), 4000);
            return;
        }
        setSendingTest(templateId);
        setTestPopoverFor(null);
        setSendSuccess('');
        try {
            const token = await getAdminToken();
            const response = await fetch(getAdminCloudFunctionUrl('adminSendTestEmail'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ templateId, sendTo: targetEmail }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setSendSuccess(`Test email sent to ${targetEmail}`);
            setTimeout(() => setSendSuccess(''), 5000);
        } catch (err: any) {
            setError(err.message || 'Failed to send test email');
            setTimeout(() => setError(''), 5000);
        } finally {
            setSendingTest(null);
        }
    };

    const resetToDefault = (templateId: string) => {
        const def = DEFAULT_TEMPLATES.find((t) => t.id === templateId);
        if (!def || !editingTemplate()) return;
        setEditingTemplate({ ...def });
    };

    const getPreviewHtml = () => {
        const tpl = editingTemplate();
        if (!tpl) return '';
        const renderedBody = replaceVariables(tpl.bodyHtml, tpl.variables);
        const renderedSubject = replaceVariables(tpl.subject, tpl.variables);
        return wrapWithBaseLayout(renderedBody, renderedSubject);
    };

    const getCategoryBadge = (category: string) => {
        const info = CATEGORY_INFO[category];
        if (!info) return <span class="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-[10px] font-bold rounded-full uppercase">{category}</span>;
        const colors: Record<string, string> = {
            amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
            purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            green: 'bg-green-500/20 text-green-400 border-green-500/30',
            pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
            orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        };
        return <span class={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase border ${colors[info.color] || ''}`}>{info.label}</span>;
    };

    const getOptInPercentage = (cat: CategoryStat) => {
        const total = cat.optedIn + cat.optedOut;
        return total === 0 ? 0 : Math.round((cat.optedIn / total) * 100);
    };

    const copyVariable = (name: string) => {
        navigator.clipboard.writeText(`{{${name}}}`);
    };

    // Tab config
    const tabs = [
        { id: 'templates' as const, label: 'Templates', icon: () => <Code class="w-4 h-4" /> },
        { id: 'subscriptions' as const, label: 'Subscriptions', icon: () => <Mail class="w-4 h-4" /> },
    ];

    return (
        <div class="space-y-6">
            {/* Header */}
            <div class="flex items-center gap-3 mb-2">
                <div class="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20">
                    <Mail class="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                    <h1 class="text-2xl font-black text-white tracking-tight">Email Management</h1>
                    <p class="text-gray-500 text-sm">Edit templates, manage variables, and preview emails</p>
                </div>
            </div>

            {/* Tabs */}
            <div class="flex gap-2 border-b border-white/10 pb-4">
                <For each={tabs}>
                    {(tab) => (
                        <button
                            onClick={() => {
                                setActiveTab(tab.id);
                                if (tab.id === 'subscriptions' && !stats()) loadStats();
                            }}
                            class={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${activeTab() === tab.id
                                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {tab.icon()}
                            {tab.label}
                        </button>
                    )}
                </For>
            </div>

            {/* Alerts */}
            <Show when={error()}>
                <div class="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2">
                    <AlertCircle class="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span class="text-red-400 text-sm">{error()}</span>
                    <button onClick={() => setError('')} class="ml-auto p-1 hover:bg-white/10 rounded-lg"><X class="w-3 h-3 text-red-400" /></button>
                </div>
            </Show>
            <Show when={saveSuccess()}>
                <div class="p-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2">
                    <Check class="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span class="text-green-400 text-sm">{saveSuccess()}</span>
                </div>
            </Show>
            <Show when={sendSuccess()}>
                <div class="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center gap-2">
                    <Send class="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span class="text-blue-400 text-sm">{sendSuccess()}</span>
                </div>
            </Show>

            {/* ==================== TEMPLATES TAB ==================== */}
            <Show when={activeTab() === 'templates'}>
                {/* Template Editor Modal */}
                <Show when={editingTemplate()}>
                    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={() => setEditingTemplate(null)}>
                        <div class="bg-[#111113] border border-white/10 rounded-3xl w-full max-w-5xl my-8" onClick={(e) => e.stopPropagation()}>
                            {/* Editor Header */}
                            <div class="flex items-center justify-between p-6 border-b border-white/10">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 rounded-lg bg-cyan-500/20">
                                        <Code class="w-5 h-5 text-cyan-400" />
                                    </div>
                                    <div>
                                        <h2 class="text-lg font-black text-white">Edit: {editingTemplate()!.name}</h2>
                                        <p class="text-gray-500 text-xs mt-0.5">{editingTemplate()!.description}</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowPreview(!showPreview())}
                                        class={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${showPreview()
                                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                            : 'bg-white/5 text-gray-400 hover:text-white'
                                            }`}
                                    >
                                        <Eye class="w-3.5 h-3.5" />
                                        Preview
                                    </button>
                                    <button
                                        onClick={() => resetToDefault(editingTemplate()!.id)}
                                        class="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-all"
                                    >
                                        <RefreshCw class="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setEditingTemplate(null)} class="p-2 hover:bg-white/10 rounded-lg">
                                        <X class="w-5 h-5 text-gray-400" />
                                    </button>
                                </div>
                            </div>

                            <div class="flex flex-col lg:flex-row">
                                {/* Left: Editor */}
                                <div class="flex-1 min-w-0 p-6 space-y-5 border-b lg:border-b-0 lg:border-r border-white/10">
                                    {/* Subject */}
                                    <div>
                                        <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Subject Line</label>
                                        <input
                                            type="text"
                                            value={editingTemplate()!.subject}
                                            onInput={(e) => setEditingTemplate({ ...editingTemplate()!, subject: e.currentTarget.value })}
                                            class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-cyan-500/50"
                                        />
                                    </div>

                                    {/* Body HTML Editor */}
                                    <div>
                                        <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Body HTML</label>
                                        <textarea
                                            value={editingTemplate()!.bodyHtml}
                                            onInput={(e) => setEditingTemplate({ ...editingTemplate()!, bodyHtml: e.currentTarget.value })}
                                            rows={20}
                                            class="w-full px-4 py-3 bg-[#0a0a0b] border border-white/10 rounded-xl text-gray-300 font-mono text-xs leading-relaxed focus:outline-none focus:border-cyan-500/50 resize-y"
                                            spellcheck={false}
                                        />
                                    </div>
                                </div>

                                {/* Right: Variables + Preview */}
                                <div class="w-full lg:w-[360px] shrink-0">
                                    {/* Variables Panel */}
                                    <div class="p-6 border-b border-white/10">
                                        <h3 class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                                <path d="M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16" />
                                            </svg>
                                            Available Variables
                                        </h3>
                                        <div class="space-y-2">
                                            <For each={editingTemplate()!.variables}>
                                                {(v) => (
                                                    <div class="p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-cyan-500/20 transition-colors group">
                                                        <div class="flex items-center justify-between mb-1">
                                                            <code class="text-cyan-400 text-xs font-bold">{`{{${v.name}}}`}</code>
                                                            <button
                                                                onClick={() => copyVariable(v.name)}
                                                                class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
                                                                title="Copy variable"
                                                            >
                                                                <Copy class="w-3 h-3 text-gray-400" />
                                                            </button>
                                                        </div>
                                                        <p class="text-gray-500 text-[11px]">{v.description}</p>
                                                        <p class="text-gray-600 text-[10px] mt-1 font-mono">Example: {v.example}</p>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </div>

                                    {/* Preview */}
                                    <Show when={showPreview()}>
                                        <div class="p-4">
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Live Preview</span>
                                                <button
                                                    onClick={() => {
                                                        const w = window.open('', '_blank');
                                                        if (w) { w.document.write(getPreviewHtml()); w.document.close(); }
                                                    }}
                                                    class="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-bold text-gray-400 hover:text-white flex items-center gap-1"
                                                >
                                                    <Eye class="w-3 h-3" />
                                                    Full View
                                                </button>
                                            </div>
                                            <div class="rounded-xl overflow-hidden border border-white/10 bg-white">
                                                <iframe
                                                    srcdoc={getPreviewHtml()}
                                                    class="w-full border-0"
                                                    style={{ height: '450px' }}
                                                    sandbox="allow-same-origin"
                                                    title="Template preview"
                                                />
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            </div>

                            {/* Footer */}
                            <div class="flex items-center justify-between p-6 border-t border-white/10">
                                <button
                                    onClick={() => setEditingTemplate(null)}
                                    class="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-bold text-sm hover:bg-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        const tpl = editingTemplate();
                                        if (tpl) {
                                            saveTemplate(tpl);
                                            setEditingTemplate(null);
                                        }
                                    }}
                                    disabled={saving()}
                                    class="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
                                >
                                    <Show when={!saving()} fallback={<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}>
                                        <Save class="w-4 h-4" />
                                    </Show>
                                    Save Template
                                </button>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* Template List */}
                <div class="grid grid-cols-1 gap-4">
                    <For each={templates()}>
                        {(template) => {
                            const isExpanded = () => selectedTemplate() === template.id;

                            return (
                                <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                                    {/* Template Header */}
                                    <div
                                        class="flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.01] transition-colors"
                                        onClick={() => setSelectedTemplate(isExpanded() ? null : template.id)}
                                    >
                                        <div class="flex items-center gap-4">
                                            <div class="p-2 rounded-lg bg-white/5">
                                                <Mail class="w-5 h-5 text-gray-400" />
                                            </div>
                                            <div>
                                                <div class="flex items-center gap-2 flex-wrap">
                                                    <span class="text-white font-semibold">{template.name}</span>
                                                    {getCategoryBadge(template.category)}
                                                </div>
                                                <p class="text-gray-500 text-sm mt-0.5">{template.description}</p>
                                                <p class="text-gray-600 text-xs mt-1 font-mono">
                                                    Variables: {template.variables.map((v) => `{{${v.name}}}`).join(', ')}
                                                </p>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingTemplate({ ...template }); setShowPreview(false); }}
                                                class="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg text-xs font-bold text-cyan-400 transition-all flex items-center gap-1.5"
                                            >
                                                <Code class="w-3 h-3" />
                                                Edit
                                            </button>
                                            <div class="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setTestPopoverFor(testPopoverFor() === template.id ? null : template.id);
                                                    }}
                                                    disabled={sendingTest() === template.id}
                                                    class="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-gray-300 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-40"
                                                >
                                                    <Show when={sendingTest() !== template.id} fallback={<RefreshCw class="w-3 h-3 animate-spin" />}>
                                                        <Send class="w-3 h-3" />
                                                    </Show>
                                                    Test
                                                </button>
                                                {/* Test Email Popover */}
                                                <Show when={testPopoverFor() === template.id}>
                                                    <div
                                                        class="absolute right-0 top-full mt-2 z-50 w-80 bg-[#1a1a1d] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div class="p-4 border-b border-white/5">
                                                            <div class="flex items-center justify-between mb-1">
                                                                <span class="text-xs font-black text-white">Send Test Email</span>
                                                                <button onClick={() => setTestPopoverFor(null)} class="p-1 hover:bg-white/10 rounded-lg">
                                                                    <X class="w-3.5 h-3.5 text-gray-500" />
                                                                </button>
                                                            </div>
                                                            <p class="text-[11px] text-gray-500">Send "{template.name}" to a specific address</p>
                                                        </div>
                                                        <div class="p-4 space-y-3">
                                                            <div>
                                                                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Recipient Email</label>
                                                                <input
                                                                    type="email"
                                                                    value={testEmailTarget()}
                                                                    onInput={(e) => setTestEmailTarget(e.currentTarget.value)}
                                                                    placeholder="admin@example.com"
                                                                    class="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') handleSendTest(template.id, testEmailTarget());
                                                                    }}
                                                                />
                                                            </div>
                                                            <button
                                                                onClick={() => handleSendTest(template.id, testEmailTarget())}
                                                                disabled={!testEmailTarget() || sendingTest() === template.id}
                                                                class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white text-xs font-bold hover:opacity-90 transition-all disabled:opacity-40"
                                                            >
                                                                <Send class="w-3.5 h-3.5" />
                                                                Send Test Email
                                                            </button>
                                                        </div>
                                                    </div>
                                                </Show>
                                            </div>
                                            <ChevronDown class={`w-4 h-4 text-gray-500 transition-transform ${isExpanded() ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>

                                    {/* Inline Preview */}
                                    <Show when={isExpanded()}>
                                        <div class="border-t border-white/5 p-4 bg-white/[0.01]">
                                            <div class="flex items-center justify-between mb-3">
                                                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Preview (with example data)</span>
                                                <button
                                                    onClick={() => {
                                                        const html = wrapWithBaseLayout(
                                                            replaceVariables(template.bodyHtml, template.variables),
                                                            replaceVariables(template.subject, template.variables),
                                                        );
                                                        const w = window.open('', '_blank');
                                                        if (w) { w.document.write(html); w.document.close(); }
                                                    }}
                                                    class="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-[10px] font-bold text-gray-400 hover:text-white flex items-center gap-1"
                                                >
                                                    <Eye class="w-3 h-3" />
                                                    Open Full
                                                </button>
                                            </div>
                                            <div class="rounded-xl overflow-hidden border border-white/10 bg-white">
                                                <iframe
                                                    srcdoc={wrapWithBaseLayout(
                                                        replaceVariables(template.bodyHtml, template.variables),
                                                        replaceVariables(template.subject, template.variables),
                                                    )}
                                                    class="w-full border-0"
                                                    style={{ height: '500px' }}
                                                    sandbox="allow-same-origin"
                                                    title={`${template.name} preview`}
                                                />
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>

            {/* ==================== SUBSCRIPTIONS TAB ==================== */}
            <Show when={activeTab() === 'subscriptions'}>
                <Show when={statsLoading()}>
                    <div class="flex items-center justify-center py-12">
                        <div class="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                    </div>
                </Show>

                <Show when={stats() && !statsLoading()}>
                    <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                        <div class="flex items-center justify-between p-6 border-b border-white/5">
                            <div>
                                <h2 class="text-lg font-bold text-white">User Subscription Breakdown</h2>
                                <p class="text-gray-500 text-sm mt-0.5">{stats()!.totalUsers.toLocaleString()} total users</p>
                            </div>
                            <button onClick={loadStats} disabled={statsLoading()}
                                class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-gray-300 hover:text-white transition-all flex items-center gap-2 disabled:opacity-40">
                                <RefreshCw class={`w-4 h-4 ${statsLoading() ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </div>

                        <div class="divide-y divide-white/5">
                            <For each={Object.entries(stats()!.categoryStats)}>
                                {([key, stat]) => {
                                    const info = CATEGORY_INFO[key];
                                    const pct = getOptInPercentage(stat);
                                    const barColors: Record<string, string> = {
                                        amber: 'from-amber-500 to-amber-600', cyan: 'from-cyan-500 to-cyan-600',
                                        purple: 'from-purple-500 to-purple-600', blue: 'from-blue-500 to-blue-600',
                                        green: 'from-green-500 to-green-600', pink: 'from-pink-500 to-pink-600',
                                        orange: 'from-orange-500 to-orange-600',
                                    };
                                    return (
                                        <div class="p-5 hover:bg-white/[0.01] transition-colors">
                                            <div class="flex items-center justify-between mb-3">
                                                <div class="flex items-center gap-3">
                                                    <span class="text-white font-medium">{info?.label || key}</span>
                                                    <Show when={key === 'security'}>
                                                        <span class="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-black rounded uppercase">Locked</span>
                                                    </Show>
                                                </div>
                                                <div class="flex items-center gap-4 text-sm">
                                                    <span class="text-green-400 font-mono">{stat.optedIn} in</span>
                                                    <span class="text-gray-500 font-mono">{stat.optedOut} out</span>
                                                    <span class="text-white font-bold w-12 text-right">{pct}%</span>
                                                </div>
                                            </div>
                                            <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    class={`h-full rounded-full bg-gradient-to-r ${barColors[info?.color || 'cyan']} transition-all duration-700`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
}
