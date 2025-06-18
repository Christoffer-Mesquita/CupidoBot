module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:@typescript-eslint/recommended', // Regras recomendadas para TypeScript
    'plugin:prettier/recommended'         // Integração com Prettier (desativa regras conflitantes e usa Prettier)
  ],
  parserOptions: {
    ecmaVersion: 2020, // Ou a versão do ECMAScript que você está usando
    sourceType: 'module'
  },
  rules: {
    // Aqui você pode adicionar ou sobrescrever regras específicas.
    // Exemplo:
    // '@typescript-eslint/no-explicit-any': 'warn',
    // 'no-console': 'warn', // Para alertar sobre console.log em produção
  },
  settings: {
    // Pode ser necessário se você tiver caminhos de importação específicos
    // 'import/resolver': {
    //   typescript: {}
    // }
  },
  env: {
    node: true, // Define variáveis globais do Node.js (como process, console)
    es6: true   // Define variáveis globais do ES6
  }
};
