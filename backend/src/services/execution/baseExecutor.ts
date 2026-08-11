import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { CodeExecutionRequest, ExecutionResult } from './types';

// Maximum output size in bytes (1 MB) to prevent memory exhaustion
const MAX_OUTPUT_SIZE = 1024 * 1024;

export abstract class BaseExecutor {
  protected abstract languageName: string;

  /**
   * Helper to create a temporary working directory.
   */
  protected async createTempDir(): Promise<string> {
    const baseTmpDir = path.join(os.tmpdir(), 'coding-platform-exec');
    if (!fs.existsSync(baseTmpDir)) {
      await fs.promises.mkdir(baseTmpDir, { recursive: true });
    }
    return await fs.promises.mkdtemp(path.join(baseTmpDir, 'run-'));
  }

  /**
   * Helper to recursively clean up a temporary working directory.
   */
  protected async cleanupTempDir(tempDir: string): Promise<void> {
    try {
      if (fs.existsSync(tempDir)) {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error(`Failed to clean up temp dir ${tempDir}:`, err);
    }
  }

  /**
   * Builds a sanitized environment for student program execution.
   * Strips all backend secrets (DATABASE_URL, JWT_SECRET, etc.).
   * Only passes safe system variables like PATH and LANG.
   */
  protected getSanitizedEnv(): Record<string, string> {
    const safeEnv: Record<string, string> = {};
    const allowedKeys = ['PATH', 'LANG', 'HOME', 'TEMP', 'TMP', 'USERPROFILE', 'SYSTEMROOT', 'COMSPEC'];
    for (const key of allowedKeys) {
      if (process.env[key]) {
        safeEnv[key] = process.env[key] as string;
      }
    }
    return safeEnv;
  }

  /**
   * Spawns a process safely with:
   * - Timeout protection (SIGKILL on expiry)
   * - Sanitized environment (no backend secrets)
   * - Output size limits (prevents memory exhaustion)
   * - Stdin piping for test input
   */
  protected runProcess(
    command: string,
    args: string[],
    options: {
      cwd: string;
      inputData?: string;
      timeLimitMs?: number;
    }
  ): Promise<{
    exitCode: number | null;
    stdout: string;
    stderr: string;
    executionTimeMs: number;
    isTimedOut: boolean;
    isOutputTruncated: boolean;
  }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timeLimitMs = options.timeLimitMs || 3000;
      let isTimedOut = false;
      let isOutputTruncated = false;
      let stdoutData = '';
      let stderrData = '';
      let stdoutSize = 0;
      let stderrSize = 0;

      const child = spawn(command, args, {
        cwd: options.cwd,
        windowsHide: true,
        env: this.getSanitizedEnv(),
      });

      const timer = setTimeout(() => {
        isTimedOut = true;
        child.kill('SIGKILL');
      }, timeLimitMs);

      if (options.inputData && child.stdin) {
        child.stdin.write(options.inputData);
        child.stdin.end();
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        const chunkStr = chunk.toString();
        stdoutSize += chunk.length;
        if (stdoutSize <= MAX_OUTPUT_SIZE) {
          stdoutData += chunkStr;
        } else {
          isOutputTruncated = true;
          child.kill('SIGKILL');
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        const chunkStr = chunk.toString();
        stderrSize += chunk.length;
        if (stderrSize <= MAX_OUTPUT_SIZE) {
          stderrData += chunkStr;
        }
      });

      child.on('error', (err) => {
        stderrData += err.message;
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const executionTimeMs = Date.now() - startTime;
        resolve({
          exitCode: code,
          stdout: stdoutData,
          stderr: stderrData,
          executionTimeMs,
          isTimedOut,
          isOutputTruncated,
        });
      });
    });
  }

  /**
   * Normalizes output strings for trimmed output matching.
   * Strips trailing whitespace per line and trims overall result.
   */
  protected normalizeOutput(str: string): string {
    return str
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
  }

  /**
   * Abstract method implemented by language executors.
   */
  public abstract execute(request: CodeExecutionRequest): Promise<ExecutionResult>;
}
