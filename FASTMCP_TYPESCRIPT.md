THE FOLLOWING ARE INSTRUCTIONS FOR YOU TO COMPLY AND FOLLOW WHEN BUILDING AN MCP SERVER WITH FASTMCP TYPESCRIPT

FastMCP
A TypeScript framework for building MCP servers capable of handling client sessions.

Note

For a Python implementation, see FastMCP.

Features
Simple Tool, Resource, Prompt definition
Authentication
Sessions
Image content
Audio content
Logging
Error handling
SSE
CORS (enabled by default)
Progress notifications
Typed server events
Prompt argument auto-completion
Sampling
Automated SSE pings
Roots
CLI for testing and debugging
Installation
npm install fastmcp
Quickstart
Note

There are many real-world examples of using FastMCP in the wild. See the Showcase for examples.

import { FastMCP } from "fastmcp";
import { z } from "zod"; // Or any validation library that supports Standard Schema

const server = new FastMCP({
  name: "My Server",
  version: "1.0.0",
});

server.addTool({
  name: "add",
  description: "Add two numbers",
  parameters: z.object({
    a: z.number(),
    b: z.number(),
  }),
  execute: async (args) => {
    return String(args.a + args.b);
  },
});

server.start({
  transportType: "stdio",
});
That's it! You have a working MCP server.

You can test the server in terminal with:

git clone https://github.com/punkpeye/fastmcp.git
cd fastmcp

pnpm install
pnpm build

# Test the addition server example using CLI:
npx fastmcp dev src/examples/addition.ts
# Test the addition server example using MCP Inspector:
npx fastmcp inspect src/examples/addition.ts
SSE
Server-Sent Events (SSE) provide a mechanism for servers to send real-time updates to clients over an HTTPS connection. In the context of MCP, SSE is primarily used to enable remote MCP communication, allowing an MCP hosted on a remote machine to be accessed and relay updates over the network.

You can also run the server with SSE support:

server.start({
  transportType: "sse",
  sse: {
    endpoint: "/sse",
    port: 8080,
  },
});
This will start the server and listen for SSE connections on http://localhost:8080/sse.

You can then use SSEClientTransport to connect to the server:

import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const client = new Client(
  {
    name: "example-client",
    version: "1.0.0",
  },
  {
    capabilities: {},
  },
);

const transport = new SSEClientTransport(new URL(`http://localhost:8080/sse`));

await client.connect(transport);
Core Concepts
Tools
Tools in MCP allow servers to expose executable functions that can be invoked by clients and used by LLMs to perform actions.

FastMCP uses the Standard Schema specification for defining tool parameters. This allows you to use your preferred schema validation library (like Zod, ArkType, or Valibot) as long as it implements the spec.

Zod Example:

import { z } from "zod";

server.addTool({
  name: "fetch-zod",
  description: "Fetch the content of a url (using Zod)",
  parameters: z.object({
    url: z.string(),
  }),
  execute: async (args) => {
    return await fetchWebpageContent(args.url);
  },
});
ArkType Example:

import { type } from "arktype";

server.addTool({
  name: "fetch-arktype",
  description: "Fetch the content of a url (using ArkType)",
  parameters: type({
    url: "string",
  }),
  execute: async (args) => {
    return await fetchWebpageContent(args.url);
  },
});
Valibot Example:

Valibot requires the peer dependency @valibot/to-json-schema.

import * as v from "valibot";

server.addTool({
  name: "fetch-valibot",
  description: "Fetch the content of a url (using Valibot)",
  parameters: v.object({
    url: v.string(),
  }),
  execute: async (args) => {
    return await fetchWebpageContent(args.url);
  },
});
Returning a string
execute can return a string:

server.addTool({
  name: "download",
  description: "Download a file",
  parameters: z.object({
    url: z.string(),
  }),
  execute: async (args) => {
    return "Hello, world!";
  },
});
The latter is equivalent to:

server.addTool({
  name: "download",
  description: "Download a file",
  parameters: z.object({
    url: z.string(),
  }),
  execute: async (args) => {
    return {
      content: [
        {
          type: "text",
          text: "Hello, world!",
        },
      ],
    };
  },
});
Returning a list
If you want to return a list of messages, you can return an object with a content property:

