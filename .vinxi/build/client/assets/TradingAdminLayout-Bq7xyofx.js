import{c as d,$ as x,aQ as f,o as k,aT as w,n as E,e as t,F as R,b as v,aU as c,aS as y}from"./index-DYr5Ysoi.js";function j(g){const[a,r]=d(!1),[C,p]=d(null),[h,i]=d(!0),l=x(),n=f();k(()=>{const e=w(async s=>{if(!s){n("/trading-login",{replace:!0}),i(!1);return}if(await y(s.email||"")!=="admin"){await c(),n("/trading-login",{replace:!0}),i(!1);return}p(s),i(!1)});E(()=>e())});const b=async()=>{await c(),n("/trading-login",{replace:!0})},o=e=>e==="/trading-admin"?l.pathname==="/trading-admin":l.pathname.startsWith(e),u=[{id:"dashboard",label:"Dashboard",path:"/trading-admin",icon:"dashboard"},{id:"price",label:"Price Direction",path:"/trading-admin/price",icon:"trending"},{id:"spread",label:"Spread & Layers",path:"/trading-admin/spread",icon:"layers"},{id:"inventory",label:"Inventory",path:"/trading-admin/inventory",icon:"inventory"},{id:"risk",label:"Risk Controls",path:"/trading-admin/risk",icon:"shield"},{id:"action",label:"Market Operations",path:"/trading-admin/action",icon:"zap"},{id:"agents",label:"Trading Agents",path:"/trading-admin/agents",icon:"bot"},{id:"log",label:"Activity Log",path:"/trading-admin/log",icon:"log"}],m=e=>{switch(e){case"dashboard":return React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 18 18",fill:"none"},React.createElement("rect",{x:"2",y:"2",width:"6",height:"6",rx:"1.5",stroke:"currentColor","stroke-width":"1.5"}),React.createElement("rect",{x:"10",y:"2",width:"6",height:"6",rx:"1.5",stroke:"currentColor","stroke-width":"1.5"}),React.createElement("rect",{x:"2",y:"10",width:"6",height:"6",rx:"1.5",stroke:"currentColor","stroke-width":"1.5"}),React.createElement("rect",{x:"10",y:"10",width:"6",height:"6",rx:"1.5",stroke:"currentColor","stroke-width":"1.5"}));case"trending":return React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 18 18",fill:"none"},React.createElement("path",{d:"M2 14l4-4 3 3 7-7",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"}),React.createElement("path",{d:"M12 6h4v4",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"}));case"layers":return React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 18 18",fill:"none"},React.createElement("path",{d:"M9 2L2 6l7 4 7-4-7-4z",stroke:"currentColor","stroke-width":"1.5","stroke-linejoin":"round"}),React.createElement("path",{d:"M2 9l7 4 7-4",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"}),React.createElement("path",{d:"M2 12l7 4 7-4",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"}));case"inventory":return React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 18 18",fill:"none"},React.createElement("circle",{cx:"9",cy:"9",r:"7",stroke:"currentColor","stroke-width":"1.5"}),React.createElement("path",{d:"M9 5v4l3 2",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}));case"shield":return React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 18 18",fill:"none"},React.createElement("path",{d:"M9 2L3 5v4c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V5L9 2z",stroke:"currentColor","stroke-width":"1.5","stroke-linejoin":"round"}),React.createElement("path",{d:"M6.5 9l2 2 3.5-4",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"}));case"zap":return React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 18 18",fill:"none"},React.createElement("path",{d:"M10 2L3 10h5l-1 6 7-8H9l1-6z",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"}));case"bot":return React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 18 18",fill:"none"},React.createElement("rect",{x:"3",y:"5",width:"12",height:"10",rx:"2",stroke:"currentColor","stroke-width":"1.5"}),React.createElement("circle",{cx:"7",cy:"10",r:"1.5",fill:"currentColor"}),React.createElement("circle",{cx:"11",cy:"10",r:"1.5",fill:"currentColor"}),React.createElement("path",{d:"M9 2v3",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),React.createElement("circle",{cx:"9",cy:"2",r:"1",fill:"currentColor"}));case"log":return React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 18 18",fill:"none"},React.createElement("rect",{x:"3",y:"2",width:"12",height:"14",rx:"2",stroke:"currentColor","stroke-width":"1.5"}),React.createElement("path",{d:"M6 6h6M6 9h6M6 12h4",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}));default:return null}};return React.createElement(t,{when:!h(),fallback:React.createElement("div",{class:"trading-layout-loading"},React.createElement("div",{class:"trading-layout-spinner"}))},React.createElement("div",{class:"trading-layout-root"},React.createElement("div",{class:"trading-layout-mobile-header"},React.createElement("button",{onClick:()=>r(!a()),class:"trading-layout-hamburger"},React.createElement(t,{when:a(),fallback:React.createElement("svg",{width:"20",height:"20",viewBox:"0 0 20 20",fill:"none"},React.createElement("path",{d:"M3 5h14M3 10h14M3 15h14",stroke:"white","stroke-width":"1.5","stroke-linecap":"round"}))},React.createElement("svg",{width:"20",height:"20",viewBox:"0 0 20 20",fill:"none"},React.createElement("path",{d:"M5 5l10 10M15 5L5 15",stroke:"white","stroke-width":"1.5","stroke-linecap":"round"})))),React.createElement("span",{class:"trading-layout-mobile-title"},"Trading",React.createElement("span",{style:"color:#f59e0b"},"Control")),React.createElement("div",{style:"width:36px"})),React.createElement(t,{when:a()},React.createElement("div",{class:"trading-layout-overlay",onClick:()=>r(!1)})),React.createElement("aside",{class:`trading-layout-sidebar ${a()?"open":""}`},React.createElement("div",{class:"trading-layout-sidebar-inner"},React.createElement("div",{class:"trading-sidebar-accent-line"}),React.createElement("div",{class:"trading-sidebar-logo-section"},React.createElement("div",{class:"trading-sidebar-logo-bg"}),React.createElement("div",{class:"trading-sidebar-logo-content"},React.createElement("div",{class:"trading-sidebar-logo-icon"},React.createElement("svg",{width:"20",height:"20",viewBox:"0 0 20 20",fill:"none"},React.createElement("rect",{x:"2",y:"4",width:"16",height:"12",rx:"2",stroke:"white","stroke-width":"1.5"}),React.createElement("path",{d:"M5 10h2l1-3 1.5 6 1.5-4 1 2h2",stroke:"white","stroke-width":"1.2","stroke-linecap":"round","stroke-linejoin":"round"}))),React.createElement("span",{class:"trading-sidebar-logo-text"},"Trading",React.createElement("span",{style:"color:#f59e0b"},"Control")))),React.createElement("div",{class:"trading-sidebar-nav"},React.createElement("div",{class:"trading-sidebar-section-label"},"Operations"),React.createElement("nav",{class:"trading-sidebar-nav-items"},React.createElement(R,{each:u},e=>React.createElement(v,{href:e.path,onClick:()=>r(!1),class:`trading-sidebar-item ${o(e.path)?"active":""}`},React.createElement(t,{when:o(e.path)},React.createElement("div",{class:"trading-sidebar-item-indicator"})),React.createElement("span",{class:"trading-sidebar-item-icon"},m(e.icon)),React.createElement("span",{class:"trading-sidebar-item-label"},e.label),React.createElement(t,{when:o(e.path)},React.createElement("div",{class:"trading-sidebar-item-dot"})))))),React.createElement("div",{class:"trading-sidebar-bottom"},React.createElement("div",{class:"trading-sidebar-status-card"},React.createElement("div",{class:"trading-sidebar-status-header"},React.createElement("span",{class:"trading-sidebar-status-label"},"Engine Status"),React.createElement("div",{class:"trading-sidebar-status-indicator"},React.createElement("div",{class:"trading-sidebar-status-dot-green"}),React.createElement("span",{class:"trading-sidebar-status-text"},"Live"))),React.createElement("div",{class:"trading-sidebar-status-bar-wrap"},React.createElement("svg",{width:"14",height:"14",viewBox:"0 0 14 14",fill:"none"},React.createElement("path",{d:"M2 7h2l1-3 1.5 6 1.5-4 1 2h2",stroke:"#f59e0b","stroke-width":"1","stroke-linecap":"round",opacity:"0.5"})),React.createElement("div",{class:"trading-sidebar-status-bar"},React.createElement("div",{class:"trading-sidebar-status-bar-fill"})))),React.createElement("div",{class:"trading-sidebar-role-badge"},"Trading Operator"),React.createElement("button",{onClick:b,class:"trading-sidebar-logout"},React.createElement("svg",{width:"18",height:"18",viewBox:"0 0 18 18",fill:"none"},React.createElement("path",{d:"M7 2H4a2 2 0 00-2 2v10a2 2 0 002 2h3",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"}),React.createElement("path",{d:"M11 12l4-3-4-3",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round","stroke-linejoin":"round"}),React.createElement("path",{d:"M15 9H7",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round"})),React.createElement("span",null,"End Session"))))),React.createElement("main",{class:"trading-layout-main"},React.createElement("div",{class:"trading-layout-content"},g.children))),React.createElement("style",null,`
                .trading-layout-root {
                    min-height: 100vh;
                    background: #0a0808;
                    color: white;
                }
                .trading-layout-loading {
                    min-height: 100vh;
                    background: #0a0808;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .trading-layout-spinner {
                    width: 48px;
                    height: 48px;
                    border: 4px solid rgba(245,158,11,0.2);
                    border-top-color: #f59e0b;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                /* Mobile Header */
                .trading-layout-mobile-header {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 56px;
                    background: rgba(10,8,8,0.95);
                    backdrop-filter: blur(20px);
                    border-bottom: 1px solid rgba(245,158,11,0.08);
                    z-index: 50;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 16px;
                }
                .trading-layout-hamburger {
                    padding: 8px;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.05);
                    border: none;
                    cursor: pointer;
                    color: white;
                }
                .trading-layout-mobile-title {
                    font-size: 18px;
                    font-weight: 900;
                    font-style: italic;
                    text-transform: uppercase;
                    letter-spacing: -0.03em;
                }
                .trading-layout-overlay {
                    display: none;
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(4px);
                    z-index: 40;
                }

                /* Sidebar */
                .trading-layout-sidebar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    height: 100%;
                    width: 240px;
                    background: rgba(12,10,8,0.85);
                    backdrop-filter: blur(40px);
                    border-right: 1px solid rgba(245,158,11,0.08);
                    z-index: 50;
                    transform: translateX(0);
                    transition: transform 0.4s ease;
                }
                .trading-layout-sidebar-inner {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                }
                .trading-sidebar-accent-line {
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 1px;
                    height: 100%;
                    background: linear-gradient(to bottom, transparent, rgba(245,158,11,0.15), transparent);
                }
                .trading-sidebar-logo-section {
                    height: 68px;
                    display: flex;
                    align-items: center;
                    padding: 0 20px;
                    position: relative;
                    overflow: hidden;
                }
                .trading-sidebar-logo-bg {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to right, rgba(245,158,11,0.04), transparent);
                    opacity: 0.5;
                }
                .trading-sidebar-logo-content {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .trading-sidebar-logo-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 0 12px rgba(245,158,11,0.2);
                }
                .trading-sidebar-logo-text {
                    font-size: 16px;
                    font-weight: 900;
                    font-style: italic;
                    text-transform: uppercase;
                    letter-spacing: -0.03em;
                    color: white;
                }
                .trading-sidebar-nav {
                    flex: 1;
                    min-height: 0;
                    overflow-y: auto;
                    padding: 12px 10px;
                }
                .trading-sidebar-section-label {
                    padding: 0 12px;
                    margin-bottom: 12px;
                    font-size: 9px;
                    font-weight: 900;
                    color: rgba(255,255,255,0.25);
                    text-transform: uppercase;
                    letter-spacing: 0.2em;
                }
                .trading-sidebar-nav-items {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .trading-sidebar-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    border-radius: 12px;
                    color: rgba(255,255,255,0.45);
                    text-decoration: none;
                    transition: all 0.2s;
                    position: relative;
                    overflow: hidden;
                    font-size: 13px;
                    font-weight: 700;
                }
                .trading-sidebar-item:hover {
                    color: white;
                    background: rgba(255,255,255,0.03);
                }
                .trading-sidebar-item.active {
                    color: #f59e0b;
                    background: linear-gradient(to right, rgba(245,158,11,0.1), rgba(217,119,6,0.03));
                }
                .trading-sidebar-item-indicator {
                    position: absolute;
                    left: 0;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 3px;
                    height: 18px;
                    background: #f59e0b;
                    border-radius: 0 3px 3px 0;
                    box-shadow: 0 0 10px rgba(245,158,11,0.5);
                }
                .trading-sidebar-item-icon {
                    display: flex;
                    align-items: center;
                    transition: transform 0.2s;
                }
                .trading-sidebar-item:hover .trading-sidebar-item-icon {
                    transform: scale(1.1);
                }
                .trading-sidebar-item-label {
                    letter-spacing: -0.01em;
                }
                .trading-sidebar-item-dot {
                    margin-left: auto;
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                    background: #f59e0b;
                    box-shadow: 0 0 6px rgba(245,158,11,0.8);
                }

                /* Bottom */
                .trading-sidebar-bottom {
                    flex-shrink: 0;
                    padding: 14px;
                    border-top: 1px solid rgba(245,158,11,0.06);
                    background: rgba(12,10,8,0.4);
                }
                .trading-sidebar-status-card {
                    margin-bottom: 12px;
                    padding: 10px 12px;
                    border-radius: 12px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.04);
                }
                .trading-sidebar-status-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }
                .trading-sidebar-status-label {
                    font-size: 9px;
                    font-weight: 900;
                    color: rgba(255,255,255,0.3);
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                }
                .trading-sidebar-status-indicator {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .trading-sidebar-status-dot-green {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #22c55e;
                    animation: pulse 2s ease-in-out infinite;
                }
                .trading-sidebar-status-text {
                    font-size: 9px;
                    font-weight: 900;
                    color: #22c55e;
                    text-transform: uppercase;
                }
                .trading-sidebar-status-bar-wrap {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .trading-sidebar-status-bar {
                    flex: 1;
                    height: 4px;
                    background: rgba(255,255,255,0.04);
                    border-radius: 4px;
                    overflow: hidden;
                }
                .trading-sidebar-status-bar-fill {
                    height: 100%;
                    width: 85%;
                    background: linear-gradient(to right, #f59e0b, #d97706);
                    border-radius: 4px;
                }
                .trading-sidebar-role-badge {
                    margin-bottom: 10px;
                    padding: 8px 14px;
                    border-radius: 8px;
                    text-align: center;
                    font-size: 9px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.2em;
                    color: #f59e0b;
                    background: rgba(245,158,11,0.08);
                    border: 1px solid rgba(245,158,11,0.15);
                }
                .trading-sidebar-logout {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    border-radius: 12px;
                    background: none;
                    border: none;
                    color: rgba(239,68,68,0.6);
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .trading-sidebar-logout:hover {
                    color: #ef4444;
                    background: rgba(239,68,68,0.05);
                }

                /* Main */
                .trading-layout-main {
                    margin-left: 240px;
                    min-height: 100vh;
                }
                .trading-layout-content {
                    padding: 24px 28px;
                }

                @media (max-width: 1024px) {
                    .trading-layout-mobile-header {
                        display: flex;
                    }
                    .trading-layout-overlay {
                        display: block;
                    }
                    .trading-layout-sidebar {
                        transform: translateX(-100%);
                    }
                    .trading-layout-sidebar.open {
                        transform: translateX(0);
                        box-shadow: 0 0 40px rgba(245,158,11,0.1);
                    }
                    .trading-layout-main {
                        margin-left: 0;
                        padding-top: 56px;
                    }
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `))}export{j as default};
