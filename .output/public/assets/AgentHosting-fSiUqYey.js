import{u as he,v as be,I as xe,c as o,x as ee,o as ye,b1 as fe,be as _,q as O,e as n,Z as L,F as d,ah as te,aL as ve,bU as we}from"./index-DYr5Ysoi.js";import{C as A}from"./clock-DUBzfyt_.js";import{R as H}from"./refresh-cw-KwNmAHZw.js";import{P as B}from"./play-BCSjQCgp.js";import{C as Re}from"./copy-Bf8YzTOJ.js";import{T as Ee}from"./trash-2-DP_eIxN1.js";import{C as ae}from"./chevron-right-DxFA493L.js";/**
 * @license lucide-solid v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ke=[["rect",{x:"14",y:"4",width:"4",height:"16",rx:"1",key:"zuxfzm"}],["rect",{x:"6",y:"4",width:"4",height:"16",rx:"1",key:"1okwgv"}]],ne=C=>he(xe,be(C,{name:"Pause",iconNode:ke})),f=typeof window<"u"&&window.location.hostname.includes("staging")?"https://us-central1-visionchain-staging.cloudfunctions.net/agentGateway":"https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway",S={balance:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-1 2-2 2-4 0-1-.5-1.5-1-2z"/><path d="M2 9.1C1 9.5 1 10 1 10.8V14c0 1.1 1.2 2 2.5 2S6 15.1 6 14"/></svg>',transfer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M7 17l-4-4 4-4"/><path d="M3 13h13"/><path d="M17 7l4 4-4 4"/><path d="M21 11H8"/></svg>',stake:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M12 2v20"/><path d="M2 12h20"/><circle cx="12" cy="12" r="4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>',unstake:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>',network_info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 10l2 2 2-2 2 2 2-2"/></svg>',staking_info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',leaderboard:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C5.3 4 6 4.7 6 5.5"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C18.7 4 18 4.7 18 5.5"/><rect x="6" y="9" width="12" height="13" rx="2"/><path d="M12 9v4"/></svg>',referral_outreach:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',social_promo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',content_create:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',invite_distribute:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',community_engage:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'},N=[{id:"balance",label:"Balance Monitor",desc:"Track VCN balance and get alerts",longDesc:"I will continuously watch your agent wallet balance and alert you the moment it drops below your safety threshold. This way you can top up before I run out of gas.",category:"on-chain",costTier:"read",costVcn:.05,status:"live",defaultPrompt:"Monitor my VCN balance. Alert me if it drops below the threshold.",settingsFields:[{key:"alert_threshold",type:"number",label:"Alert Threshold",desc:"I will flag a warning whenever your balance falls below this level so you can refill in time.",placeholder:"50",defaultValue:50,min:1,max:1e4,unit:"VCN"},{key:"alert_method",type:"select",label:"Alert Method",desc:"How should I deliver the alert to you?",defaultValue:"log",options:[{value:"log",label:"Execution Log"},{value:"webhook",label:"Webhook (future)"}]}]},{id:"transfer",label:"Auto Transfer",desc:"Schedule automatic VCN transfers",longDesc:"I will automatically send VCN to the address you specify. You set the rules -- how much, how often, and the safety limits -- and I handle the rest.",category:"on-chain",costTier:"write",costVcn:.5,status:"live",defaultPrompt:"Transfer VCN to the specified address when conditions are met. Never exceed the daily limit.",settingsFields:[{key:"recipient",type:"address",label:"Recipient Address",desc:"Tell me the wallet address where I should send VCN. I will only send to this exact address.",placeholder:"0x...",defaultValue:""},{key:"amount",type:"number",label:"Amount per Transfer",desc:"How much VCN should I send each time I execute?",placeholder:"10",defaultValue:10,min:.1,max:1e3,unit:"VCN"},{key:"daily_limit",type:"number",label:"Daily Limit",desc:"For your safety, I will never transfer more than this total amount per day, no matter how many times I run.",placeholder:"50",defaultValue:50,min:1,max:1e4,unit:"VCN"},{key:"condition",type:"select",label:"Transfer Condition",desc:"When should I trigger a transfer?",defaultValue:"always",options:[{value:"always",label:"Every execution"},{value:"above_balance",label:"Only when balance above threshold"}]},{key:"min_balance_keep",type:"number",label:"Minimum Balance to Keep",desc:"I will always keep at least this much VCN in your wallet so I can keep running. Transfers that would drop below this are skipped.",placeholder:"20",defaultValue:20,min:1,max:1e4,unit:"VCN"}]},{id:"stake",label:"Auto Stake",desc:"Automatically stake VCN for rewards",longDesc:"I will automatically stake your VCN in the BridgeStaking contract to earn rewards for you. Tell me how much to stake and whether to auto-compound.",category:"on-chain",costTier:"write",costVcn:.5,status:"live",defaultPrompt:"Stake available VCN tokens for rewards. Keep minimum balance for operations.",settingsFields:[{key:"stake_mode",type:"select",label:"Stake Mode",desc:"Should I stake a fixed VCN amount, or a percentage of your available balance?",defaultValue:"fixed",options:[{value:"fixed",label:"Fixed amount"},{value:"percentage",label:"Percentage of balance"}]},{key:"stake_amount",type:"number",label:"Stake Amount",desc:'The fixed VCN amount I should stake each time (used when Stake Mode is "Fixed").',placeholder:"50",defaultValue:50,min:1,max:1e5,unit:"VCN"},{key:"stake_percent",type:"number",label:"Stake Percentage",desc:'The percentage of your available balance I should stake (used when Stake Mode is "Percentage").',placeholder:"80",defaultValue:80,min:10,max:100,unit:"%"},{key:"auto_compound",type:"toggle",label:"Auto-Compound Rewards",desc:"When enabled, I will automatically re-stake any earned rewards to maximize your yield.",defaultValue:!0},{key:"min_balance_keep",type:"number",label:"Minimum Balance to Keep",desc:"I will always reserve at least this much VCN so I can keep running and paying for executions.",placeholder:"20",defaultValue:20,min:1,max:1e4,unit:"VCN"}]},{id:"unstake",label:"Conditional Unstake",desc:"Unstake based on conditions",longDesc:"I will keep an eye on your staking position and automatically unstake your VCN when the conditions you set are met -- for example, when APY drops too low.",category:"on-chain",costTier:"write",costVcn:.5,status:"live",defaultPrompt:"Monitor staking position. Unstake if conditions are met.",settingsFields:[{key:"unstake_amount",type:"select",label:"Unstake Amount",desc:"Should I unstake everything, or just a partial amount?",defaultValue:"all",options:[{value:"all",label:"Full unstake"},{value:"partial",label:"Partial amount"}]},{key:"partial_amount",type:"number",label:"Partial Unstake Amount",desc:"If you chose partial, how much VCN should I unstake?",placeholder:"100",defaultValue:100,min:1,max:1e5,unit:"VCN"},{key:"trigger_condition",type:"select",label:"Trigger Condition",desc:"When should I trigger the unstake? I can do it every time I run, or only when rewards become unfavorable.",defaultValue:"manual",options:[{value:"manual",label:"Every execution"},{value:"apy_below",label:"APY drops below target"}]},{key:"target_apy",type:"number",label:"Target APY Threshold",desc:"I will unstake your VCN if the current APY drops below this percentage. This protects you from diminishing returns.",placeholder:"5",defaultValue:5,min:.1,max:100,unit:"%"}]},{id:"network_info",label:"Network Monitor",desc:"Monitor chain health and status",longDesc:"I will monitor Vision Chain's health -- block production, latency, and anomalies -- and alert you immediately if something looks wrong.",category:"on-chain",costTier:"read",costVcn:.05,status:"live",defaultPrompt:"Monitor Vision Chain network status and alert on any issues.",settingsFields:[{key:"block_delay_alert",type:"number",label:"Block Delay Alert",desc:"I will raise an alert if no new block appears within this many seconds. Lower values = more sensitive monitoring.",placeholder:"60",defaultValue:60,min:10,max:600,unit:"sec"}]},{id:"staking_info",label:"Staking Dashboard",desc:"Track staking rewards and position",longDesc:"I will track your staking position, monitor pending rewards, and give you performance insights. Optionally, I can flag when rewards are ready to claim.",category:"on-chain",costTier:"read",costVcn:.05,status:"live",defaultPrompt:"Check my staking position and pending rewards. Log the results.",settingsFields:[{key:"auto_claim_threshold",type:"number",label:"Auto-Claim Alert Threshold",desc:"I will flag when your pending rewards exceed this amount so you know it's time to claim. Set to 0 to disable.",placeholder:"10",defaultValue:0,min:0,max:1e4,unit:"VCN"}]},{id:"leaderboard",label:"Leaderboard Tracker",desc:"Track RP rankings and competition",longDesc:"I will track the RP leaderboard and report your ranking relative to the top competitors. No configuration needed -- I handle everything automatically.",category:"on-chain",costTier:"read",costVcn:.05,status:"live",defaultPrompt:"Check the RP leaderboard and log my ranking.",settingsFields:[]},{id:"referral_outreach",label:"Referral Outreach",desc:"Auto-distribute referral links",longDesc:"I will generate and distribute your unique referral link with customized messaging tailored to each channel. Tell me where to post and what to say.",category:"growth",costTier:"medium",costVcn:.1,status:"live",defaultPrompt:"Generate referral outreach content for the selected channels. Use the custom message template if provided.",settingsFields:[{key:"channels",type:"multi-select",label:"Target Channels",desc:"Which platforms should I create outreach content for? I will tailor the tone and format for each.",defaultValue:["twitter"],options:[{value:"twitter",label:"Twitter / X"},{value:"telegram",label:"Telegram"},{value:"discord",label:"Discord"},{value:"email",label:"Email"}]},{key:"custom_message",type:"textarea",label:"Custom Message",desc:"Give me a base message to work with. I will adapt it per channel and automatically append your referral link.",placeholder:"Check out Vision Chain - the next-gen L1 blockchain with AI agents...",defaultValue:""},{key:"max_daily",type:"number",label:"Max Outreach per Day",desc:"I will not generate more than this many outreach messages per day to keep your presence natural.",placeholder:"10",defaultValue:10,min:1,max:100,unit:"times"}]},{id:"social_promo",label:"Social Promotion",desc:"Auto-generate social media posts",longDesc:"I will create engaging social media posts about Vision Chain. Tell me the topic and the vibe you want, and I will craft content ready to publish.",category:"growth",costTier:"medium",costVcn:.1,status:"live",defaultPrompt:"Create a social media post about Vision Chain focused on the selected topic. Match the selected tone.",settingsFields:[{key:"topic",type:"select",label:"Topic Focus",desc:"What should I write about? I will focus the content on this specific area of Vision Chain.",defaultValue:"general",options:[{value:"general",label:"General / Overview"},{value:"staking",label:"Staking & Rewards"},{value:"agents",label:"AI Agents"},{value:"bridge",label:"Bridge & Cross-chain"}]},{key:"tone",type:"select",label:"Tone & Style",desc:"What voice should I use? This shapes how the content reads and who it resonates with.",defaultValue:"professional",options:[{value:"professional",label:"Professional"},{value:"casual",label:"Casual & Friendly"},{value:"hype",label:"Hype & Excitement"},{value:"educational",label:"Educational"}]},{key:"hashtags",type:"text",label:"Custom Hashtags",desc:"I will include these alongside the default Vision Chain hashtags. Comma-separated.",placeholder:"#DeFi, #Web3",defaultValue:""}]},{id:"content_create",label:"Content Creator",desc:"Generate articles and threads",longDesc:"I will create long-form content -- Twitter threads, blog articles, or newsletter segments -- ready to publish on your chosen platform.",category:"growth",costTier:"read",costVcn:.05,status:"live",defaultPrompt:"Generate promotional content for Vision Chain in the selected format and platform.",settingsFields:[{key:"content_type",type:"select",label:"Content Type",desc:"What format should I create? Each type is optimized for length, structure, and engagement style.",defaultValue:"thread",options:[{value:"thread",label:"Twitter Thread"},{value:"article",label:"Blog Article"},{value:"newsletter",label:"Newsletter Segment"}]},{key:"platform",type:"select",label:"Target Platform",desc:"Where will you publish this? I will adapt formatting, length, and style accordingly.",defaultValue:"twitter",options:[{value:"twitter",label:"Twitter / X"},{value:"medium",label:"Medium"},{value:"blog",label:"Blog / Website"}]}]},{id:"invite_distribute",label:"Invite Distribution",desc:"Send targeted invitations",longDesc:"I will craft personalized invitation messages targeting specific audiences and include your unique referral link. Tell me who you want to reach.",category:"growth",costTier:"medium",costVcn:.1,status:"live",defaultPrompt:"Generate invitation messages targeted at the selected audience. Include the referral signup link.",settingsFields:[{key:"target_audience",type:"select",label:"Target Audience",desc:"Who are you trying to invite? I will tailor the language and selling points for this specific group.",defaultValue:"general",options:[{value:"general",label:"General Users"},{value:"developer",label:"Developers"},{value:"investor",label:"Investors & Traders"},{value:"defi",label:"DeFi Users"}]},{key:"custom_invite",type:"textarea",label:"Custom Invite Message",desc:"Give me your own invitation text and I will enhance it. Leave blank and I will write one from scratch.",placeholder:"Personalize your invitation message...",defaultValue:""},{key:"daily_limit",type:"number",label:"Daily Invite Limit",desc:"I will cap my output at this many invitations per day to maintain quality and avoid spam.",placeholder:"20",defaultValue:20,min:1,max:100,unit:"invites"}]},{id:"community_engage",label:"Community Engagement",desc:"Auto-engage in community channels",longDesc:"I will prepare context-rich talking points and responses for community engagement. Tell me where to focus and what style to use, and I will help you maintain an active, helpful presence.",category:"growth",costTier:"medium",costVcn:.1,status:"live",defaultPrompt:"Engage in community channels with helpful, accurate information about Vision Chain. Focus on the selected topics.",settingsFields:[{key:"channels",type:"multi-select",label:"Channels",desc:"Which community platforms should I prepare engagement content for?",defaultValue:["discord"],options:[{value:"discord",label:"Discord"},{value:"telegram",label:"Telegram"},{value:"twitter",label:"Twitter Replies"}]},{key:"focus_topics",type:"multi-select",label:"Focus Topics",desc:"What topics should I be ready to discuss? I will prepare accurate, up-to-date talking points for each.",defaultValue:["onboarding"],options:[{value:"staking_faq",label:"Staking FAQ"},{value:"network_updates",label:"Network Updates"},{value:"onboarding",label:"Onboarding Help"},{value:"technical",label:"Technical Support"}]},{key:"style",type:"select",label:"Engagement Style",desc:"How should I sound when engaging? This sets the overall tone of my community responses.",defaultValue:"helpful",options:[{value:"helpful",label:"Helpful & Supportive"},{value:"informative",label:"Informative & Factual"},{value:"friendly",label:"Friendly & Casual"}]}]}],_e=[{value:5,label:"Every 5 min",cost:"~7.2 VCN/mo",desc:"Real-time monitoring"},{value:30,label:"Every 30 min",cost:"~1.2 VCN/mo",desc:"Near real-time"},{value:60,label:"Every hour",cost:"~0.6 VCN/mo",desc:"Standard automation"},{value:1440,label:"Once daily",cost:"~0.05 VCN/mo",desc:"Daily reports"}],p={read:"#34d399",medium:"#fbbf24",write:"#f87171"},Ce={read:"Read-only",medium:"Medium",write:"Write"};function Fe(C){const[v,y]=o("overview"),[g,w]=o([]),[M,$]=o(!0),[c,m]=o(1),[V,le]=o(""),[W,re]=o("deepseek-chat"),[R,F]=o(""),[E,G]=o(60),[U,Y]=o([]),[u,oe]=o(""),[r,J]=o({}),[se,Ve]=o(5),[T,k]=o(!1),[I,h]=o(""),[q,K]=o(""),[Z,P]=o(""),[b,ie]=o([]),z=ee(()=>N.find(e=>e.id===u())),X=ee(()=>{const e=E(),t=720*60/e,l=z()?.costVcn||.05;return(t*l).toFixed(1)}),Q=e=>{oe(e),Y([e]);const t=N.find(a=>a.id===e);if(t){const a={};t.settingsFields.forEach(l=>{a[l.key]=l.defaultValue}),J(a),F(t.defaultPrompt)}},x=(e,t)=>{J(a=>({...a,[e]:t}))},ce=(e,t)=>{const a=r()[e]||[];a.includes(t)?x(e,a.filter(l=>l!==t)):x(e,[...a,t])};ye(async()=>{await de()});const de=async()=>{$(!0);try{const e=localStorage.getItem("vcn_agent_api_key");if(e){const a=await(await fetch(f,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"profile",api_key:e})})).json();a.success&&a.agent&&w([{agent_name:a.agent.agent_name,api_key:e,wallet_address:a.agent.wallet_address,status:a.agent.hosting?.enabled?"active":"setup",llm_model:a.agent.hosting?.llm_model||"deepseek-chat",system_prompt:a.agent.hosting?.system_prompt||"",trigger_type:"interval",interval_minutes:a.agent.hosting?.trigger?.interval_minutes||60,allowed_actions:a.agent.hosting?.allowed_actions||[],total_vcn_spent:a.agent.hosting?.total_vcn_spent||0,execution_count:a.agent.hosting?.execution_count||0,last_execution:a.agent.hosting?.last_execution||null,vcn_balance:a.agent.balance_vcn||a.agent.balance||"0"}])}}catch(e){console.error("[AgentHosting] Failed to load agents:",e)}$(!1)},pe=async()=>{if(V().trim()){k(!0),h("");try{const t=await(await fetch(f,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"register",agent_name:V().trim(),platform:"visionchain-hosting",owner_email:C.userEmail()})})).json();if(t.success&&t.agent){localStorage.setItem("vcn_agent_api_key",t.agent.api_key),w([{agent_name:t.agent.agent_name,api_key:t.agent.api_key,wallet_address:t.agent.wallet_address,status:"setup",llm_model:"deepseek-chat",system_prompt:"",trigger_type:"interval",interval_minutes:60,allowed_actions:[],total_vcn_spent:0,execution_count:0,last_execution:null,vcn_balance:"100"}]),m(2);const a=C.userEmail();a&&ve().then(l=>{l.agent_create>0&&we(a,l.agent_create,"agent_create",t.agent.agent_name).catch(()=>{})}).catch(()=>{})}else h(t.error||"Registration failed")}catch(e){h(e.message||"Network error")}k(!1)}},ge=async()=>{const e=g()[0];if(!e){h("No agent found. Please register first.");return}k(!0),h("");try{console.log("[AgentHosting] Configuring hosting for:",e.agent_name);const a=await(await fetch(f,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"configure_hosting",api_key:e.api_key,llm_model:W(),system_prompt:R(),trigger:{type:"interval",interval_minutes:E()},allowed_actions:U(),max_vcn_per_action:se(),action_settings:r(),selected_action:u()})})).json();if(console.log("[AgentHosting] Configure response:",a),!a.success){h(a.error||"Failed to configure hosting"),k(!1);return}console.log("[AgentHosting] Enabling hosting...");const i=await(await fetch(f,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"toggle_hosting",api_key:e.api_key,enabled:!0})})).json();console.log("[AgentHosting] Toggle response:",i),i.success?(w(s=>s.map(j=>j.agent_name===e.agent_name?{...j,status:"active",llm_model:W(),system_prompt:R(),interval_minutes:E(),allowed_actions:U()}:j)),y("overview")):h(i.error||"Failed to enable hosting")}catch(t){console.error("[AgentHosting] Failed to start agent:",t),h(t.message||"Network error during deployment")}k(!1)},me=async(e,t)=>{const a=g().find(i=>i.agent_name===e);if(!a)return;const l=t==="active"?"paused":"active";try{await fetch(f,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"toggle_hosting",api_key:a.api_key,enabled:l==="active"})}),w(i=>i.map(s=>s.agent_name===e?{...s,status:l}:s))}catch(i){console.error("[AgentHosting] Toggle failed:",i)}},ue=async e=>{const t=g().find(a=>a.agent_name===e);if(t){K(e);try{(await(await fetch(f,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"delete_agent",api_key:t.api_key})})).json()).success&&(w(g().filter(i=>i.agent_name!==e)),localStorage.removeItem("vcn_agent_api_key"),P(""),m(1))}catch(a){console.error("[AgentHosting] Delete failed:",a)}K("")}},D=async()=>{const e=g()[0];if(e)try{const a=await(await fetch(f,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"hosting_logs",api_key:e.api_key,limit:50})})).json();a.success&&a.logs&&ie(a.logs)}catch(t){console.error("[AgentHosting] Failed to load logs:",t)}};return React.createElement("div",{class:"flex-1 overflow-y-auto p-4 lg:p-8"},React.createElement("div",{class:"max-w-5xl mx-auto space-y-8 text-gray-300"},React.createElement("style",null,`

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
            `),React.createElement(fe,{tag:"AI Hosting",title:"VISION",titleAccent:"AGENT",description:"Create autonomous AI agents that run on Vision Chain's infrastructure. No server needed -- powered by VCN tokens.",icon:_}),React.createElement("div",{class:"ah-tabs"},React.createElement("button",{class:`ah-tab ${v()==="overview"?"active":""}`,onClick:()=>y("overview")},React.createElement(_,{class:"w-4 h-4"})," My Agents"),React.createElement("button",{class:`ah-tab ${v()==="setup"?"active":""}`,onClick:()=>y("setup")},React.createElement(O,{class:"w-4 h-4"})," Setup"),React.createElement("button",{class:`ah-tab ${v()==="logs"?"active":""}`,onClick:()=>{y("logs"),D()}},React.createElement(A,{class:"w-4 h-4"})," Logs")),React.createElement(n,{when:v()==="overview"},React.createElement(n,{when:M()},React.createElement("div",{class:"ah-card",style:"text-align: center; padding: 40px;"},React.createElement(H,{class:"w-6 h-6 text-cyan-400 animate-spin",style:"margin: 0 auto 12px;"}),React.createElement("p",{style:"color: #94a3b8; font-size: 13px;"},"Loading agents..."))),React.createElement(n,{when:!M()&&g().length===0},React.createElement("div",{class:"ah-card ah-empty-state"},React.createElement("div",{class:"ah-empty-icon"},React.createElement(_,{class:"w-10 h-10 text-cyan-400"})),React.createElement("h2",{class:"ah-empty-title"},"No Agents Yet"),React.createElement("p",{class:"ah-empty-desc"},"Deploy your first autonomous AI agent on Vision Chain. It runs 24/7, makes decisions, and executes on-chain actions -- all powered by VCN."),React.createElement("button",{class:"ah-btn-primary",onClick:()=>y("setup")},React.createElement(L,{class:"w-4 h-4"})," Create Agent"),React.createElement("div",{class:"ah-fee-breakdown",style:"max-width: 380px; margin: 24px auto 0;"},React.createElement("div",{class:"ah-fee-row"},React.createElement("span",{class:"ah-fee-label"},"Read-only (balance, network, leaderboard)"),React.createElement("span",{class:"ah-fee-value"},"0.05 VCN")),React.createElement("div",{class:"ah-fee-row"},React.createElement("span",{class:"ah-fee-label"},"Medium (transactions query)"),React.createElement("span",{class:"ah-fee-value"},"0.1 VCN")),React.createElement("div",{class:"ah-fee-row"},React.createElement("span",{class:"ah-fee-label"},"On-chain write (transfer, stake, unstake)"),React.createElement("span",{class:"ah-fee-value"},"0.5 VCN")),React.createElement("div",{class:"ah-fee-divider"}),React.createElement("div",{class:"ah-fee-row"},React.createElement("span",{class:"ah-fee-label"},"Initial funding"),React.createElement("span",{class:"ah-fee-value",style:"color: #34d399;"},"100 VCN FREE"))))),React.createElement(n,{when:!M()&&g().length>0},React.createElement(d,{each:g()},e=>{const t=()=>e.execution_count>0?Math.round((e.execution_count-e.error_count||0)/e.execution_count*100):0,a=()=>{if(!e.last_execution)return"Never";const s=Date.now()-new Date(e.last_execution).getTime();return s<6e4?"Just now":s<36e5?`${Math.floor(s/6e4)}m ago`:s<864e5?`${Math.floor(s/36e5)}h ago`:`${Math.floor(s/864e5)}d ago`},l=()=>Math.min(100,parseFloat(e.vcn_balance)/100*100),i=()=>{const s=parseFloat(e.vcn_balance);return s>20?"#34d399":s>5?"#fbbf24":"#f87171"};return React.createElement("div",{class:"ah-agent-card"},React.createElement("div",{class:"ah-agent-header"},React.createElement("div",{class:"ah-agent-name"},React.createElement(_,{class:"w-5 h-5 text-cyan-400"}),e.agent_name,React.createElement("span",{class:`ah-status-badge ah-status-${e.status}`},e.status==="active"&&React.createElement(React.Fragment,null,React.createElement(B,{class:"w-3 h-3"})," Running"),e.status==="paused"&&React.createElement(React.Fragment,null,React.createElement(ne,{class:"w-3 h-3"})," Paused"),e.status==="setup"&&React.createElement(React.Fragment,null,React.createElement(O,{class:"w-3 h-3"})," Setup"),e.status==="error"&&React.createElement(React.Fragment,null,React.createElement(te,{class:"w-3 h-3"})," Error"),e.status==="insufficient_balance"&&React.createElement(React.Fragment,null,React.createElement(te,{class:"w-3 h-3"})," Low Balance"))),React.createElement("div",{style:"display: flex; gap: 8px; align-items: center;"},React.createElement("button",{class:`ah-toggle-btn ${e.status==="active"?"ah-toggle-active":"ah-toggle-paused"}`,onClick:()=>me(e.agent_name,e.status)},e.status==="active"?React.createElement(React.Fragment,null,React.createElement(ne,{class:"w-3.5 h-3.5"})," Pause"):React.createElement(React.Fragment,null,React.createElement(B,{class:"w-3.5 h-3.5"})," Start")))),React.createElement("div",{style:"display: flex; align-items: center; gap: 6px; margin-bottom: 12px; padding: 8px 12px; background: rgba(6,182,212,0.05); border: 1px solid rgba(6,182,212,0.15); border-radius: 8px;"},React.createElement("span",{style:"font-size: 11px; color: #64748b; white-space: nowrap;"},"Wallet:"),React.createElement("span",{style:"font-size: 11px; color: #e2e8f0; font-family: monospace; overflow: hidden; text-overflow: ellipsis;"},e.wallet_address),React.createElement("button",{style:"flex-shrink: 0; background: none; border: none; cursor: pointer; padding: 2px; color: #64748b;",onClick:()=>{navigator.clipboard.writeText(e.wallet_address)},title:"Copy address"},React.createElement(Re,{class:"w-3.5 h-3.5"}))),React.createElement("div",{style:"margin-bottom: 16px;"},React.createElement("div",{style:"display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;"},React.createElement("span",{style:"font-size: 12px; color: #94a3b8; font-weight: 600;"},"VCN Balance"),React.createElement("span",{style:`font-size: 14px; font-weight: 800; color: ${i()};`},parseFloat(e.vcn_balance).toFixed(2)," VCN")),React.createElement("div",{style:"height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;"},React.createElement("div",{style:`height: 100%; width: ${l()}%; background: ${i()}; border-radius: 3px; transition: width 0.5s ease;`}))),React.createElement("div",{class:"ah-stats-grid"},React.createElement("div",{class:"ah-stat"},React.createElement("div",{class:"ah-stat-value"},e.execution_count),React.createElement("div",{class:"ah-stat-label"},"Executions")),React.createElement("div",{class:"ah-stat"},React.createElement("div",{class:"ah-stat-value"},e.total_vcn_spent.toFixed(1)),React.createElement("div",{class:"ah-stat-label"},"VCN Spent")),React.createElement("div",{class:"ah-stat"},React.createElement("div",{class:"ah-stat-value",style:"color: #34d399;"},t(),"%"),React.createElement("div",{class:"ah-stat-label"},"Success Rate")),React.createElement("div",{class:"ah-stat"},React.createElement("div",{class:"ah-stat-value",style:"font-size: 14px;"},a()),React.createElement("div",{class:"ah-stat-label"},"Last Run"))),React.createElement(n,{when:!0},React.createElement("div",{style:"margin-top: 16px; padding: 16px; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid rgba(255,255,255,0.04);"},React.createElement("div",{style:"font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;"},"Configuration"),React.createElement("div",{style:"display: grid; grid-template-columns: 1fr 1fr; gap: 8px;"},React.createElement("div",{style:"font-size: 12px;"},React.createElement("span",{style:"color: #64748b;"},"AI: "),React.createElement("span",{style:"color: #e2e8f0; font-weight: 600;"},"ZYNK AI")),React.createElement("div",{style:"font-size: 12px;"},React.createElement("span",{style:"color: #64748b;"},"Schedule: "),React.createElement("span",{style:"color: #e2e8f0; font-weight: 600;"},"Every ",e.interval_minutes,"min")),React.createElement("div",{style:"font-size: 12px; grid-column: span 2;"},React.createElement("span",{style:"color: #64748b;"},"Actions: "),React.createElement("span",{style:"color: #e2e8f0; font-weight: 600;"},e.allowed_actions.length>0?e.allowed_actions.join(", "):"None configured")),React.createElement(n,{when:e.system_prompt},React.createElement("div",{style:"font-size: 12px; grid-column: span 2;"},React.createElement("span",{style:"color: #64748b;"},"Prompt: "),React.createElement("span",{style:"color: #94a3b8; font-style: italic;"},e.system_prompt.length>80?e.system_prompt.substring(0,80)+"...":e.system_prompt)))),React.createElement("div",{style:"display: flex; gap: 8px; margin-top: 12px;"},React.createElement("button",{style:"padding: 6px 12px; background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.2); border-radius: 8px; color: #22d3ee; font-size: 11px; font-weight: 600; cursor: pointer;",onClick:()=>{m(2),y("setup"),re(e.llm_model),F(e.system_prompt),Y(e.allowed_actions),G(e.interval_minutes)}},React.createElement(O,{class:"w-3 h-3",style:"display: inline; vertical-align: middle; margin-right: 4px;"})," Edit Config"),React.createElement("button",{style:"padding: 6px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #94a3b8; font-size: 11px; font-weight: 600; cursor: pointer;",onClick:()=>{y("logs"),D()}},React.createElement(A,{class:"w-3 h-3",style:"display: inline; vertical-align: middle; margin-right: 4px;"})," View Logs")))),React.createElement("div",{style:"margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05);"},React.createElement(n,{when:Z()!==e.agent_name},React.createElement("button",{style:"padding: 6px 12px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); border-radius: 8px; color: #f87171; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;",onClick:()=>P(e.agent_name)},React.createElement(Ee,{class:"w-3 h-3"})," Delete Agent")),React.createElement(n,{when:Z()===e.agent_name},React.createElement("div",{style:"display: flex; align-items: center; gap: 8px;"},React.createElement("span",{style:"font-size: 11px; color: #f87171; font-weight: 600;"},"Permanently delete this agent?"),React.createElement("button",{style:"padding: 5px 12px; background: #ef4444; border: none; border-radius: 6px; color: white; font-size: 11px; font-weight: 700; cursor: pointer;",onClick:()=>ue(e.agent_name),disabled:q()===e.agent_name},q()===e.agent_name?"Deleting...":"Confirm"),React.createElement("button",{style:"padding: 5px 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #94a3b8; font-size: 11px; cursor: pointer;",onClick:()=>P("")},"Cancel")))))}))),React.createElement(n,{when:v()==="setup"},React.createElement("div",{class:"ah-step-indicator"},React.createElement("div",{class:`ah-step-dot ${c()===1?"active":c()>1?"done":""}`}),React.createElement("div",{class:`ah-step-dot ${c()===2?"active":c()>2?"done":""}`}),React.createElement("div",{class:`ah-step-dot ${c()===3?"active":c()>3?"done":""}`}),React.createElement("div",{class:`ah-step-dot ${c()===4?"active":""}`})),React.createElement(n,{when:c()===1},React.createElement("div",{class:"ah-card"},React.createElement("div",{class:"ah-card-title"},React.createElement(_,{class:"w-5 h-5 text-cyan-400"}),"Step 1: Create Your Agent"),React.createElement("div",{style:"margin-bottom: 16px;"},React.createElement("label",{class:"ah-label"},"Agent Name"),React.createElement("input",{type:"text",class:"ah-input",placeholder:"e.g. my-trading-bot",value:V(),onInput:e=>le(e.currentTarget.value)})),React.createElement("button",{class:"ah-btn-primary",disabled:!V().trim()||T(),onClick:pe},T()?React.createElement(React.Fragment,null,React.createElement(H,{class:"w-4 h-4 animate-spin"})," Registering..."):React.createElement(React.Fragment,null,React.createElement(L,{class:"w-4 h-4"})," Register & Get 100 VCN")),React.createElement(n,{when:I()},React.createElement("div",{class:"ah-error"},I())))),React.createElement(n,{when:c()===2},React.createElement("div",{class:"ah-card"},React.createElement("div",{class:"ah-card-title"},React.createElement(L,{class:"w-5 h-5 text-cyan-400"}),"Step 2: Choose an Action"),React.createElement("p",{style:"font-size: 12px; color: #94a3b8; margin: -4px 0 16px; line-height: 1.5;"},"Select one action for your agent to perform. Each action has its own specialized configuration."),React.createElement("div",{style:"font-size: 11px; color: #64748b; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;"},"On-chain"),React.createElement("div",{style:"display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;"},React.createElement(d,{each:N.filter(e=>e.category==="on-chain")},e=>React.createElement("div",{style:{padding:"14px",background:u()===e.id?"rgba(34, 211, 238, 0.08)":"rgba(255,255,255,0.02)",border:u()===e.id?"1.5px solid rgba(34, 211, 238, 0.5)":"1px solid rgba(255,255,255,0.06)","border-radius":"10px",cursor:e.status==="coming_soon"?"not-allowed":"pointer",transition:"all 0.2s ease",opacity:e.status==="coming_soon"?"0.45":"1",position:"relative"},onClick:()=>e.status==="live"&&Q(e.id)},React.createElement("div",{style:"display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"},React.createElement("div",{style:"color: #22d3ee; flex-shrink: 0;",innerHTML:S[e.id]}),React.createElement("div",{style:"font-size: 13px; font-weight: 600; color: white;"},e.label)),React.createElement("div",{style:"font-size: 11px; color: #94a3b8; line-height: 1.4;"},e.desc),React.createElement("div",{style:"display: flex; align-items: center; gap: 6px; margin-top: 8px;"},React.createElement("span",{style:{"font-size":"10px",padding:"2px 6px","border-radius":"4px","font-weight":"600",background:`${p[e.costTier]}15`,color:p[e.costTier]}},e.costVcn," VCN"),React.createElement(n,{when:e.status==="coming_soon"},React.createElement("span",{style:"font-size: 10px; color: #64748b; font-weight: 500;"},"Coming Soon")))))),React.createElement("div",{style:"font-size: 11px; color: #a78bfa; margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;"},"Growth & Marketing"),React.createElement("div",{style:"display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px;"},React.createElement(d,{each:N.filter(e=>e.category==="growth")},e=>React.createElement("div",{style:{padding:"14px",background:u()===e.id?"rgba(167, 139, 250, 0.08)":"rgba(255,255,255,0.02)",border:u()===e.id?"1.5px solid rgba(167, 139, 250, 0.5)":"1px solid rgba(255,255,255,0.06)","border-radius":"10px",cursor:e.status==="coming_soon"?"not-allowed":"pointer",transition:"all 0.2s ease",opacity:e.status==="coming_soon"?"0.45":"1"},onClick:()=>e.status==="live"&&Q(e.id)},React.createElement("div",{style:"display: flex; align-items: center; gap: 8px; margin-bottom: 6px;"},React.createElement("div",{style:"color: #a78bfa; flex-shrink: 0;",innerHTML:S[e.id]}),React.createElement("div",{style:"font-size: 13px; font-weight: 600; color: white;"},e.label)),React.createElement("div",{style:"font-size: 11px; color: #94a3b8; line-height: 1.4;"},e.desc),React.createElement("div",{style:"display: flex; align-items: center; gap: 6px; margin-top: 8px;"},React.createElement("span",{style:{"font-size":"10px",padding:"2px 6px","border-radius":"4px","font-weight":"600",background:`${p[e.costTier]}15`,color:p[e.costTier]}},e.costVcn," VCN"))))),React.createElement("div",{style:"display: flex; gap: 8px; justify-content: flex-end;"},React.createElement("button",{class:"ah-tab",onClick:()=>m(1)},"Back"),React.createElement("button",{class:"ah-btn-primary",disabled:!u(),onClick:()=>m(3)},"Configure ",React.createElement(ae,{class:"w-4 h-4"}))))),React.createElement(n,{when:c()===3},React.createElement("div",{class:"ah-card"},React.createElement(n,{when:z()},e=>React.createElement(React.Fragment,null,React.createElement("div",{style:"display: flex; align-items: flex-start; gap: 12px; margin-bottom: 20px;"},React.createElement("div",{style:{width:"44px",height:"44px","border-radius":"12px",background:e().category==="on-chain"?"rgba(34, 211, 238, 0.1)":"rgba(167, 139, 250, 0.1)",border:`1px solid ${e().category==="on-chain"?"rgba(34, 211, 238, 0.2)":"rgba(167, 139, 250, 0.2)"}`,display:"flex","align-items":"center","justify-content":"center","flex-shrink":"0",color:e().category==="on-chain"?"#22d3ee":"#a78bfa"},innerHTML:S[e().id]}),React.createElement("div",null,React.createElement("div",{style:"font-size: 16px; font-weight: 700; color: white;"},e().label),React.createElement("div",{style:"font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: 2px;"},e().longDesc))),React.createElement("div",{style:{display:"inline-flex","align-items":"center",gap:"6px",padding:"4px 10px","border-radius":"6px","margin-bottom":"20px",background:`${p[e().costTier]}10`,border:`1px solid ${p[e().costTier]}30`}},React.createElement("span",{style:{"font-size":"10px",color:"#94a3b8","font-weight":"600","text-transform":"uppercase"}},Ce[e().costTier]),React.createElement("span",{style:{"font-size":"12px",color:p[e().costTier],"font-weight":"700"}},e().costVcn," VCN / execution")),React.createElement(n,{when:e().settingsFields.length>0},React.createElement("div",{style:"display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px;"},React.createElement(d,{each:e().settingsFields},t=>React.createElement("div",null,React.createElement("label",{class:"ah-label",style:"margin-bottom: 4px;"},t.label,React.createElement(n,{when:t.unit},React.createElement("span",{style:"font-size: 10px; color: #64748b; margin-left: 4px;"},"(",t.unit,")"))),React.createElement(n,{when:t.desc},React.createElement("div",{style:"font-size: 11px; color: #64748b; margin-bottom: 6px;"},t.desc)),React.createElement(n,{when:t.type==="number"},React.createElement("input",{type:"number",class:"ah-input",style:"max-width: 200px;",placeholder:t.placeholder,value:r()[t.key]??t.defaultValue,onInput:a=>x(t.key,Number(a.currentTarget.value)),min:t.min,max:t.max})),React.createElement(n,{when:t.type==="text"},React.createElement("input",{type:"text",class:"ah-input",placeholder:t.placeholder,value:r()[t.key]??"",onInput:a=>x(t.key,a.currentTarget.value)})),React.createElement(n,{when:t.type==="address"},React.createElement("input",{type:"text",class:"ah-input",style:"font-family: 'SF Mono', Monaco, monospace; font-size: 12px;",placeholder:t.placeholder,value:r()[t.key]??"",onInput:a=>x(t.key,a.currentTarget.value)})),React.createElement(n,{when:t.type==="textarea"},React.createElement("textarea",{class:"ah-textarea",style:"min-height: 72px;",placeholder:t.placeholder,value:r()[t.key]??"",onInput:a=>x(t.key,a.currentTarget.value)})),React.createElement(n,{when:t.type==="select"},React.createElement("div",{style:"display: flex; flex-wrap: wrap; gap: 6px;"},React.createElement(d,{each:t.options},a=>React.createElement("button",{style:{padding:"6px 14px","border-radius":"8px","font-size":"12px","font-weight":r()[t.key]===a.value?"600":"400",cursor:"pointer",border:r()[t.key]===a.value?"1px solid rgba(34, 211, 238, 0.4)":"1px solid rgba(255,255,255,0.08)",background:r()[t.key]===a.value?"rgba(34, 211, 238, 0.1)":"rgba(255,255,255,0.03)",color:r()[t.key]===a.value?"#22d3ee":"#94a3b8",transition:"all 0.2s ease"},onClick:()=>x(t.key,a.value)},a.label)))),React.createElement(n,{when:t.type==="toggle"},React.createElement("div",{style:{display:"flex","align-items":"center",gap:"10px",cursor:"pointer",padding:"8px 14px","border-radius":"8px",background:r()[t.key]?"rgba(34, 211, 238, 0.08)":"rgba(255,255,255,0.03)",border:r()[t.key]?"1px solid rgba(34, 211, 238, 0.3)":"1px solid rgba(255,255,255,0.08)",transition:"all 0.2s ease","max-width":"fit-content"},onClick:()=>x(t.key,!r()[t.key])},React.createElement("div",{style:{width:"36px",height:"20px","border-radius":"10px",position:"relative",background:r()[t.key]?"#22d3ee":"rgba(255,255,255,0.15)",transition:"background 0.2s ease"}},React.createElement("div",{style:{width:"16px",height:"16px","border-radius":"50%",background:"white",position:"absolute",top:"2px",left:r()[t.key]?"18px":"2px",transition:"left 0.2s ease"}})),React.createElement("span",{style:{"font-size":"12px",color:r()[t.key]?"#22d3ee":"#94a3b8","font-weight":"500"}},r()[t.key]?"Enabled":"Disabled"))),React.createElement(n,{when:t.type==="multi-select"},React.createElement("div",{style:"display: flex; flex-wrap: wrap; gap: 6px;"},React.createElement(d,{each:t.options},a=>{const l=()=>(r()[t.key]||[]).includes(a.value);return React.createElement("button",{style:{padding:"6px 14px","border-radius":"8px","font-size":"12px","font-weight":l()?"600":"400",cursor:"pointer",border:l()?"1px solid rgba(34, 211, 238, 0.4)":"1px solid rgba(255,255,255,0.08)",background:l()?"rgba(34, 211, 238, 0.1)":"rgba(255,255,255,0.03)",color:l()?"#22d3ee":"#94a3b8",transition:"all 0.2s ease"},onClick:()=>ce(t.key,a.value)},a.label)}))))))),React.createElement("div",{style:"margin-bottom: 16px;"},React.createElement("label",{class:"ah-label"},"System Prompt"),React.createElement("div",{style:"font-size: 11px; color: #64748b; margin-bottom: 6px;"},"Auto-generated from your action. Edit to customize agent behavior."),React.createElement("textarea",{class:"ah-textarea",style:"min-height: 64px;",value:R(),onInput:t=>F(t.currentTarget.value)})),React.createElement("div",{style:"display: flex; gap: 8px; justify-content: flex-end;"},React.createElement("button",{class:"ah-tab",onClick:()=>m(2)},"Back"),React.createElement("button",{class:"ah-btn-primary",disabled:!R().trim(),onClick:()=>m(4)},"Next ",React.createElement(ae,{class:"w-4 h-4"}))))))),React.createElement(n,{when:c()===4},React.createElement("div",{class:"ah-card"},React.createElement("div",{class:"ah-card-title"},React.createElement(A,{class:"w-5 h-5 text-cyan-400"}),"Step 4: Schedule & Deploy"),React.createElement(n,{when:z()},e=>React.createElement("div",{style:{display:"flex","align-items":"center",gap:"10px",padding:"10px 14px",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)","border-radius":"10px","margin-bottom":"20px"}},React.createElement("div",{style:{color:e().category==="on-chain"?"#22d3ee":"#a78bfa","flex-shrink":"0"},innerHTML:S[e().id]}),React.createElement("div",null,React.createElement("div",{style:"font-size: 13px; font-weight: 600; color: white;"},e().label),React.createElement("div",{style:"font-size: 11px; color: #94a3b8;"},e().desc)),React.createElement("span",{style:{"margin-left":"auto","font-size":"10px",padding:"2px 6px","border-radius":"4px","font-weight":"600",background:`${p[e().costTier]}15`,color:p[e().costTier]}},e().costVcn," VCN"))),React.createElement("div",{style:"margin-bottom: 20px;"},React.createElement("label",{class:"ah-label"},"Run Frequency"),React.createElement("div",{class:"ah-trigger-grid"},React.createElement(d,{each:_e},e=>React.createElement("div",{class:`ah-trigger-card ${E()===e.value?"selected":""}`,onClick:()=>G(e.value)},React.createElement("div",{class:"ah-trigger-label"},e.label),React.createElement("div",{class:"ah-trigger-cost"},e.cost))))),React.createElement("div",{class:"ah-cost-banner"},React.createElement("div",null,React.createElement("div",{class:"ah-cost-label"},"Estimated Monthly Cost"),React.createElement("div",{class:"ah-cost-value"},X(),React.createElement("span",{class:"ah-cost-unit"},"VCN/mo"))),React.createElement("div",{style:"text-align: right;"},React.createElement("div",{style:"font-size: 11px; color: #94a3b8;"},"Fee Distribution"),React.createElement("div",{style:"font-size: 12px; color: white; font-weight: 600;"},"70% Protocol / 30% Node Pool"))),React.createElement("div",{class:"ah-fee-breakdown"},React.createElement("div",{class:"ah-fee-row"},React.createElement("span",{class:"ah-fee-label"},"Cost per execution"),React.createElement("span",{class:"ah-fee-value"},z()?.costVcn||.05," VCN")),React.createElement("div",{class:"ah-fee-row"},React.createElement("span",{class:"ah-fee-label"},"Executions per month"),React.createElement("span",{class:"ah-fee-value"},Math.round(720*60/E()))),React.createElement("div",{class:"ah-fee-divider"}),React.createElement("div",{class:"ah-fee-row"},React.createElement("span",{class:"ah-fee-label"},"Your initial balance"),React.createElement("span",{class:"ah-fee-value",style:"color: #34d399;"},"100 VCN")),React.createElement("div",{class:"ah-fee-row"},React.createElement("span",{class:"ah-fee-label"},"Estimated runway"),React.createElement("span",{class:"ah-fee-value",style:"color: #22d3ee;"},Math.max(1,Math.floor(100/parseFloat(X()||"1")))," months"))),React.createElement("div",{style:"display: flex; flex-direction: column; gap: 8px; margin-top: 20px;"},React.createElement(n,{when:I()},React.createElement("div",{style:"padding: 8px 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #f87171; font-size: 12px;"},I())),React.createElement("div",{style:"display: flex; gap: 8px; justify-content: flex-end;"},React.createElement("button",{class:"ah-tab",onClick:()=>m(3)},"Back"),React.createElement("button",{class:"ah-btn-primary",onClick:ge,disabled:!R().trim()||!u()||T()},T()?"Deploying...":React.createElement(React.Fragment,null,React.createElement(B,{class:"w-4 h-4"})," Deploy Agent"))))))),React.createElement(n,{when:v()==="logs"},React.createElement(n,{when:b().length>0},React.createElement("div",{class:"ah-card",style:"margin-bottom: 16px;"},React.createElement("div",{style:"display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;"},React.createElement("div",{style:"font-size: 14px; font-weight: 700; color: white;"},"Execution History"),React.createElement("button",{style:"padding: 6px 12px; background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.2); border-radius: 8px; color: #22d3ee; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;",onClick:()=>D()},React.createElement(H,{class:"w-3 h-3"})," Refresh")),React.createElement("div",{style:"display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;"},React.createElement("div",{class:"ah-stat"},React.createElement("div",{class:"ah-stat-value"},b().length),React.createElement("div",{class:"ah-stat-label"},"Total Logs")),React.createElement("div",{class:"ah-stat"},React.createElement("div",{class:"ah-stat-value",style:"color: #34d399;"},b().filter(e=>e.status==="success").length),React.createElement("div",{class:"ah-stat-label"},"Success")),React.createElement("div",{class:"ah-stat"},React.createElement("div",{class:"ah-stat-value",style:"color: #f87171;"},b().filter(e=>e.status!=="success").length),React.createElement("div",{class:"ah-stat-label"},"Errors")),React.createElement("div",{class:"ah-stat"},React.createElement("div",{class:"ah-stat-value",style:"color: #fbbf24;"},b().reduce((e,t)=>e+(t.vcn_cost||0),0).toFixed(1)),React.createElement("div",{class:"ah-stat-label"},"VCN Total"))))),React.createElement(n,{when:b().length===0},React.createElement("div",{class:"ah-card",style:"text-align: center; padding: 40px;"},React.createElement(A,{class:"w-8 h-8 text-gray-600",style:"margin: 0 auto 12px;"}),React.createElement("p",{style:"color: #64748b; font-size: 13px;"},"No execution logs yet."),React.createElement("p",{style:"color: #475569; font-size: 12px; margin-top: 4px;"},"Logs will appear here once your agent starts running."))),React.createElement(n,{when:b().length>0},React.createElement(d,{each:b()},e=>React.createElement("div",{class:"ah-log-item",style:"flex-direction: column; gap: 8px;"},React.createElement("div",{style:"display: flex; align-items: flex-start; gap: 12px; width: 100%;"},React.createElement("div",{class:`ah-log-dot ${e.status==="success"?"ah-log-success":"ah-log-error"}`}),React.createElement("div",{style:"flex: 1; min-width: 0;"},React.createElement("div",{style:"display: flex; align-items: center; gap: 8px; margin-bottom: 2px;"},React.createElement("div",{class:"ah-log-time"},new Date(e.timestamp).toLocaleString()),React.createElement(n,{when:e.llm_model},React.createElement("span",{style:"font-size: 9px; padding: 2px 6px; background: rgba(6,182,212,0.1); border: 1px solid rgba(6,182,212,0.2); border-radius: 4px; color: #22d3ee; font-weight: 600;"},"ZYNK AI"))),React.createElement("div",{class:"ah-log-msg",style:"overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 500px;"},e.llm_response?e.llm_response.length>120?e.llm_response.substring(0,120)+"...":e.llm_response:e.error_message||"Execution completed")),React.createElement("div",{class:"ah-log-cost"},"-",(e.vcn_cost||0).toFixed(2)," VCN")),React.createElement(n,{when:e.actions_taken&&e.actions_taken.length>0},React.createElement("div",{style:"margin-left: 20px; display: flex; flex-wrap: wrap; gap: 4px;"},React.createElement(d,{each:e.actions_taken},t=>React.createElement("span",{style:"font-size: 10px; padding: 2px 8px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); border-radius: 4px; color: #818cf8; font-weight: 600;"},t))))))))))}export{Fe as default};