server.addTool({
  name: "download",
  description: "Download a file",
  parameters: z.object({
    url: z.string(),
  }),
  execute: async (args) => {
    return {
      content: [
        { type: "text", text: "First message" },
        { type: "text", text: "Second message" },
      ],
    };
  },
});
Returning an image
Use the imageContent to create a content object for an image:

import { imageContent } from "fastmcp";

server.addTool({
  name: "download",
  description: "Download a file",
  parameters: z.object({
    url: z.string(),
  }),
  execute: async (args) => {
    return imageContent({
      url: "https://example.com/image.png",
    });

    // or...
    // return imageContent({
    //   path: "/path/to/image.png",
    // });

    // or...
    // return imageContent({
    //   buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"),
    // });

    // or...
    // return {
    //   content: [
    //     await imageContent(...)
    //   ],
    // };
  },
});
The imageContent function takes the following options:

url: The URL of the image.
path: The path to the image file.
buffer: The image data as a buffer.
Only one of url, path, or buffer must be specified.

The above example is equivalent to:

server.addTool({
  name: "download",
  description: "Download a file",
  parameters: z.object({
    url: z.string(),
  }),
  execute: async (args) => {
    return {
      content: [
        {
          type: "image",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          mimeType: "image/png",
        },
      ],
    };
  },
});
Returning an audio
Use the audioContent to create a content object for an audio:

import { audioContent } from "fastmcp";

server.addTool({
  name: "download",
  description: "Download a file",
  parameters: z.object({
    url: z.string(),
  }),
  execute: async (args) => {
    return audioContent({
      url: "https://example.com/audio.mp3",
    });

    // or...
    // return audioContent({
    //   path: "/path/to/audio.mp3",
    // });

    // or...
    // return audioContent({
    //   buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"),
    // });

    // or...
    // return {
    //   content: [
    //     await audioContent(...)
    //   ],
    // };
  },
});
The audioContent function takes the following options:

url: The URL of the audio.
path: The path to the audio file.
buffer: The audio data as a buffer.
Only one of url, path, or buffer must be specified.

The above example is equivalent to:

server.addTool({
  name: "download",
  description: "Download a file",
  parameters: z.object({
    url: z.string(),
  }),
  execute: async (args) => {
    return {
      content: [
        {
          type: "audio",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          mimeType: "audio/mpeg",
        },
      ],
    };
  },
});
Return combination type
You can combine various types in this way and send them back to AI

server.addTool({
  name: "download",
  description: "Download a file",
  parameters: z.object({
    url: z.string(),
  }),
  execute: async (args) => {
    return {
      content: [
        {
          type: "text",
          text: "Hello, world!",
        },
        {
          type: "image",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          mimeType: "image/png",
        },
        {
          type: "audio",
          data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          mimeType: "audio/mpeg",
        },
      ],
    };
  },

  // or...
  // execute: async (args) => {
  //   const imgContent = imageContent({
  //     url: "https://example.com/image.png",
  //   });
  //   const audContent = audioContent({
  //     url: "https://example.com/audio.mp3",
  //   });
  //   return {
  //     content: [
  //       {
  //         type: "text",
  //         text: "Hello, world!",
  //       },
  //       imgContent,
  //       audContent,
  //     ],
  //   };
  // },
});
Logging
Tools can log messages to the client using the log object in the context object:

server.addTool({
  name: "download",
  description: "Download a file",
  parameters: z.object({
    url: z.string(),
  }),
  execute: async (args, { log }) => {
    log.info("Downloading file...", {
      url,
    });

    // ...

    log.info("Downloaded file");

    return "done";
  },
});
The log object has the following methods:

debug(message: string, data?: SerializableValue)
error(message: string, data?: SerializableValue)
info(message: string, data?: SerializableValue)
warn(message: string, data?: SerializableValue)
Errors
The errors that are meant to be shown to the user should be thrown as UserError instances:

import { UserError } from "fastmcp";

server.addTool({
  name: "download",
  description: "Download a file",
  parameters: z.object({
    url: z.string(),
  }),
  execute: async (args) => {
    if (args.url.startsWith("https://example.com")) {
      throw new UserError("This URL is not allowed");
    }

    return "done";
  },
});
Progress
Tools can report progress by calling reportProgress in the context object:

