import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import importPlugin from 'eslint-plugin-import-x'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/*
 * Architecture as a build failure, not a convention.
 *
 * The MVC separation in this project is only real if violating it breaks
 * something. These zones turn each layer boundary into a lint error
 * (Requirement 10.5, 21.20).
 *
 * Dependency direction, lowest layer first:
 *
 *   config   →  (nothing)
 *   model    →  config
 *   adapters →  config, model
 *   controllers → config, model, adapters
 *   contexts →  config, model, controllers
 *   views    →  config, model types, controllers/hooks, components, contexts
 *   components/ui → config, lib          (pure presentation, no store, no data)
 */

const LAYER_RULES = {
  // ---------------------------------------------------------------- config
  config: {
    files: ['src/config/**/*.{ts,tsx}'],
    zones: [
      {
        target: './src/config',
        from: './src/model',
        message:
          'config is the lowest layer. Move shared types into src/config instead.',
      },
      {
        target: './src/config',
        from: './src/controllers',
        message: 'config must not depend on the Controller layer.',
      },
      {
        target: './src/config',
        from: './src/views',
        message:
          'config must not import components. Keep component mappings in src/views/viewComponents.ts.',
      },
      {
        target: './src/config',
        from: './src/components',
        message: 'config must not import components.',
      },
      {
        target: './src/config',
        from: './src/adapters',
        message: 'config must not depend on adapters.',
      },
    ],
  },

  // ----------------------------------------------------------------- model
  model: {
    files: ['src/model/**/*.ts'],
    zones: [
      {
        target: './src/model',
        from: './src/controllers',
        message:
          'The Model may not depend on the Controller. Data flows downward only.',
      },
      {
        target: './src/model',
        from: './src/views',
        message: 'The Model may not depend on the View.',
      },
      {
        target: './src/model',
        from: './src/components',
        message: 'The Model may not depend on components.',
      },
      {
        target: './src/model',
        from: './src/contexts',
        message: 'The Model may not depend on React Context.',
      },
      {
        target: './src/model',
        from: './src/adapters',
        message:
          'The Model may not depend on adapters. It must stay runnable without a browser or a store.',
      },
    ],
  },

  // ------------------------------------------------------------ design system
  designSystem: {
    files: ['src/components/**/*.{ts,tsx}'],
    zones: [
      {
        target: './src/components',
        from: './src/controllers',
        message:
          'Design-system primitives must stay pure. Pass data in through props.',
      },
      {
        target: './src/components',
        from: './src/adapters',
        message: 'Design-system primitives must not reach for adapters.',
      },
      {
        /*
         * Primitives must be renderable from plain props, with no provider.
         * A component that needs Context is a *host* and belongs in
         * src/views/hosts — see ToastHost and ConfirmHost (Requirement 11.4).
         */
        target: './src/components',
        from: './src/contexts',
        message:
          'Design-system primitives must be props-only. Put Context-consuming wiring in src/views/hosts instead.',
      },
    ],
  },

  // ------------------------------------------------------------------- views
  views: {
    files: ['src/views/**/*.{ts,tsx}'],
    zones: [
      {
        target: './src/views',
        from: './src/controllers/store.ts',
        message:
          'Views read through controllers/hooks, never the store directly.',
      },
      {
        target: './src/views',
        from: './src/controllers/slices',
        message:
          'Views read through controllers/hooks, never a slice directly.',
      },
    ],
  },

  /*
   * ---------------------------------------------------------------- contexts
   *
   * Contexts carry presentation concerns and must not reach into the Controller
   * at all. The one permitted edge between the two layers runs the other way:
   * `controllers/hooks/useAction` imports ToastContext to funnel failed
   * results. Keeping this one-directional is what stops a cycle forming.
   */
  contexts: {
    files: ['src/contexts/**/*.{ts,tsx}'],
    zones: [
      {
        target: './src/contexts',
        from: './src/controllers',
        message:
          'Contexts must not import the Controller. The permitted edge is controllers/hooks/useAction → ToastContext, never the reverse.',
      },
      {
        target: './src/contexts',
        from: './src/views',
        message: 'Contexts must not import views.',
      },
    ],
  },
}

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'storybook-static',
    'node_modules',
    'playwright-report',
    'test-results',
    'blob-report',
    'playwright/.cache',
  ]),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importPlugin,
    },
    settings: {
      'import-x/resolver': {
        typescript: {
          /* Two projects: the app, and the Playwright harness in e2e/. */
          project: ['./tsconfig.app.json', './tsconfig.e2e.json'],
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      /* Readability — Requirement 21.13 to 21.16 */
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message:
            'Use named exports so every symbol has one searchable name (21.13).',
        },
        {
          selector:
            'ConditionalExpression > ConditionalExpression.consequent, ConditionalExpression > ConditionalExpression.alternate',
          message:
            'Nested ternaries hurt readability. Use early returns or a lookup table (21.14).',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      /*
       * `const { dropped: _dropped, ...rest } = obj` is the idiomatic way to
       * omit a key from an immutable object, and the binding is unused by
       * design. Allow it, while still catching genuinely dead locals.
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: false },
      ],

      /* Module hygiene — Requirement 21.20 */
      'import-x/no-cycle': ['error', { maxDepth: 6 }],
      'import-x/no-self-import': 'error',
      'import-x/no-useless-path-segments': 'error',
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },

  /* Layer boundaries */
  ...Object.values(LAYER_RULES).map(({ files, zones }) => ({
    files,
    rules: {
      'import-x/no-restricted-paths': ['error', { zones }],
    },
  })),

  /* The Model must stay runnable outside a browser — Requirement 21.12 */
  {
    files: ['src/model/**/*.ts', 'src/config/**/*.ts'],
    languageOptions: {
      globals: {},
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message:
                'The Model and config layers are React-free so they stay reusable in a non-React runtime (21.12).',
            },
            {
              name: 'zustand',
              message:
                'State management belongs to the Controller layer (10.2).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message:
            'The Model must not touch the browser. Keep browser access in adapters (21.12).',
        },
        {
          name: 'localStorage',
          message:
            'Persistence belongs behind PersistenceAdapter, not in the Model (21.10).',
        },
        {
          name: 'document',
          message: 'The Model must not touch the DOM.',
        },
      ],
    },
  },

  /*
   * config may declare the vocabulary types the Model consumes, and may import
   * lucide icons, which are a leaf dependency rather than an app layer.
   */
  {
    files: ['src/config/**/*.ts'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  /*
   * Each context file exports a provider component *and* its consumer hook.
   * That co-location is the point — the hook and the Provider share one
   * Context object, and splitting them would mean a third module per context
   * holding `createContext` just to satisfy a dev-server optimisation.
   *
   * The only cost is that editing a provider file triggers a full reload rather
   * than a fast refresh. For six files that is not worth 12 more.
   */
  {
    files: ['src/contexts/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  /* Tests and tooling */
  {
    files: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/test/**/*.{ts,tsx}',
      '**/*.stories.{ts,tsx}',
      /*
       * Playwright specs need `!` on boundingBox() results and the layer zones
       * do not apply to a test harness that drives the app from outside.
       */
      'e2e/**/*.ts',
    ],
    rules: {
      'import-x/no-restricted-paths': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-restricted-syntax': 'off',
    },
  },

  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}', '.storybook/**/*.{ts,js}'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-restricted-syntax': 'off',
      'no-console': 'off',
    },
  },
])
