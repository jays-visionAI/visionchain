import { createSignal, For } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    ShieldCheck,
    Code,
    GitCommit,
    AlertTriangle,
    FileCode,
    Terminal,
    History
} from 'lucide-solid';

export default function ContractVerifyView() {
    const [activeTab, setActiveTab] = createSignal<'code' | 'attributes' | 'proxy'>('code');

    const proxyHistory = [
        { version: 'v2.1.0', impl: '0x82...9281', date: '2 days ago', reason: 'Security Patch (Reentrancy)', audit: 'Passed' },
        { version: 'v2.0.0', impl: '0x12...3842', date: '2023-11-01', reason: 'Major Upgrade (Cross-chain)', audit: 'Passed' },
        { version: 'v1.0.0', impl: '0xab...1234', date: '2023-01-15', reason: 'Initial Deployment', audit: 'Passed' }
    ];

    return (
        <div class="space-y-6">
            {/* Security Header */}
            <div class="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <ShieldCheck class="w-5 h-5 text-blue-400" />
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="text-sm font-bold text-white">Source Code Verified (Standard)</h4>
                            <span class="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] font-black uppercase rounded">Proxy</span>
                        </div>
                        <p class="text-[10px] text-gray-500">Compiler: v0.8.20+commit.a1b2c3d4 • Optimization: Enabled (200)</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button class="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold text-white transition-colors">
                        View Audit Report
                    </button>
                </div>
            </div>

            {/* Inner Tabs */}
            <div class="flex gap-2 border-b border-white/5">
                <button
                    onClick={() => setActiveTab('code')}
                    class={`px-4 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab() === 'code' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-white'}`}
                >
                    Contract Source
                </button>
                <button
                    onClick={() => setActiveTab('proxy')}
                    class={`px-4 py-2 text-[10px] font-black uppercase tracking-widest ${activeTab() === 'proxy' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-white'}`}
                >
                    Proxy Upgrades
                </button>
            </div>

            {/* Content */}
            {activeTab() === 'code' && (
                <div class="bg-[#0c0c0c] border border-white/10 rounded-xl overflow-hidden font-mono text-xs">
                    <div class="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-b border-white/5">
                        <span class="flex items-center gap-2 text-gray-400">
                            <FileCode class="w-3 h-3" /> Address.sol
                        </span>
                        <span class="text-[9px] text-gray-600 uppercase">Size: 4.2 KB</span>
                    </div>
                    <div class="p-4 text-gray-400 overflow-x-auto">
                        <pre>
                            {`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract VisionVault is Initializable {
    mapping(address => uint256) public balances;
    
    event Deposit(address indexed user, uint256 amount);
    
    function initialize() public initializer {
        // ... implementation
    }
}`}
                        </pre>
                    </div>
                </div>
            )}

            {activeTab() === 'proxy' && (
                <div class="relative pl-4 space-y-8 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                    <For each={proxyHistory}>
                        {(item, i) => (
                            <div class="relative flex items-start gap-4">
                                <div class="z-10 w-8 h-8 rounded-full bg-[#0c0c0c] border border-white/20 flex items-center justify-center shrink-0">
                                    <GitCommit class="w-4 h-4 text-blue-400" />
                                </div>
                                <div class="flex-1 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                                    <div class="flex justify-between items-start mb-2">
                                        <div>
                                            <div class="flex items-center gap-2">
                                                <span class="text-sm font-bold text-white">{item.version}</span>
                                                <span class="px-1.5 py-0.5 bg-green-500/10 text-green-400 text-[9px] font-black uppercase rounded">Active</span>
                                            </div>
                                            <div class="text-[10px] text-gray-500 font-mono mt-1">Impl: {item.impl}</div>
                                        </div>
                                        <span class="text-[10px] font-bold text-gray-500">{item.date}</span>
                                    </div>
                                    <p class="text-xs text-gray-300 mb-2">{item.reason}</p>
                                    <div class="flex items-center gap-2 text-[10px] text-gray-500">
                                        <ShieldCheck class="w-3 h-3 text-green-500" />
                                        Audit Status: {item.audit}
                                    </div>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            )}
        </div>
    );
}
