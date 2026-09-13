/**
 * Local Workspace Connector
 *
 * Reads local filesystem: seed.yaml, CLAUDE.md, README.md, git history.
 * Supports incremental delta detection via file modification times.
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { createEnvelope } from "../ontology";
import type {
  ConnectorAdapter,
  ConnectorConfig,
  ConnectorState,
  IngestRecord,
} from "./types";

// ---------------------------------------------------------------------------
// Workspace connector
// ---------------------------------------------------------------------------

export class WorkspaceConnector implements ConnectorAdapter {
  readonly id = "workspace";
  readonly name = "Local Workspace";

  private config: ConnectorConfig | null = null;
  private state: ConnectorState = {
    status: "idle",
    last_run: null,
    records_ingested: 0,
    errors: 0,
    last_error: null,
  };

  private get workspaceDir(): string {
    return (this.config?.settings.workspace_dir as string)
      ?? process.env.ORGANVM_WORKSPACE_DIR
      ?? join(/* turbopackIgnore: true */ process.env.HOME || "/", "Workspace");
  }

  private get organDirs(): string[] {
    return (this.config?.settings.organ_dirs as string[]) ?? [
      "organvm-i-theoria",
      "organvm-ii-poiesis",
      "organvm-iii-ergon",
      "organvm-iv-taxis",
      "organvm-v-logos",
      "organvm-vi-koinonia",
      "organvm-vii-kerygma",
      "meta-organvm",
      "4444J99",
    ];
  }

  configure(config: ConnectorConfig): void {
    this.config = config;
  }

  getState(): ConnectorState {
    return { ...this.state };
  }

  async sync(options?: { incremental?: boolean; since?: string }): Promise<IngestRecord[]> {
    this.state.status = "running";
    const records: IngestRecord[] = [];
    const sinceDate = options?.since ? new Date(options.since) : null;

    try {
      for (const organDir of this.organDirs) {
        const organPath = join(/* turbopackIgnore: true */ this.workspaceDir, organDir);
        if (!existsSync(/* turbopackIgnore: true */ organPath)) continue;

        const entries = this.safeReaddir(organPath);
        for (const entry of entries) {
          const repoPath = join(/* turbopackIgnore: true */ organPath, entry);
          if (!this.isGitRepo(repoPath)) continue;

          // Check modification time for incremental sync
          if (sinceDate) {
            const mtime = this.getLatestModTime(repoPath);
            if (mtime && mtime < sinceDate) continue;
          }

          const repoRecords = this.readRepoData(entry, organDir, repoPath);
          records.push(...repoRecords);
        }
      }

      this.state.status = "completed";
      this.state.last_run = new Date().toISOString();
      this.state.records_ingested += records.length;
    } catch (error) {
      this.state.status = "error";
      this.state.errors += 1;
      this.state.last_error = error instanceof Error ? error.message : String(error);
    }

    return records;
  }

  // -------------------------------------------------------------------------
  // Repo data reading
  // -------------------------------------------------------------------------

  private readRepoData(
    repoName: string,
    organDir: string,
    repoPath: string
  ): IngestRecord[] {
    const records: IngestRecord[] = [];
    const now = new Date().toISOString();

    // Read seed.yaml
    const seed = this.readSeedYaml(repoPath);

    // Read CLAUDE.md or README.md for description
    const description = this.readDocFile(repoPath);

    // Get git stats
    const gitStats = this.getGitStats(repoPath);

    // Main repo record
    records.push({
      dedup_key: `workspace:repo:${organDir}/${repoName}`,
      entity_class: "repo",
      name: repoName,
      display_name: this.humanizeName(repoName),
      description: description.slice(0, 1000),
      attributes: {
        organ_dir: organDir,
        local_path: repoPath,
        ...seed,
        ...gitStats,
      },
      envelope: createEnvelope({
        source_id: `workspace:${organDir}`,
        source_type: "workspace",
        channel: "crawl",
        confidence: 1.0,
        valid_from: now,
      }),
      aliases: [repoName, this.humanizeName(repoName)],
      relationships: seed.produces
        ? (seed.produces as string[]).map((p: string) => ({
            type: "produces" as const,
            target_hint: `artifact:${p}`,
            strength: 0.9,
            evidence: `seed.yaml produces: ${p}`,
          }))
        : [],
    });

    // Document artifacts
    for (const docFile of ["CLAUDE.md", "README.md", "seed.yaml"]) {
      const docPath = join(/* turbopackIgnore: true */ repoPath, docFile);
      if (existsSync(/* turbopackIgnore: true */ docPath)) {
        const content = this.safeReadFile(docPath).slice(0, 2000);
        records.push({
          dedup_key: `workspace:doc:${organDir}/${repoName}/${docFile}`,
          entity_class: "artifact",
          name: `${repoName}-${docFile.replace(".", "-")}`,
          display_name: `${repoName}/${docFile}`,
          description: `${docFile} for ${repoName}`,
          attributes: {
            artifact_type: "doc",
            path: docPath,
            format: docFile.endsWith(".yaml") ? "yaml" : "markdown",
            content_preview: content,
          },
          envelope: createEnvelope({
            source_id: `workspace:${organDir}/${repoName}`,
            source_type: "workspace",
            channel: "crawl",
            confidence: 1.0,
          }),
          relationships: [
            {
              type: "references",
              target_hint: `repo:${repoName}`,
              strength: 1.0,
              evidence: `File ${docFile} in repo ${repoName}`,
            },
          ],
        });
      }
    }

    return records;
  }

  // -------------------------------------------------------------------------
  // File-level change detection for vector pipeline
  // -------------------------------------------------------------------------

  /**
   * Returns changed files across all repos since a given commit SHA per repo.
   * Used by the orchestrator to feed the incremental vector pipeline.
   */
  getChangedFilesByRepo(cursors: Map<string, string>): Map<string, { repoPath: string; organ: string; files: string[]; headSha: string }> {
    const result = new Map<string, { repoPath: string; organ: string; files: string[]; headSha: string }>();

    for (const organDir of this.organDirs) {
      const organPath = join(/* turbopackIgnore: true */ this.workspaceDir, organDir);
      if (!existsSync(/* turbopackIgnore: true */ organPath)) continue;

      const entries = this.safeReaddir(organPath);
      for (const entry of entries) {
        const repoPath = join(/* turbopackIgnore: true */ organPath, entry);
        if (!this.isGitRepo(repoPath)) continue;

        const headSha = this.getHeadSha(repoPath);
        if (!headSha) continue;

        const cursor = cursors.get(entry);
        if (cursor && cursor === headSha) continue; // no changes

        let files: string[];
        if (cursor) {
          files = this.getGitDiffFiles(repoPath, cursor);
        } else {
          // No cursor — treat as full sync (all embeddable files)
          files = this.walkEmbeddableFiles(repoPath);
        }

        if (files.length > 0) {
          result.set(entry, { repoPath, organ: organDir, files, headSha });
        }
      }
    }

    return result;
  }

  private getHeadSha(repoPath: string): string | null {
    try {
      return execSync("git rev-parse HEAD", {
        cwd: repoPath,
        encoding: "utf-8",
        timeout: 5000,
      }).trim() || null;
    } catch {
      return null;
    }
  }

  private getGitDiffFiles(repoPath: string, sinceSha: string): string[] {
    try {
      const output = execSync(`git diff --name-only ${sinceSha}..HEAD`, {
        cwd: repoPath,
        encoding: "utf-8",
        timeout: 10000,
      }).trim();
      return output.split("\n").filter(Boolean);
    } catch {
      // If SHA is gone, return all embeddable files
      return this.walkEmbeddableFiles(repoPath);
    }
  }

  private walkEmbeddableFiles(repoPath: string): string[] {
    const results: string[] = [];
    const walk = (dir: string) => {
      try {
        for (const file of readdirSync(/* turbopackIgnore: true */ dir)) {
          const full = join(/* turbopackIgnore: true */ dir, file);
          const stat = statSync(/* turbopackIgnore: true */ full);
          if (stat.isDirectory()) {
            if (!file.startsWith(".") && file !== "node_modules" && file !== "dist") {
              walk(full);
            }
          } else if (
            file.endsWith(".md") || file.endsWith(".yaml") || file.endsWith(".yml") ||
            file.endsWith(".ts") || file.endsWith(".py")
          ) {
            results.push(full.slice(repoPath.length + 1)); // relative path
          }
        }
      } catch { /* ignore */ }
    };
    walk(repoPath);
    return results;
  }

  // -------------------------------------------------------------------------
  // File helpers
  // -------------------------------------------------------------------------

  private readSeedYaml(repoPath: string): Record<string, unknown> {
    const seedPath = join(/* turbopackIgnore: true */ repoPath, "seed.yaml");
    if (!existsSync(/* turbopackIgnore: true */ seedPath)) return {};

    try {
      const content = readFileSync(/* turbopackIgnore: true */ seedPath, "utf-8");
      // Simple YAML key-value extraction (no dependency on yaml parser)
      const result: Record<string, unknown> = {};
      const lines = content.split("\n");
      let currentKey = "";
      const arrayValues: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        if (trimmed.startsWith("- ") && currentKey) {
          arrayValues.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ""));
          result[currentKey] = [...arrayValues];
          continue;
        }

        const match = trimmed.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
        if (match) {
          currentKey = match[1];
          arrayValues.length = 0;
          const val = match[2].trim().replace(/^["']|["']$/g, "");
          if (val) result[currentKey] = val;
        }
      }

      return result;
    } catch {
      return {};
    }
  }

  private readDocFile(repoPath: string): string {
    for (const name of ["CLAUDE.md", "README.md"]) {
      const p = join(/* turbopackIgnore: true */ repoPath, name);
      if (existsSync(/* turbopackIgnore: true */ p)) {
        const content = this.safeReadFile(p);
        // Extract "What This Is" section or first paragraph
        const whatMatch = content.match(
          /##\s*What This Is\s*\n+([\s\S]*?)(?=\n##|\n---|$)/i
        );
        if (whatMatch) return whatMatch[1].trim();

        // Fallback: first non-heading, non-empty paragraph
        const lines = content.split("\n").filter(
          (l) => l.trim() && !l.startsWith("#") && !l.startsWith("---")
        );
        return lines.slice(0, 5).join(" ").trim();
      }
    }
    return "";
  }

  private getGitStats(repoPath: string): Record<string, unknown> {
    try {
      const totalCommits = execSync("git rev-list --count HEAD 2>/dev/null", {
        cwd: repoPath,
        encoding: "utf-8",
        timeout: 5000,
      }).trim();

      const lastCommitDate = execSync(
        "git log -1 --format=%cI 2>/dev/null",
        { cwd: repoPath, encoding: "utf-8", timeout: 5000 }
      ).trim();

      return {
        total_commits: parseInt(totalCommits, 10) || 0,
        last_commit: lastCommitDate || null,
      };
    } catch {
      return {};
    }
  }

  private isGitRepo(path: string): boolean {
    try {
      const stat = statSync(/* turbopackIgnore: true */ path);
      if (!stat.isDirectory()) return false;
      return existsSync(
        /* turbopackIgnore: true */
        join(/* turbopackIgnore: true */ path, ".git"),
      );
    } catch {
      return false;
    }
  }

  private getLatestModTime(repoPath: string): Date | null {
    try {
      const gitDir = join(/* turbopackIgnore: true */ repoPath, ".git");
      if (existsSync(/* turbopackIgnore: true */ gitDir)) {
        return statSync(/* turbopackIgnore: true */ gitDir).mtime;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private humanizeName(name: string): string {
    return name
      .replace(/--/g, ": ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private safeReaddir(path: string): string[] {
    try {
      return readdirSync(/* turbopackIgnore: true */ path).filter(
        (e) => !e.startsWith("."),
      );
    } catch {
      return [];
    }
  }

  private safeReadFile(path: string): string {
    try {
      return readFileSync(/* turbopackIgnore: true */ path, "utf-8");
    } catch {
      return "";
    }
  }
}
