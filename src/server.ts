import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
//import { StreamableHTTPServerTransport  } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs/promises"
import { CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";

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
}, async (params) => {
    try {
        const id = await createUser(params)
        return {
            content: [
                { type: "text", text: `User ${id} created successfully` }
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

server.resource("users", "users://all",
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

server.resource("user-details", new ResourceTemplate("users://{userId}/profile", { list: undefined }), {
    description: "Get a user's details from the database",
    title: "User Details",
    mimeType: "application/json",
},
    async (uri, { userId }) => {
        const users = await import("./data/users.json", {
            with: { type: "json" }
        }).then(m => m.default)

        const user = users.find(u => u.id === parseInt(userId as string))

        if (user == null) {
            return {
                contents: [
                    {
                        uri: uri.href,
                        text: JSON.stringify({ error: "User not found" }),
                        mimeType: "application/json",
                    }
                ]
            }
        }

        return {
            contents: [
                {
                    uri: uri.href,
                    text: JSON.stringify(user),
                    mimeType: "application/json",
                },
            ],
        }
    })

server.prompt("generate-fake-user", "Generate a fake user based on a given name", {
    name: z.string()
}, ({ name }) => {
    return {
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `Generate a fake user with the name ${name}. The user should have a realistic email, address, and phone number.`,
                }
            }
        ]
    }
})

server.tool("create-random-user", "Create a random user with fake data",
    {
        title: "Create Random User",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
    },
    async () => {
        const res = await server.server.request({
            method: "sampling/createMessage",
            params: {
                messages: [{
                    role: "user",
                    content: {
                        type: "text",
                        text: "Generate fake user data. The user should have a realistic name, email, address, and phone number. Return this data as a JSON object with no other text or formatter so it can be used with JSON.parse."
                    }
                }],
                maxTokens: 1024

            }
        }, CreateMessageResultSchema)

        if (res.content.type !== "text") {
            return {
                content: [{ type: "text", text: "Failed to generate user data" }],
            }
        }

        try {
            const fakeUser = JSON.parse(res.content.text
                .trim()
                .replace(/^```json/, "")
                .replace(/```$/, "")
                .trim()
            )

            const id = await createUser(fakeUser)
            return {
                content: [{ type: "text", text: `User ${id} created successfully` }],
            }
        } catch {
            return {
                content: [{ type: "text", text: "Failed to generate user data" }],
            }
        }
    }
)

async function listUsers() {
    const users = await import("./data/users.json", {
        with: { type: "json" }
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

    users.push({ id, ...user })

    fs.writeFile("./src/data/users.json", JSON.stringify(users, null, 2))

    return id
}

async function main() {


    const transport = new StdioServerTransport()
    await server.connect(transport)
}

main()