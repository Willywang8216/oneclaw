import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import { resolveUserStateDir } from "./constants";
import * as log from "./logger";

function workspaceDir(): string {
  return path.join(resolveUserStateDir(), "workspace");
}

function ensureDir(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

export function ensureBundledSkillsInstalled(): void {
  const srcSkillPath = path.join(app.getAppPath(), "assets", "skills", "math_regen", "SKILL.md");
  if (!fs.existsSync(srcSkillPath)) {
    return;
  }

  const ws = workspaceDir();
  ensureDir(ws);

  // 预创建 math-bank 目录，方便用户直接开始使用
  ensureDir(path.join(ws, "math-bank", "input"));
  ensureDir(path.join(ws, "math-bank", "output"));
  ensureDir(path.join(ws, "math-bank", "artifacts"));

  const destDir = path.join(ws, "skills", "math_regen");
  const destSkillPath = path.join(destDir, "SKILL.md");

  if (fs.existsSync(destSkillPath)) {
    return;
  }

  ensureDir(destDir);
  const content = fs.readFileSync(srcSkillPath, "utf-8");
  fs.writeFileSync(destSkillPath, content, "utf-8");
  log.info(`[bundled-skills] installed: ${destSkillPath}`);
}
