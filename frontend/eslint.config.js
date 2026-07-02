import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';

const localPlugin = {
  rules: {
    'no-comments': {
      meta: {
        type: 'suggestion',
        messages: {
          lineComment:
            'Line comments (//) are prohibited. Use JSDoc block comments for documentation only.',
          blockComment:
            'Block comments are prohibited. Use JSDoc block comments for documentation only.',
        },
      },
      create(context) {
        return {
          Program(node) {
            const sourceCode = context.sourceCode;
            const comments = sourceCode.getAllComments();
            for (const comment of comments) {
              if (comment.type === 'Line') {
                context.report({ node, loc: comment.loc, messageId: 'lineComment' });
              } else if (comment.type === 'Block' && !/^\*/.test(comment.value)) {
                context.report({ node, loc: comment.loc, messageId: 'blockComment' });
              }
            }
          },
        };
      },
    },
  },
};

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', '*.config.js', '*.config.ts'] },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      import: importPlugin,
      jsdoc,
      local: localPlugin,
    },

    rules: {
      '@typescript-eslint/no-explicit-any': 'error',

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      '@typescript-eslint/consistent-type-exports': [
        'error',
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],

      '@typescript-eslint/no-import-type-side-effects': 'error',

      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      '@typescript-eslint/no-non-null-assertion': 'error',

      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: false,
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowAny: false,
        },
      ],

      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      '@typescript-eslint/promise-function-async': 'error',

      '@typescript-eslint/require-await': 'error',

      '@typescript-eslint/return-await': ['error', 'in-try-catch'],

      '@typescript-eslint/prefer-readonly': 'error',

      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
          allowConciseArrowFunctionExpressionsStartingWithVoid: true,
        },
      ],

      '@typescript-eslint/explicit-module-boundary-types': 'error',

      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 10,
        },
      ],

      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { string: false, number: false, boolean: false } },
      ],

      '@typescript-eslint/prefer-optional-chain': 'error',

      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],

      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true },
      ],

      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'error',
      'react/self-closing-comp': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/no-array-index-key': 'error',
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      'react/no-danger': 'error',

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/aria-proptypes': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/no-redundant-roles': 'error',

      'no-alert': 'error',
      'no-console': 'warn',
      'no-debugger': 'error',
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-destructuring': ['error', { object: true, array: false }],
      'object-shorthand': ['error', 'always'],
      'no-else-return': ['error', { allowElseIf: false }],

      'import/no-duplicates': 'error',
      'import/no-self-import': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      'no-inline-comments': 'error',
      'local/no-comments': 'error',

      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          publicOnly: true,
          checkConstructors: false,
        },
      ],

      'jsdoc/require-description': [
        'error',
        { contexts: ['FunctionDeclaration', 'ClassDeclaration'] },
      ],
    },

    settings: {
      react: { version: 'detect' },
      jsdoc: { mode: 'typescript' },
    },

    languageOptions: {
      parserOptions: {
        project: './tsconfig.app.json',
        ecmaFeatures: { jsx: true },
      },
    },
  },
);
