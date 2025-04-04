# fetch-mcp

An MCP server for fetching URLs / Youtube video transcript.

This project is sponsored by [ChatWise](https://chatwise.app), an all-in-one LLM chatbot with first-class MCP support.

## Usage

```bash
# stdio server
npx -y fetch-mcp

# sse server
npx -y fetch-mcp --sse

# streamable http server at /mcp
npx -y fetch-mcp --http
# custom endpoint
npx -y fetch-mcp --http /my-mcp
```

## Tools

### fetch_url

Fetch URL, can return HTML or Markdown (default).

### fetch_youtube_transcript

Fetch Youtube transcript.

## License

MIT.
