module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'], // Onde procurar por testes e código fonte
  testMatch: [ // Padrões para encontrar arquivos de teste
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  moduleNameMapper: {
    // Se você tiver caminhos absolutos ou aliases no tsconfig.json, mapeie-os aqui
    // Exemplo: '^@/(.*)$': '<rootDir>/src/$1'
  },
  // Cobertura de código (opcional, mas recomendado)
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts', // Não coletar de arquivos de definição
    '!src/index.ts', // Exemplo: pode não fazer sentido testar o entrypoint diretamente com unitários
    '!src/database/connection.ts', // Testar conexão real é mais para integração
    '!src/handlers/command.interface.ts', // Interfaces não são testáveis
    '!src/handlers/pendingSends.state.ts', // Estado puro, testar através dos handlers que o usam
    // Adicionar outros arquivos ou padrões para excluir da cobertura
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'], // Arquivo de setup (opcional)
};
