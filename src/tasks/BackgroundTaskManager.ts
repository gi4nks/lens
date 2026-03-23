import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import os from 'os';

export type TaskStatus = 'running' | 'done' | 'failed' | 'killed';

export interface BackgroundTask {
  id: string;
  label: string;
  command: string;
  cwd: string;
  status: TaskStatus;
  pid?: number;
  output: string[];
  startTime: number;
  endTime?: number;
  exitCode?: number;
}

const OUTPUT_CAP = 500;

function shortId(): string {
  return Math.random().toString(36).substring(2, 7);
}

class BackgroundTaskManager extends EventEmitter {
  private processes = new Map<string, ReturnType<typeof spawn>>();

  spawn(command: string, cwd: string, label?: string): BackgroundTask {
    const id = shortId();
    const task: BackgroundTask = {
      id,
      label: label || command.split(' ')[0],
      command,
      cwd,
      status: 'running',
      output: [],
      startTime: Date.now(),
    };

    this.emit('add', task);

    const shell = process.env.SHELL || '/bin/zsh';
    const child = spawn(shell, ['-c', command], {
      cwd,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (child.pid) {
      this.emit('update', id, { pid: child.pid });
    }

    this.processes.set(id, child);

    const onData = (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter((l) => l.length > 0);
      this.emit('output', id, lines);
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);

    child.on('close', (code, signal) => {
      this.processes.delete(id);
      const killed = signal === 'SIGTERM' || signal === 'SIGKILL';
      const status: TaskStatus = killed ? 'killed' : code === 0 ? 'done' : 'failed';
      this.emit('update', id, {
        status,
        exitCode: code ?? undefined,
        endTime: Date.now(),
      });
    });

    child.on('error', (err) => {
      this.processes.delete(id);
      this.emit('output', id, [`[error] ${err.message}`]);
      this.emit('update', id, { status: 'failed', endTime: Date.now() });
    });

    return task;
  }

  kill(id: string): boolean {
    const child = this.processes.get(id);
    if (!child) return false;
    child.kill('SIGTERM');
    return true;
  }

  isRunning(id: string): boolean {
    return this.processes.has(id);
  }

  killAll(): void {
    for (const [, child] of this.processes) {
      child.kill('SIGTERM');
    }
  }
}

export const taskManager = new BackgroundTaskManager();

// Wire task events → Zustand store lazily (avoids circular imports)
let storeWired = false;
export function wireTaskManagerToStore() {
  if (storeWired) return;
  storeWired = true;

  // Dynamic import to avoid circular dep at module load time
  import('../store/index.js').then(({ useAppStore }) => {
    taskManager.on('add', (task: BackgroundTask) => {
      useAppStore.setState((state) => ({
        backgroundTasks: [...state.backgroundTasks, task],
      }));
    });

    taskManager.on('output', (id: string, lines: string[]) => {
      useAppStore.setState((state) => {
        const tasks = state.backgroundTasks.map((t) => {
          if (t.id !== id) return t;
          const combined = [...t.output, ...lines];
          return { ...t, output: combined.slice(-OUTPUT_CAP) };
        });
        return { backgroundTasks: tasks };
      });
    });

    taskManager.on('update', (id: string, patch: Partial<BackgroundTask>) => {
      useAppStore.setState((state) => ({
        backgroundTasks: state.backgroundTasks.map((t) =>
          t.id === id ? { ...t, ...patch } : t
        ),
      }));
    });
  });
}

export function elapsedSeconds(task: BackgroundTask): number {
  const end = task.endTime ?? Date.now();
  return Math.floor((end - task.startTime) / 1000);
}

export function formatElapsed(task: BackgroundTask): string {
  const s = elapsedSeconds(task);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

export function homePath(fullPath: string): string {
  const home = os.homedir();
  return fullPath.startsWith(home) ? `~${fullPath.slice(home.length)}` : fullPath;
}
