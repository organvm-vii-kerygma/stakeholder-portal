/**
 * File Reader Service
 *
 * Thin read-only service with security boundaries for on-demand
 * workspace file access. Only active when ORGANVM_WORKSPACE_DIR
 * exists on disk (local dev / VPS). Automatically disabled on Vercel.
 */

import * as fs from "fs";
import * as path from "path";
import { getManifest } from "./manifest";
import { getOrganOrgDir as getOrganDir } from "./organs";

const WORKSPACE =
  process.env.ORGANVM_WORKSPACE_DIR ||
  path.join(/* turbopackIgnore: true */ process.env.HOME || "", "Workspace");

const BLOCKED_DIRS = [".git", "node_modules", "__pycache__", ".venv", "venv", ".tox"];
const BLOCKED_FILES = [".env", ".env.local", ".env.production"];
const MAX_FILE_SIZE = 50 * 1024; // 50KB

export interface FileReadResult {
  content: string;
  path: string;
  repo: string;
  sizeBytes: number;
  truncated: boolean;
}

export interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
  sizeBytes?: number;
}

export interface DirectoryListResult {
  entries: DirectoryEntry[];
  path: string;
  repo: string;
}

/**
 * Whether on-demand file access is available (workspace exists on disk).
 */
export function isFileAccessAvailable(): boolean {
  return fs.existsSync(/* turbopackIgnore: true */ WORKSPACE);
}

/**
 * Resolve a repo name to its filesystem path, validating it exists in manifest.
 */
function resolveRepoPath(repoName: string): string | null {
  const manifest = getManifest();
  const repo = manifest.repos.find(
    (r) => r.name === repoName || r.slug === repoName
  );
  if (!repo) return null;

  const organDir = getOrganDir(repo.organ);
  if (!organDir) return null;

  const repoPath = path.join(/* turbopackIgnore: true */ WORKSPACE, organDir, repo.name);
  if (!fs.existsSync(/* turbopackIgnore: true */ repoPath)) return null;

  return repoPath;
}

/**
 * Security: validate the resolved path stays within the repo directory.
 */
function validatePath(repoPath: string, relativePath: string): string | null {
  const resolved = path.resolve(repoPath, relativePath);
  if (!resolved.startsWith(repoPath + path.sep) && resolved !== repoPath) {
    return null; // Path traversal attempt
  }

  // Check blocklist
  const segments = relativePath.split(path.sep);
  for (const seg of segments) {
    if (BLOCKED_DIRS.includes(seg)) return null;
  }

  const basename = path.basename(relativePath);
  if (BLOCKED_FILES.includes(basename)) return null;

  return resolved;
}

/**
 * Read a file from a repo in the workspace.
 */
export function readFile(repoName: string, relativePath: string): FileReadResult | null {
  if (!isFileAccessAvailable()) return null;

  const repoPath = resolveRepoPath(repoName);
  if (!repoPath) return null;

  const fullPath = validatePath(repoPath, relativePath);
  if (!fullPath) return null;

  if (!fs.existsSync(/* turbopackIgnore: true */ fullPath)) return null;

  const stat = fs.statSync(/* turbopackIgnore: true */ fullPath);
  if (!stat.isFile()) return null;

  let content: string;
  let truncated = false;

  if (stat.size > MAX_FILE_SIZE) {
    const buffer = Buffer.alloc(MAX_FILE_SIZE);
    const fd = fs.openSync(/* turbopackIgnore: true */ fullPath, "r");
    fs.readSync(fd, buffer, 0, MAX_FILE_SIZE, 0);
    fs.closeSync(fd);
    content = buffer.toString("utf-8");
    truncated = true;
  } else {
    content = fs.readFileSync(/* turbopackIgnore: true */ fullPath, "utf-8");
  }

  // Binary file check: if content has null bytes, skip
  if (content.includes("\0")) return null;

  return {
    content,
    path: relativePath,
    repo: repoName,
    sizeBytes: stat.size,
    truncated,
  };
}

/**
 * List contents of a directory within a repo.
 */
export function listDirectory(repoName: string, relativePath: string): DirectoryListResult | null {
  if (!isFileAccessAvailable()) return null;

  const repoPath = resolveRepoPath(repoName);
  if (!repoPath) return null;

  const fullPath = validatePath(repoPath, relativePath || ".");
  if (!fullPath) return null;

  if (
    !fs.existsSync(/* turbopackIgnore: true */ fullPath) ||
    !fs.statSync(/* turbopackIgnore: true */ fullPath).isDirectory()
  ) return null;

  const dirEntries = fs.readdirSync(/* turbopackIgnore: true */ fullPath);
  const entries: DirectoryEntry[] = [];

  for (const entry of dirEntries) {
    if (BLOCKED_DIRS.includes(entry) || entry.startsWith(".")) continue;

    const entryPath = path.join(/* turbopackIgnore: true */ fullPath, entry);
    try {
      const stat = fs.statSync(/* turbopackIgnore: true */ entryPath);
      entries.push({
        name: entry,
        type: stat.isDirectory() ? "directory" : "file",
        sizeBytes: stat.isFile() ? stat.size : undefined,
      });
    } catch {
      // Skip inaccessible entries
    }
  }

  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { entries, path: relativePath || ".", repo: repoName };
}
