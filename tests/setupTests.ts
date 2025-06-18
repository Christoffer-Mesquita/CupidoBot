// tests/setupTests.ts
// Este arquivo é executado antes de cada suíte de teste.
// Você pode colocar aqui mocks globais, configurações, etc.

// Exemplo: Mockar 'dotenv' para não carregar o .env real durante os testes
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Exemplo: Mockar o Logger para não poluir o console durante os testes
jest.mock('../src/utils/logger', () => ({
  Logger: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    database: jest.fn(),
    timestamp: jest.fn().mockReturnValue('mock-timestamp'),
  },
}));
