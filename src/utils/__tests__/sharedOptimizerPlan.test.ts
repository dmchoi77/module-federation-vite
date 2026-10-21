import { describe, expect, it } from 'vitest';
import {
  createSharedOptimizerPlan,
  getSharedOptimizerPlanDiagnostics,
} from '../sharedOptimizerPlan';

describe('createSharedOptimizerPlan', () => {
  it('deduplicates and sorts include and exclude values', () => {
    expect(
      createSharedOptimizerPlan({
        user: {
          include: ['z-last', 'vue', 'z-last'],
          exclude: ['vue', 'a-first', 'a-first'],
        },
        generated: {
          include: ['react', 'vue'],
          exclude: ['remoteApp', 'vue'],
        },
        defaultEntries: [],
      })
    ).toEqual({
      include: ['react', 'vue', 'z-last'],
      exclude: ['a-first', 'remoteApp', 'vue'],
    });
  });

  it('merges generated entries after explicit user entries', () => {
    const userEntries = ['custom-entry.ts', 'shared-entry.ts'];
    const generatedEntries = ['shared-entry.ts', '/workspace/shared/src/index.tsx'];

    expect(
      createSharedOptimizerPlan({
        user: { entries: userEntries },
        generated: { entries: generatedEntries },
        defaultEntries: ['**/*.html'],
      })
    ).toEqual({
      include: [],
      exclude: [],
      entries: ['custom-entry.ts', 'shared-entry.ts', '/workspace/shared/src/index.tsx'],
    });
    expect(userEntries).toEqual(['custom-entry.ts', 'shared-entry.ts']);
    expect(generatedEntries).toEqual(['shared-entry.ts', '/workspace/shared/src/index.tsx']);
  });

  it('uses default entries only when generated entries are added', () => {
    expect(
      createSharedOptimizerPlan({
        user: {},
        generated: { entries: ['/workspace/shared/src/index.tsx'] },
        defaultEntries: ['**/*.html', '!**/node_modules/**'],
      }).entries
    ).toEqual(['**/*.html', '!**/node_modules/**', '/workspace/shared/src/index.tsx']);
  });

  it('does not add default entries when there are no generated entries', () => {
    expect(
      createSharedOptimizerPlan({
        user: {},
        defaultEntries: ['**/*.html'],
      }).entries
    ).toBeUndefined();
  });

  it('produces the same plan for the same input', () => {
    const input = {
      user: {
        include: ['vue', 'react'],
        exclude: ['remoteApp'],
        entries: ['custom-entry.ts'],
      },
      generated: {
        include: ['react'],
        entries: ['/workspace/shared/src/index.tsx'],
      },
      defaultEntries: ['**/*.html'],
    } as const;

    expect(createSharedOptimizerPlan(input)).toEqual(createSharedOptimizerPlan(input));
  });

  it('reports include and exclude conflicts without changing the plan', () => {
    expect(
      getSharedOptimizerPlanDiagnostics({
        user: {
          include: ['react', 'vue'],
          exclude: ['vue', 'remoteApp'],
        },
        defaultEntries: [],
      })
    ).toEqual([
      {
        code: 'MF-VITE-OPTIMIZE-DEPS-CONFLICT',
        dependencies: ['vue'],
      },
    ]);
  });

  it('reports conflicts across user and generated optimizer inputs', () => {
    expect(
      getSharedOptimizerPlanDiagnostics({
        user: { include: ['react'] },
        generated: { exclude: ['react'] },
        defaultEntries: [],
      })
    ).toEqual([
      {
        code: 'MF-VITE-OPTIMIZE-DEPS-CONFLICT',
        dependencies: ['react'],
      },
    ]);
  });

  it('does not report diagnostics when optimizer inputs do not overlap', () => {
    expect(
      getSharedOptimizerPlanDiagnostics({
        user: { include: ['react'], exclude: ['vue'] },
        generated: { include: ['lit'], exclude: ['remoteApp'] },
        defaultEntries: [],
      })
    ).toEqual([]);
  });
});
