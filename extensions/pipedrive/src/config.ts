import path from "node:path";
import { loadJsonFile, writeJsonFileAtomically } from "openclaw/plugin-sdk/json-store";

export const PIPEDRIVE_BASE_URL = "https://api.pipedrive.com/v1";

export type PipedriveConfig = {
  apiToken: string;
};

function resolveConfigPath(): string {
  const stateDir =
    process.env.OPENCLAW_STATE_DIR?.trim() || path.join(process.env.HOME ?? "~", ".openclaw");
  const credDir = process.env.OPENCLAW_OAUTH_DIR?.trim() || path.join(stateDir, "credentials");
  return path.join(credDir, "pipedrive.json");
}

export function loadPipedriveConfig(): PipedriveConfig | undefined {
  const envToken = process.env.PIPEDRIVE_API_TOKEN?.trim();
  if (envToken) return { apiToken: envToken };
  return loadJsonFile<PipedriveConfig>(resolveConfigPath());
}

export async function savePipedriveConfig(config: PipedriveConfig): Promise<void> {
  await writeJsonFileAtomically(resolveConfigPath(), config);
}
