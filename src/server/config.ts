import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_PORT = 8765;

export interface Config {
  port: number;
  home: string;
  token: string;
}

export function loadConfig(): Config {
  const rawPort = process.env.AI_BROWSER_PORT;
  let port = DEFAULT_PORT;
  if (rawPort !== undefined && rawPort !== "") {
    port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`AI_BROWSER_PORT must be a port number between 1 and 65535, got "${rawPort}".`);
    }
  }

  const home = process.env.AI_BROWSER_HOME || join(homedir(), ".ai-browser-agent");
  mkdirSync(home, { recursive: true });
  const tokenFile = join(home, "token");
  let token = existsSync(tokenFile) ? readFileSync(tokenFile, "utf8").trim() : "";
  if (!/^[0-9a-f]{64}$/.test(token)) {
    token = randomBytes(32).toString("hex");
    writeFileSync(tokenFile, token + "\n", { mode: 0o600 });
  }
  return { port, home, token };
}
