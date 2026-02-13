export const AI_TOOLS = [
    {
        name: "get_historical_price",
        description: "Get the historical price of a cryptocurrency at a specific date.",
        parameters: {
            type: "object",
            properties: {
                symbol: {
                    type: "string",
                    description: "The cryptocurrency symbol (e.g., 'btc', 'eth', 'sol')."
                },
                date: {
                    type: "string",
                    description: "The date in 'DD-MM-YYYY' format (e.g., '31-12-2023')."
                }
            },
            required: ["symbol", "date"]
        }
    },
    {
        name: "get_current_price",
        description: "Get the REAL-TIME current price of a cryptocurrency in USD from CoinGecko. ALWAYS use this tool when the user asks for 'current', 'now', 'today', or 'live' price. Returns price, 24h change, volume, market cap, and rank.",
        parameters: {
            type: "object",
            properties: {
                symbol: {
                    type: "string",
                    description: "The cryptocurrency symbol (e.g., 'btc', 'eth', 'sol', 'xrp', 'doge')."
                }
            },
            required: ["symbol"]
        }
    },
    {
        name: "get_chart_data",
        description: "Get historical price chart data for a cryptocurrency over a specified period. Use this for showing price trends or generating graphs.",
        parameters: {
            type: "object",
            properties: {
                symbol: {
                    type: "string",
                    description: "The cryptocurrency symbol (e.g., 'btc', 'eth')."
                },
                days: {
                    type: "number",
                    description: "Number of days of historical data (e.g., 7, 14, 30, 90, 365). Default is 7."
                }
            },
            required: ["symbol"]
        }
    },
    {
        name: "get_trending_coins",
        description: "Get the top 10 trending cryptocurrencies on CoinGecko right now. Use when user asks about 'hot', 'trending', or 'popular' coins.",
        parameters: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "get_global_market",
        description: "Get global cryptocurrency market statistics including total market cap, 24h volume, BTC dominance, and number of active cryptocurrencies.",
        parameters: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "search_defi_pools",
        description: "Search for high-yield DeFi investment opportunities (Lending, Staking, LP).",
        parameters: {
            type: "object",
            properties: {
                symbol: {
                    type: "string",
                    description: "Filter by asset symbol (e.g., 'USDC', 'ETH')."
                },
                chain: {
                    type: "string",
                    description: "Filter by blockchain (e.g., 'Ethereum', 'Solana', 'Polygon')."
                },
                minTvl: {
                    type: "number",
                    description: "Minimum TVL in USD to filter out small/risky pools."
                }
            }
        }
    },
    {
        name: "analyze_protocol_risk",
        description: "Analyze the risk and security status of a specific DeFi protocol.",
        parameters: {
            type: "object",
            properties: {
                projectName: {
                    type: "string",
                    description: "The name of the protocol/project (e.g., 'Aave', 'Lido')."
                }
            },
            required: ["projectName"]
        }
    },
    {
        name: "search_user_contacts",
        description: "Search the user's personal contact list for names, emails, VIDs, or wallet addresses.",
        parameters: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    description: "The name or email of the contact to search for."
                }
            },
            required: ["name"]
        }
    },
    {
        name: "get_cex_portfolio",
        description: "Get the user's cryptocurrency portfolio data from their connected centralized exchanges (CEX) like Upbit and Bithumb. Returns asset holdings, balances, current prices, profit/loss, and allocation percentages. Use this tool when the user asks about their exchange portfolio, CEX holdings, investment performance, portfolio analysis, or wants AI-driven portfolio advice. The data includes KRW and USD values.",
        parameters: {
            type: "object",
            properties: {
                exchange: {
                    type: "string",
                    description: "Optional. Filter by specific exchange: 'upbit' or 'bithumb'. If omitted, returns aggregated data from all connected exchanges."
                }
            }
        }
    },
    {
        name: "create_agent",
        description: "Register a new AI agent on Vision Chain. Creates a wallet, funds it with 100 VCN, and returns the API key. Use this when the user wants to create/register an agent. Ask the user for agent_name and platform before calling. The agent_name must be unique, lowercase, alphanumeric with underscores.",
        parameters: {
            type: "object",
            properties: {
                agent_name: {
                    type: "string",
                    description: "Unique agent name (lowercase, alphanumeric, underscores only). e.g., 'my_trading_bot'"
                },
                platform: {
                    type: "string",
                    description: "Platform type: 'openai', 'anthropic', 'langchain', 'custom', etc."
                },
                owner_email: {
                    type: "string",
                    description: "Optional. Owner email for notifications."
                },
                referral_code: {
                    type: "string",
                    description: "Optional. Referral code from another agent or user for bonus RP."
                }
            },
            required: ["agent_name", "platform"]
        }
    },
    {
        name: "check_agent_balance",
        description: "Check an agent's VCN token balance and RP points on Vision Chain. Use this when the user asks about their agent's balance or wants to verify funding after registration.",
        parameters: {
            type: "object",
            properties: {
                api_key: {
                    type: "string",
                    description: "The agent's API key (starts with 'vcn_')."
                }
            },
            required: ["api_key"]
        }
    }
];
