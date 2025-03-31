import Polka from "polka"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { z } from "zod"
import { gotScraping } from "got-scraping"
import { toMarkdown } from "./markdown"
import { YoutubeTranscript } from "./youtube"
import { toVideoTimestamp } from "./utils"

const server = new McpServer(
  {
    name: "fetch-mcp",
    version: "0.0.0",
  },
  {
    capabilities: {
      logging: {},
    },
  }
)

server.tool(
  "fetch_url",
  "Fetch a URL",
  {
    url: z.string().describe("The URL to fetch"),
    raw: z
      .boolean()
      .nullish()
      .describe("Return raw HTML instead of Markdown")
      .default(false),
    max_length: z
      .number()
      .default(2000)
      .describe("The max length of the content to return"),
    start_index: z
      .number()
      .default(0)
      .describe(`The starting index of content to return`),
  },
  async (args) => {
    const url = /^https?\:\/\//.test(args.url)
      ? args.url
      : `https://${args.url}`
    const res = await gotScraping(url)

    if (res.ok) {
      let content = args.raw ? res.body : toMarkdown(res.body)
      let remainingContentLength = 0

      if (args.start_index) {
        content = content.slice(args.start_index)
      }

      if (args.max_length) {
        const newContent = content.slice(0, args.max_length)
        if (newContent !== content) {
          remainingContentLength = content.length - newContent.length
        }
        content = newContent
      }

      return {
        content: [
          {
            type: "text",
            text: [
              `URL: ${url}`,
              `Start index: ${args.start_index}`,
              `Remaining content length: ${remainingContentLength}`,
              `Content: ${content}`,
            ].join("\n"),
          },
        ],
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Failed to fetch ${url}: ${res.statusCode}\n${res.body}`,
        },
      ],
      isError: true,
    }
  }
)

server.tool(
  "fetch_youtube_transcript",
  "Fetch transcript for a Youtube video URL",
  {
    url: z.string().describe("The Youtube video URL"),
  },
  async (args) => {
    const videoId = YoutubeTranscript.retrieveVideoId(args.url) || args.url

    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId)
      return {
        content: [
          {
            type: "text",
            text: [
              `Video title: ${transcript.title}`,
              `Transcript:`,
              ...transcript.lines.map((line) => {
                return `[${toVideoTimestamp(line.offset, line.duration)}] ${
                  line.text
                }`
              }),
            ].join("\n"),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      }
    }
  }
)

if (process.argv.includes("--sse")) {
  const transports = new Map<string, SSEServerTransport>()
  const port = Number(process.env.PORT || "3000")

  const app = Polka()

  app.get("/sse", async (req, res) => {
    const transport = new SSEServerTransport("/messages", res)
    transports.set(transport.sessionId, transport)
    res.on("close", () => {
      transports.delete(transport.sessionId)
    })
    await server.connect(transport)
  })

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string
    const transport = transports.get(sessionId)
    if (transport) {
      await transport.handlePostMessage(req, res)
    } else {
      res.status(400).send("No transport found for sessionId")
    }
  })

  app.listen(port)
  console.log(`sse server: http://localhost:${port}/sse`)
} else {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
