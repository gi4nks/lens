/**
 * Orchestration Engine - executes multi-step command plans from AI responses.
 *
 * When an AI response contains JSON with "orchestration_plan": ["cmd1", "cmd2", ...],
 * this engine executes the commands sequentially with error handling.
 */

export interface OrchestrationPlan {
  orchestration_plan: string[];
}

export class OrchestrationEngine {
  /**
   * Try to extract an orchestration plan from AI response text.
   * Looks for JSON block with "orchestration_plan" key.
   */
  static extractPlan(responseText: string): string[] | null {
    // 1. Try JSON extraction first (most precise)
    try {
      // Find JSON block with orchestration_plan key (look for balanced braces or just the block)
      const jsonRegex = /\{[\s\S]*"orchestration_plan"[\s\S]*\}/;
      const jsonMatch = responseText.match(jsonRegex);
      if (jsonMatch) {
        const obj = JSON.parse(jsonMatch[0]);
        if (Array.isArray(obj.orchestration_plan)) {
          return obj.orchestration_plan.map((c: unknown) => typeof c === 'string' ? c.trim() : String(c).trim()).filter(Boolean);
        }
      }
    } catch {
      // JSON parsing failed, fallback to code blocks
    }

    // 2. Fallback: extract commands from markdown code blocks (```bash or ```)
    const codeBlockRegex = /```(?:bash|sh|zsh)?\n([\s\S]*?)```/g;
    const commands: string[] = [];
    let match;
    while ((match = codeBlockRegex.exec(responseText)) !== null) {
      const blockContent = match[1].trim();
      // Split by newline and add each non-empty line as a command
      const lines = blockContent.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
      commands.push(...lines);
    }

    return commands.length > 0 ? commands : null;
  }

  /**
   * Execute a plan of commands sequentially.
   * Yields { command, status, message } for each step.
   */
  static async *executePlan(
    plan: string[],
    executor: (cmd: string) => Promise<{ exitCode: number; output: string }>
  ): AsyncGenerator<{ command: string; exitCode: number; output: string }> {
    for (const cmd of plan) {
      const result = await executor(cmd);
      yield { command: cmd, ...result };
      // Stop on first error
      if (result.exitCode !== 0) {
        break;
      }
    }
  }
}
