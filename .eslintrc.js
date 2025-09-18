module.exports = {
    env: { browser: true, webextensions: true, es2022: true },
    extends: ['eslint:recommended', 'plugin:jsdoc/recommended'],
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    plugins: ['jsdoc'],
    rules: {
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'jsdoc/require-jsdoc': [
            'warn',
            {
                publicOnly: true,
                require: {
                    ClassDeclaration: true,
                    MethodDefinition: true,
                    FunctionDeclaration: true,
                },
            },
        ],
        'jsdoc/require-param': 'warn',
        'jsdoc/require-returns': 'warn',
    },
    ignorePatterns: ['icons/**', '_dev/**', '_locales/**'],
};
