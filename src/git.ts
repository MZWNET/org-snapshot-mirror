import process from "node:process";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { buildAuthUrl, logWithPrefix } from "./utils.js";

interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function execGit(
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
    ignoreReturnCode: true,
  });

  return { exitCode, stdout, stderr };
}

export async function cloneMirror(
  sourceUrl: string,
  targetDir: string,
  logPrefix: string,
): Promise<void> {
  logWithPrefix(logPrefix, "Cloning mirror...");

  const result = await execGit(["clone", "--mirror", sourceUrl, targetDir], ".");

  if (result.exitCode !== 0) {
    throw new Error(`Failed to clone: ${result.stderr}`);
  }

  if (result.stderr) {
    logWithPrefix(logPrefix, result.stderr);
  }
}

export async function fetchLfs(
  repoDir: string,
  sourceUrl: string,
  logPrefix: string,
): Promise<void> {
  logWithPrefix(logPrefix, "Fetching LFS objects...");

  const result = await execGit(["lfs", "fetch", "--all", sourceUrl], repoDir);

  if (result.exitCode !== 0) {
    core.warning(`[${logPrefix}] LFS fetch warning: ${result.stderr}`);
  }
  else if (result.stderr) {
    logWithPrefix(logPrefix, result.stderr);
  }
}

interface BranchInfo {
  name: string;
  ref: string;
}

async function listBranches(repoDir: string): Promise<BranchInfo[]> {
  const result = await execGit(
    ["for-each-ref", "--format=%(refname)", "refs/heads/"],
    repoDir,
  );

  if (result.exitCode !== 0) {
    throw new Error(`Failed to list branches: ${result.stderr}`);
  }

  const branches: BranchInfo[] = [];
  for (const line of result.stdout.split("\n")) {
    const ref = line.trim();
    if (ref) {
      const name = ref.replace("refs/heads/", "");
      branches.push({ name, ref });
    }
  }

  return branches;
}

interface CommitInfo {
  authorName: string;
  authorEmail: string;
  authorDate: string;
  committerName: string;
  committerEmail: string;
  committerDate: string;
  message: string;
  tree: string;
}

async function getCommitInfo(
  repoDir: string,
  ref: string,
): Promise<CommitInfo> {
  // Get commit metadata
  const formatResult = await execGit(
    [
      "log",
      "-1",
      "--format=%an%n%ae%n%aI%n%cn%n%ce%n%cI%n%T",
      ref,
    ],
    repoDir,
  );

  if (formatResult.exitCode !== 0) {
    throw new Error(`Failed to get commit info: ${formatResult.stderr}`);
  }

  const lines = formatResult.stdout.trim().split("\n");

  // Get commit message separately to handle multi-line messages
  const messageResult = await execGit(
    ["log", "-1", "--format=%B", ref],
    repoDir,
  );

  if (messageResult.exitCode !== 0) {
    throw new Error(`Failed to get commit message: ${messageResult.stderr}`);
  }

  return {
    authorName: lines[0],
    authorEmail: lines[1],
    authorDate: lines[2],
    committerName: lines[3],
    committerEmail: lines[4],
    committerDate: lines[5],
    tree: lines[6],
    message: messageResult.stdout.trim(),
  };
}

async function createOrphanCommit(
  repoDir: string,
  commitInfo: CommitInfo,
): Promise<string> {
  const env = {
    GIT_AUTHOR_NAME: commitInfo.authorName,
    GIT_AUTHOR_EMAIL: commitInfo.authorEmail,
    GIT_AUTHOR_DATE: commitInfo.authorDate,
    GIT_COMMITTER_NAME: commitInfo.committerName,
    GIT_COMMITTER_EMAIL: commitInfo.committerEmail,
    GIT_COMMITTER_DATE: commitInfo.committerDate,
  };

  const result = await execGit(
    ["commit-tree", commitInfo.tree, "-m", commitInfo.message],
    repoDir,
    env,
  );

  if (result.exitCode !== 0) {
    throw new Error(`Failed to create orphan commit: ${result.stderr}`);
  }

  return result.stdout.trim();
}

export async function createSnapshotCommits(
  repoDir: string,
  logPrefix: string,
): Promise<void> {
  logWithPrefix(logPrefix, "Creating snapshot commits...");

  const branches = await listBranches(repoDir);
  logWithPrefix(logPrefix, `Found ${branches.length} branches`);

  for (const branch of branches) {
    const commitInfo = await getCommitInfo(repoDir, branch.ref);
    const newCommitHash = await createOrphanCommit(repoDir, commitInfo);

    // Update the branch ref to point to the new orphan commit
    const updateResult = await execGit(
      ["update-ref", branch.ref, newCommitHash],
      repoDir,
    );

    if (updateResult.exitCode !== 0) {
      throw new Error(
        `Failed to update ref ${branch.ref}: ${updateResult.stderr}`,
      );
    }

    logWithPrefix(
      logPrefix,
      `Snapshot created for branch '${branch.name}': ${newCommitHash.substring(0, 8)}`,
    );
  }
}

export async function pushToTarget(
  repoDir: string,
  targetUrl: string,
  username: string,
  password: string,
  logPrefix: string,
): Promise<void> {
  logWithPrefix(logPrefix, "Pushing to target...");

  const authUrl = buildAuthUrl(targetUrl, username, password);

  // Add remote
  await execGit(["remote", "add", "target", authUrl], repoDir);

  // Configure LFS locksverify for this remote
  await execGit(["config", `lfs.${targetUrl}/info/lfs.locksverify`, "true"], repoDir);

  // Push branches
  const pushResult = await execGit(
    ["push", "target", "--force", "refs/heads/*:refs/heads/*", "refs/tags/*:refs/tags/*"],
    repoDir,
  );

  if (pushResult.exitCode !== 0) {
    throw new Error(`Failed to push: ${pushResult.stderr}`);
  }

  if (pushResult.stderr) {
    logWithPrefix(logPrefix, pushResult.stderr);
  }
}

export async function pushLfs(
  repoDir: string,
  logPrefix: string,
): Promise<void> {
  logWithPrefix(logPrefix, "Pushing LFS objects...");

  const result = await execGit(["lfs", "push", "--all", "target"], repoDir);

  if (result.exitCode !== 0) {
    core.warning(`[${logPrefix}] LFS push warning: ${result.stderr}`);
  }
  else if (result.stderr) {
    logWithPrefix(logPrefix, result.stderr);
  }
}

export async function installLfs(): Promise<void> {
  const installResult = await execGit(["lfs", "install"], ".");
  if (installResult.exitCode !== 0) {
    core.warning(`LFS install warning: ${installResult.stderr}`);
  }

  const configResult = await execGit(["config", "--global", "lfs.locksverify", "true"], ".");
  if (configResult.exitCode !== 0) {
    core.warning(`LFS config warning: ${configResult.stderr}`);
  }
}
