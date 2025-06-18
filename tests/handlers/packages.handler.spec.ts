// tests/handlers/packages.handler.spec.ts
import packagesHandler from '../../src/handlers/packages.handler';
import { PACKAGES } from '../../src/utils/constants';
import { Logger } from '../../src/utils/logger'; // Mockado em setupTests.ts
import { Message, Chat, Client } from 'whatsapp-web.js'; // Adicionado Client

// Mockar whatsapp-web.js classes parciais
const mockChatSendMessage = jest.fn();
const mockGetChat = jest.fn().mockResolvedValue({
  sendMessage: mockChatSendMessage,
} as unknown as Chat);

const mockMessage = {
  getChat: mockGetChat,
  reply: jest.fn(),
} as unknown as Message;

describe('Packages Handler', () => {
  beforeEach(() => {
    mockChatSendMessage.mockClear();
    mockGetChat.mockClear();
    (mockMessage.reply as jest.Mock).mockClear();
  });

  it('should have a name and description', () => {
    expect(packagesHandler.name).toBe('pacotes');
    expect(packagesHandler.description).toBe('Lista todos os pacotes de assinatura disponíveis.');
  });

  it('should send the list of packages correctly', async () => {
    // Cast para Client, pois o packagesHandler não usa o client, mas a interface ICommand espera.
    await packagesHandler.execute({} as Client, mockMessage, []);

    expect(mockGetChat).toHaveBeenCalledTimes(1);
    expect(mockChatSendMessage).toHaveBeenCalledTimes(1);

    const sentMessage = mockChatSendMessage.mock.calls[0][0] as string;
    expect(sentMessage).toContain('💝 *Pacotes Disponíveis* 💝');
    Object.values(PACKAGES).forEach(pkg => {
      expect(sentMessage).toContain(`*${pkg.name}*`);
      expect(sentMessage).toContain(`R$ ${pkg.price.toFixed(2)}`);
      expect(sentMessage).toContain(`${pkg.duration} dias`);
    });
    expect(sentMessage).toContain('cupido comprar basico|premium|vip');
  });

  it('should handle errors gracefully and reply with an error message', async () => {
    mockGetChat.mockRejectedValue(new Error('Failed to get chat'));

    await packagesHandler.execute({} as Client, mockMessage, []);

    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining("Erro no comando 'pacotes': Error: Failed to get chat"));
    expect(mockMessage.reply).toHaveBeenCalledWith('❌ Ocorreu um erro ao listar os pacotes.');
  });
});
