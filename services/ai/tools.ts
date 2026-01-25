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
        description: "Get the current price of a cryptocurrency in USD.",
        parameters: {
            type: "object",
            properties: {
                symbol: {
                    type: "string",
                    description: "The cryptocurrency symbol (e.g., 'btc', 'eth')."
                }
            },
            required: ["symbol"]
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
    }
];
