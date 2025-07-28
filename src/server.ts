import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
//import { StreamableHTTPServerTransport  } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs/promises"

const server = new McpServer({
    name: "MCP Server",
    version: "1.0.0",
    description: "A simple MCP server",
    capabilities: {
        capabilities: {
            resources: {},
            tools: {},
            propmpts: {},
        }
    }
})

server.tool("create-user", "Create a new user in the database", {
    name: z.string(),
    email: z.string().email(),
    address: z.string(),
    phone: z.string()
}, {
    openWorldHint: true,
    destructiveHint: false,
    idempotentHint: false,
    readOnlyHint: false,
    title: "Create a new user in the database",
    description: "Create a new user in the database",
}, async(params) => {
    try {
        const id = await createUser(params)
        return {
            content: [
                {type:"text", text: `User ${id} created successfully`}
            ]
        }

    } catch {
        return {
            content: [{
                type: "text",
                text: "Error creating user"
            }]
        }
        }
    }
)

server.resource(
    "users",
    "users://all",
    {
        description: "Get all users data from database",
        title: "Users",
        mimeType: "application/json",
    },
    async uri => {
        const users = await import("./data/users.json", {
            with: { type: "json" }
        }).then(m => m.default)

        return {
            contents: [
                {
                    uri: uri.href,
                    text: JSON.stringify(users),
                    mimeType: "application/json",
                },
            ],
        }
    }
)

async function listUsers() {
    const users = await import ("./data/users.json", {
        with: {type: "json"}
    }).then(m => m.default)

    return JSON.stringify(users)
}

async function createUser(user: {
    name: string,
    email: string,
    address: string,
    phone: string
}) {
    const users = await import("./data/users.json", {
        with: { type: "json" }
    }).then(m => m.default)

    const id = users.length + 1

    users.push({id, ...user})

    fs.writeFile("./src/data/users.json", JSON.stringify(users, null, 2))

    return id
}

async function main() {

    
    const transport = new StdioServerTransport()
    await server.connect(transport)
}

main()