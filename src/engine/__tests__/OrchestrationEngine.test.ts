import { describe, it, expect } from 'vitest';
import { OrchestrationEngine } from '../OrchestrationEngine.js';

describe('OrchestrationEngine', () => {
  describe('extractPlan', () => {
    it('should extract orchestration_plan from JSON block', () => {
      const response = `Here is the plan:
{
  "orchestration_plan": ["git status", "ls -l"]
}`;
      const plan = OrchestrationEngine.extractPlan(response);
      expect(plan).toEqual(['git status', 'ls -l']);
    });

    it('should extract commands from markdown bash block', () => {
      const response = `Run this:
\`\`\`bash
echo "hello"
date
\`\`\``;
      const plan = OrchestrationEngine.extractPlan(response);
      expect(plan).toEqual(['echo "hello"', 'date']);
    });

    it('should return null if no plan is found', () => {
      const response = `No plan here.`;
      const plan = OrchestrationEngine.extractPlan(response);
      expect(plan).toBeNull();
    });
  });
});
