/* Minimal client for any OpenAI-compatible chat completions API.
   Streams the reply: headers arrive at once and text as it is written, so long
   generations (like a podcast script) never hit HTTP timeouts. */

import { Agent, setGlobalDispatcher } from "undici";

// Node's fetch gives up after 5 minutes without response headers or between body
// chunks. Some providers hold back long generations, so allow 15 minutes.
setGlobalDispatcher(new Agent({ headersTimeout: 900_000, bodyTimeout: 900_000 }));

export interface LlmConfig { endpoint: string; model: string; apiKey: string }

export function llmConfigFromEnv(env = process.env): LlmConfig {
  const missing = ["OPENAI_ENDPOINT", "MODEL", "API_KEY"].filter((k) => !env[k]);
  if (missing.length) throw new Error(`Set ${missing.join(", ")} (an OpenAI-compatible endpoint, model name and API key).`);
  return { endpoint: env.OPENAI_ENDPOINT!.replace(/\/+$/, ""), model: env.MODEL!, apiKey: env.API_KEY! };
}

export interface Message { role: "system" | "user" | "assistant"; content: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reads a streamed (server-sent events) reply, or a plain JSON one if the provider ignores streaming. */
async function readReply(res: Response): Promise<string> {
  if (!res.headers.get("content-type")?.includes("text/event-stream")) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }
  let text = "", buffer = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return text;
      try {
        const event = JSON.parse(payload);
        if (event.error) throw new Error(`AI stream error: ${JSON.stringify(event.error).slice(0, 200)}`);
        text += event.choices?.[0]?.delta?.content ?? "";
      } catch (e) {
        if ((e as Error).message.startsWith("AI stream error")) throw e;
        // ignore keep-alive comments and partial events
      }
    }
  }
  return text;
}

export async function chat(cfg: LlmConfig, messages: Message[], { timeoutMs = 900_000 } = {}): Promise<string> {
  let jsonMode = true;
  for (let attempt = 1; ; attempt++) {
    const retry = async (why: string) => {
      if (attempt >= 4) throw new Error(`AI request failed: ${why}`);
      console.warn(`  AI request failed (${why}); retrying in ${5 * attempt}s`);
      await sleep(5000 * attempt);
    };
    try {
      const res = await fetch(`${cfg.endpoint}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: 0.2,
          stream: true,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Some providers or models reject JSON mode; the prompts ask for JSON anyway.
      if (res.status === 400 && jsonMode) { jsonMode = false; continue; }
      // Rate limits and server errors are often temporary.
      if (res.status === 429 || res.status >= 500) { await retry(String(res.status)); continue; }
      if (!res.ok) throw new Error(`AI request failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
      const content = await readReply(res);
      if (!content.trim()) { await retry("empty reply"); continue; }
      return content;
    } catch (e) {
      const err = e as Error;
      if (err.message.startsWith("AI request failed")) throw err;
      // Timeouts and dropped connections are usually temporary too.
      const code = (err as { cause?: { code?: string } }).cause?.code;
      await retry(err.name === "TypeError" ? `connection${code ? ` ${code}` : ""}` : err.name);
    }
  }
}