server.addTool({
  name: "download",
  description: "Download a file",
  parameters: z.object({
    url: z.string(),
  }),
  execute: async (args, { reportProgress }) => {
    reportProgress({
      progress: 0,
      total: 100,
    });

    // ...

    reportProgress({
      progress: 100,
      total: 100,
    });

    return "done";
  },
});
Tool Annotations
As of the MCP Specification (2025-03-26), tools can include annotations that provide richer context and control by adding metadata about a tool's behavior:

server.addTool({
  name: "fetch-content",
  description: "Fetch content from a URL",
  parameters: z.object({
    url: z.string(),
  }),
  annotations: {
    title: "Web Content Fetcher", // Human-readable title for UI display
    readOnlyHint: true, // Tool doesn't modify its environment
    openWorldHint: true, // Tool interacts with external entities
  },
  execute: async (args) => {
    return await fetchWebpageContent(args.url);
  },
});
The available annotations are:

Annotation	Type	Default	Description
title	string	-	A human-readable title for the tool, useful for UI display
readOnlyHint	boolean	false	If true, indicates the tool does not modify its environment
destructiveHint	boolean	true	If true, the tool may perform destructive updates (only meaningful when readOnlyHint is false)
idempotentHint	boolean	false	If true, calling the tool repeatedly with the same arguments has no additional effect (only meaningful when readOnlyHint is false)
openWorldHint	boolean	true	If true, the tool may interact with an "open world" of external entities
These annotations help clients and LLMs better understand how to use the tools and what to expect when calling them.

Resources
Resources represent any kind of data that an MCP server wants to make available to clients. This can include:

File contents
Screenshots and images
Log files
And more
Each resource is identified by a unique URI and can contain either text or binary data.

server.addResource({
  uri: "file:///logs/app.log",
  name: "Application Logs",
  mimeType: "text/plain",
  async load() {
    return {
      text: await readLogFile(),
    };
  },
});
Note

load can return multiple resources. This could be used, for example, to return a list of files inside a directory when the directory is read.

async load() {
  return [
    {
      text: "First file content",
    },
    {
      text: "Second file content",
    },
  ];
}
You can also return binary contents in load:

async load() {
  return {
    blob: 'base64-encoded-data'
  };
}
Resource templates
You can also define resource templates:

server.addResourceTemplate({
  uriTemplate: "file:///logs/{name}.log",
  name: "Application Logs",
  mimeType: "text/plain",
  arguments: [
    {
      name: "name",
      description: "Name of the log",
      required: true,
    },
  ],
  async load({ name }) {
    return {
      text: `Example log content for ${name}`,
    };
  },
});
Resource template argument auto-completion
Provide complete functions for resource template arguments to enable automatic completion:

server.addResourceTemplate({
  uriTemplate: "file:///logs/{name}.log",
  name: "Application Logs",
  mimeType: "text/plain",
  arguments: [
    {
      name: "name",
      description: "Name of the log",
      required: true,
      complete: async (value) => {
        if (value === "Example") {
          return {
            values: ["Example Log"],
          };
        }

        return {
          values: [],
        };
      },
    },
  ],
  async load({ name }) {
    return {
      text: `Example log content for ${name}`,
    };
  },
});
Prompts
Prompts enable servers to define reusable prompt templates and workflows that clients can easily surface to users and LLMs. They provide a powerful way to standardize and share common LLM interactions.

server.addPrompt({
  name: "git-commit",
  description: "Generate a Git commit message",
  arguments: [
    {
      name: "changes",
      description: "Git diff or description of changes",
      required: true,
    },
  ],
  load: async (args) => {
    return `Generate a concise but descriptive commit message for these changes:\n\n${args.changes}`;
  },
});
Prompt argument auto-completion
Prompts can provide auto-completion for their arguments:

