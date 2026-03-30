import process from "node:process";
import * as exec from "@actions/exec";

interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function execGit(
  args: string[],
  cwd: string,
  env?: Record<string, string>,
): Promise<ExecResult> {
  let stdout = "";
  let stderr = "";

  const exitCode = await exec.exec("git", args, {
    cwd,
    env: { ...process.env, ...env } as Record<string, string>,
    silent: true,
    listeners: {
      stdout: (data) => {
        stdout += data.toString();
      },
      stderr: (data) => {
        stderr += data.toString();
      },
    },
    ignoreReturnCode: true, // We handle errors ourselves
  });

  return { exitCode, stdout, stderr };
}
