import{o as c,c as l,e as s,a1 as r,l as d,U as u,aG as m}from"./index-DYr5Ysoi.js";import{W as h}from"./AdminAIManagement-D90Ss_I5.js";import{S as p}from"./save-Z81gdZwJ.js";import{U as g}from"./user-B8tLATt5.js";import"./contractService-ChUdhGqR.js";import"./provider-browser-CnV6HXUi.js";import"./key-S93QKlOy.js";import"./message-square-sL21Op-B.js";import"./settings-2-P_Iwb13c.js";import"./sparkles-BNwITQ0-.js";import"./brain-DdumpWx-.js";import"./rotate-ccw-j_gA0Yt3.js";const a={systemRules:`[General System Rules]
1. Respond like a professional blockchain architect.
2. Maintain a premium and helpful tone.
3. Always verify recipient details before recommending a transfer.
4. Use SVG icons and Markdown Tables for data-rich responses.
5. Provide professional insights and comparisons (e.g., comparing asset yields in a table).`,recipientIntent:`System Prompt: Recipient Resolver (Vision Chain Wallet)

You are the Recipient Resolver for the Vision Chain Wallet. Your job is to deterministically resolve the intended recipient from the user’s input.

CRITICAL INSTRUCTION:
1.  **RESPONSE LANGUAGE**: You must respond in the SAME language as the user's input. If the user speaks Korean, you MUST speak Korean.
2.  **THINKING PROCESS**: You MUST output your reasoning steps enclosed in <think> tags BEFORE your final answer. This is for the UI visualization.
    Format: <think>Step Title: Brief detail</think>
    Example:
    <think>Contact Search: Looking for '류성국'...</think>
    <think>Fuzzy Match: Found '류성국대표' (90%)</think>
    <think>Decision: Asking for confirmation.</think>

0) Tools & Data Sources
	• search_user_contacts(query) → returns saved contacts
	• resolve_vid_by_phone(phone_e164) → returns VID + wallet address
	• resolve_vns_handle(handle) → returns resolved wallet address
	• validate_evm_address(address) → returns valid/invalid status
	• fuzzy_match_candidates(candidates, input_name) → returns similarity scores

1) Inputs You Must Support
	1. VNS handle: @handle or name.vcn
	2. Direct wallet address: 0x...
	3. VID (VID:xxxx), Email, or Phone number
	4. Name: "노장협", "Sangjae Seo", etc. (misspelled or partial)

2) Primary Objective & Safety Rules
	• Return: resolvedRecipient = { displayName, resolutionMethod, confidence, walletAddress, vid }
	• Safety: Never guess. If confidence < 0.85, ALWAYS ask for confirmation.

3) Resolution Strategy (Deterministic Order)
Step A — Direct Identifiers
Step B — Phone-Based Matching
Step C — Name-Based Contact Search + Fuzzy Matching
	• Typos/Phonetic: Handle "루성국" -> "류성국".
	• Order/Spaces: Handle "성국류" -> "류성국".
	• Partial Match: If input is "류성국" but contact is "류성국대표", treat as potential match.
	• Scoring: >= 0.85 (Strong), 0.70-0.84 (Potential - ASK USER), < 0.70 (Weak).

4) Conflict Resolution & Clarifying Questions
If ambiguity exists, ask in the USER'S LANGUAGE:
"Did you mean [Name]? (Last 4 digits: [****-1234])" -> "혹시 [이름]님을 말씀하시는 건가요? (끝번호: 1234)"

5) Error Handling & Recovery
If not found: Respond “주소록에서 찾지 못했습니다.” and ask for phone/VID/address.

6) Confirmation Message Policy
Show summary: “Recipient: {displayName}, Resolved via: {method}, Destination: {0x123...}” before handoff.`,senderIntent:`Task: Analyze the SENDER'S context and eligibility.
1. Financial Context:
   - Check if current balance (referencing user's portfolio) covers the amount and gas.
   - Identify the user's Tier (Standard/VIP) to adjust the response sophistication.
2. Behavioral Context:
   - Identify intent level (Exploratory vs. Execution).
   - Maintain a helpful, "Architect" persona that builds confidence.`,processingRoute:`Task: Determine the optimal EXECUTION ROUTE.
1. Routing Logic:
   - TRANSFER: Internal to Vision Chain.
   - BRIDGE: Use cross-chain assets if destination is specified (e.g., Ethereum, Polygon).
   - SWAP_AND_SEND: If recipient prefers a different asset. Use tools to check rates.
   - SCHEDULE: If time descriptors are used (e.g., 'in 2 hours').
2. Market Research Normalization:
   - Price Lookup: Use 'get_current_price' for real-time stats or 'get_historical_price' for growth analysis.
   - Alpha Discovery: Use 'search_defi_pools' to find high-yield opportunities.
   - Security Audit: Use 'analyze_protocol_risk' for any protocol research (e.g., "Is Aave safe?").
   - Synthesize 'Seeking Alpha' style insights by combining price growth, yield data, and risk scores.`};function T(e){c(()=>{const t=e.settings();(!t.recipientIntent||!t.senderIntent||!t.processingRoute||!t.systemRules)&&e.setSettings({systemRules:t.systemRules||a.systemRules,recipientIntent:t.recipientIntent||a.recipientIntent,senderIntent:t.senderIntent||a.senderIntent,processingRoute:t.processingRoute||a.processingRoute})});const[i,n]=l(!1),o=async()=>{await e.onSave(),n(!0),setTimeout(()=>n(!1),4e3)};return React.createElement("div",{class:"space-y-8 relative"},React.createElement(s,{when:i()},React.createElement("div",{class:"fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"},React.createElement("div",{class:"bg-[#1A1A24] border border-cyan-500/30 rounded-[32px] p-8 max-w-sm w-full shadow-[0_0_50px_rgba(6,182,212,0.2)] text-center space-y-6 transform animate-in zoom-in-95 duration-300"},React.createElement("div",{class:"w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto border border-cyan-500/20"},React.createElement(r,{class:"w-10 h-10 text-cyan-400"})),React.createElement("div",{class:"space-y-2"},React.createElement("h3",{class:"text-2xl font-bold text-white"},"AI Models Deployed"),React.createElement("p",{class:"text-gray-400 text-sm leading-relaxed"},"Your custom intent prompts have been synchronized across all Vision Chain nodes and are now live.")),React.createElement("button",{onClick:()=>n(!1),class:"w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:scale-[1.02] transition-transform active:scale-95"},"Got it")))),React.createElement("div",{class:"flex items-center justify-between"},React.createElement("div",{class:"space-y-1"},React.createElement("h2",{class:"text-xl font-semibold text-white flex items-center gap-2"},React.createElement(h,{class:"w-5 h-5 text-cyan-400"}),"AI Intent Prompting"),React.createElement("p",{class:"text-xs text-gray-500"},"Tune the core logic for intent parsing and action resolution.")),React.createElement("button",{onClick:o,disabled:e.isSaving(),class:"flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50"},React.createElement(p,{class:"w-4 h-4"}),e.isSaving()?"Saving...":"Deploy Prompt")),React.createElement("div",{class:"grid grid-cols-1 gap-6"},React.createElement("div",{class:"rounded-3xl bg-white/[0.02] border border-white/10 p-6 space-y-4"},React.createElement("div",{class:"flex items-center gap-3"},React.createElement("div",{class:"p-2 rounded-xl bg-cyan-500/20"},React.createElement(d,{class:"w-5 h-5 text-cyan-400"})),React.createElement("div",null,React.createElement("h3",{class:"text-white font-bold"},"1. Rules"),React.createElement("p",{class:"text-gray-500 text-xs text-balance"},"General system rules and behavioral constraints for the AI agent."))),React.createElement("textarea",{value:e.settings().systemRules,onInput:t=>e.setSettings({...e.settings(),systemRules:t.currentTarget.value}),class:"w-full h-32 p-4 bg-black/40 border border-white/10 rounded-2xl text-sm font-mono text-gray-300 focus:outline-none focus:border-cyan-500/50 resize-none transition-all",placeholder:"Enter general system rules..."})),React.createElement("div",{class:"rounded-3xl bg-white/[0.02] border border-white/10 p-6 space-y-4"},React.createElement("div",{class:"flex items-center gap-3"},React.createElement("div",{class:"p-2 rounded-xl bg-blue-500/20"},React.createElement(u,{class:"w-5 h-5 text-blue-400"})),React.createElement("div",null,React.createElement("h3",{class:"text-white font-bold"},"2. Recipient's Intent"),React.createElement("p",{class:"text-gray-500 text-xs text-balance"},"Rules for resolving who is receiving the funds. Focus on Contact List optimization."))),React.createElement("textarea",{value:e.settings().recipientIntent,onInput:t=>e.setSettings({...e.settings(),recipientIntent:t.currentTarget.value}),class:"w-full h-32 p-4 bg-black/40 border border-white/10 rounded-2xl text-sm font-mono text-gray-300 focus:outline-none focus:border-blue-500/50 resize-none transition-all",placeholder:"Enter system prompt for recipient resolution..."})),React.createElement("div",{class:"rounded-3xl bg-white/[0.02] border border-white/10 p-6 space-y-4"},React.createElement("div",{class:"flex items-center gap-3"},React.createElement("div",{class:"p-2 rounded-xl bg-purple-500/20"},React.createElement(g,{class:"w-5 h-5 text-purple-400"})),React.createElement("div",null,React.createElement("h3",{class:"text-white font-bold"},"3. Sender's Intent"),React.createElement("p",{class:"text-gray-500 text-xs"},"Rules for identifying user context, portfolio state, and emotional tone."))),React.createElement("textarea",{value:e.settings().senderIntent,onInput:t=>e.setSettings({...e.settings(),senderIntent:t.currentTarget.value}),class:"w-full h-24 p-4 bg-black/40 border border-white/10 rounded-2xl text-sm font-mono text-gray-300 focus:outline-none focus:border-purple-500/50 resize-none transition-all",placeholder:"Enter system prompt for sender context..."})),React.createElement("div",{class:"rounded-3xl bg-white/[0.02] border border-white/10 p-6 space-y-4"},React.createElement("div",{class:"flex items-center gap-3"},React.createElement("div",{class:"p-2 rounded-xl bg-amber-500/20"},React.createElement(m,{class:"w-5 h-5 text-amber-400"})),React.createElement("div",null,React.createElement("h3",{class:"text-white font-bold"},"4. Processing Route"),React.createElement("p",{class:"text-gray-500 text-xs text-balance"},"Decision logic for Bridge, Swap, Transfer, or Schedule. Includes market context injection."))),React.createElement("textarea",{value:e.settings().processingRoute,onInput:t=>e.setSettings({...e.settings(),processingRoute:t.currentTarget.value}),class:"w-full h-32 p-4 bg-black/40 border border-white/10 rounded-2xl text-sm font-mono text-gray-300 focus:outline-none focus:border-amber-500/50 resize-none transition-all",placeholder:"Enter system prompt for processing logic..."}))),React.createElement(s,{when:e.saveSuccess()},React.createElement("div",{class:"flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2"},React.createElement(r,{class:"w-4 h-4"}),React.createElement("span",null,"AI Tuning Parameters successfully synchronized!"))))}export{a as DEFAULT_PROMPTS,T as PromptsTab};