server.addPrompt({
  name: "countryPoem",
  description: "Writes a poem about a country",
  load: async ({ name }) => {
    return `Hello, ${name}!`;
  },
  arguments: [
    {
      name: "name",
      description: "Name of the country",
      required: true,
      complete: async (value) => {
        if (value === "Germ") {
          return {
            values: ["Germany"],
          };
        }

        return {
          values: [],
        };
      },
    },
  ],
});
Prompt argument auto-completion using enum
If you provide an enum array for an argument, the server will automatically provide completions for the argument.

server.addPrompt({
  name: "countryPoem",
  description: "Writes a poem about a country",
  load: async ({ name }) => {
    return `Hello, ${name}!`;
  },
  arguments: [
    {
      name: "name",
      description: "Name of the country",
      required: true,
      enum: ["Germany", "France", "Italy"],
    },
  ],
});
Authentication
FastMCP allows you to authenticate clients using a custom function:

import { AuthError } from "fastmcp";

const server = new FastMCP({
  name: "My Server",
  version: "1.0.0",
  authenticate: ({ request }) => {
    const apiKey = request.headers["x-api-key"];

    if (apiKey !== "123") {
      throw new Response(null, {
        status: 401,
        statusText: "Unauthorized",
      });
    }

    // Whatever you return here will be accessible in the `context.session` object.
    return {
      id: 1,
    };
  },
});
Now you can access the authenticated session data in your tools:

server.addTool({
  name: "sayHello",
  execute: async (args, { session }) => {
    return `Hello, ${session.id}!`;
  },
});
Providing Instructions
You can provide instructions to the server using the instructions option:

const server = new FastMCP({
  name: "My Server",
  version: "1.0.0",
  instructions:
    'Instructions describing how to use the server and its features.\n\nThis can be used by clients to improve the LLM\'s understanding of available tools, resources, etc. It can be thought of like a "hint" to the model. For example, this information MAY be added to the system prompt.',
});
Sessions
The session object is an instance of FastMCPSession and it describes active client sessions.

server.sessions;
We allocate a new server instance for each client connection to enable 1:1 communication between a client and the server.

Typed server events
You can listen to events emitted by the server using the on method:

server.on("connect", (event) => {
  console.log("Client connected:", event.session);
});

server.on("disconnect", (event) => {
  console.log("Client disconnected:", event.session);
});
FastMCPSession
FastMCPSession represents a client session and provides methods to interact with the client.

Refer to Sessions for examples of how to obtain a FastMCPSession instance.

requestSampling
requestSampling creates a sampling request and returns the response.

await session.requestSampling({
  messages: [
    {
      role: "user",
      content: {
        type: "text",
        text: "What files are in the current directory?",
      },
    },
  ],
  systemPrompt: "You are a helpful file system assistant.",
  includeContext: "thisServer",
  maxTokens: 100,
});
clientCapabilities
The clientCapabilities property contains the client capabilities.

session.clientCapabilities;
loggingLevel
The loggingLevel property describes the logging level as set by the client.

session.loggingLevel;
roots
The roots property contains the roots as set by the client.

session.roots;
server
The server property contains an instance of MCP server that is associated with the session.

session.server;
Typed session events
You can listen to events emitted by the session using the on method:

session.on("rootsChanged", (event) => {
  console.log("Roots changed:", event.roots);
});

session.on("error", (event) => {
  console.error("Error:", event.error);
});
Running Your Server
Test with mcp-cli
The fastest way to test and debug your server is with fastmcp dev:

npx fastmcp dev server.js
npx fastmcp dev server.ts
This will run your server with mcp-cli for testing and debugging your MCP server in the terminal.

Inspect with MCP Inspector
Another way is to use the official MCP Inspector to inspect your server with a Web UI:

npx fastmcp inspect server.ts
FAQ
How to use with Claude Desktop?
Follow the guide https://modelcontextprotocol.io/quickstart/user and add the following configuration:

{
  "mcpServers": {
    "my-mcp-server": {
      "command": "npx",
      "args": ["tsx", "/PATH/TO/YOUR_PROJECT/src/index.ts"],
      "env": {
        "YOUR_ENV_VAR": "value"
      }
    }
  }
}

THE ABOVE ARE INSTRUCTIONS FOR YOU TO COMPLY AND FOLLOW WHEN BUILDING AN MCP SERVER WITH FASTMCP TYPESCRIPT