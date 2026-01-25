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
    }
];
