// tests/handlers/help.handler.spec.ts
import helpHandler from '../../src/handlers/help.handler';
import { BannerService } from '../../src/services/banner.service';
import { Logger } from '../../src/utils/logger'; // Mockado em setupTests.ts
import { Message, Chat, MessageMedia, Client } from 'whatsapp-web.js'; // Adicionado Client para o execute

// Mockar BannerService e seus métodos
jest.mock('../../src/services/banner.service');
const mockCreateHelpBanner = jest.fn();
BannerService.getInstance = jest.fn().mockReturnValue({
  createHelpBanner: mockCreateHelpBanner,
});

// Mockar whatsapp-web.js classes parciais (apenas o necessário)
const mockChatSendMessage = jest.fn();
const mockGetChat = jest.fn().mockResolvedValue({
  sendMessage: mockChatSendMessage,
} as unknown as Chat);

const mockMessage = {
  getChat: mockGetChat,
  reply: jest.fn(),
} as unknown as Message;

// Mock MessageMedia para evitar erros de construtor
// jest.mock('whatsapp-web.js') não é ideal aqui pois queremos mockar só MessageMedia
// e manter o resto (Client, Message, Chat) como estão (ou seus mocks parciais)
// A forma correta é mockar o módulo e então mockar a exportação específica.
const actualWWebJS = jest.requireActual('whatsapp-web.js');
jest.mock('whatsapp-web.js', () => ({
    ...actualWWebJS,
    MessageMedia: jest.fn().mockImplementation((type, data, filename) => ({
        mimetype: type,
        data: data,
        filename: filename,
        constructorSpy: true, // Flag para verificar se nosso mock foi chamado
    })),
}));


describe('Help Handler', () => {
  beforeEach(() => {
    // Limpar mocks antes de cada teste
    mockCreateHelpBanner.mockClear();
    mockChatSendMessage.mockClear();
    mockGetChat.mockClear();
    (mockMessage.reply as jest.Mock).mockClear();
    (MessageMedia as jest.Mock).mockClear(); // Limpar o mock do MessageMedia
    // Logger mocks são limpos automaticamente se definidos com jest.fn() em setupTests
  });

  it('should have a name and description', () => {
    expect(helpHandler.name).toBe('ajuda');
    expect(helpHandler.description).toBe('Mostra a mensagem de ajuda com todos os comandos disponíveis.');
  });

  it('should send help banner and message successfully', async () => {
    mockCreateHelpBanner.mockResolvedValue('base64ImageData');

    // Cast para Client, pois o helpHandler não usa o client, mas a interface ICommand espera.
    await helpHandler.execute({} as Client, mockMessage, []);

    expect(mockCreateHelpBanner).toHaveBeenCalledTimes(1);
    expect(mockGetChat).toHaveBeenCalledTimes(1);
    // Verificar se sendMessage foi chamado duas vezes (banner + texto)
    expect(mockChatSendMessage).toHaveBeenCalledTimes(2);

    // Verificar o conteúdo da MessageMedia
    expect(MessageMedia).toHaveBeenCalledWith('image/png', 'base64ImageData', 'cupid-help.png');

    // Verificar se a primeira chamada a sendMessage foi com o objeto MessageMedia mockado
    // Checando a flag que adicionamos ao mock do construtor
    expect(mockChatSendMessage.mock.calls[0][0].constructorSpy).toBe(true);
    expect(mockChatSendMessage.mock.calls[0][0].mimetype).toEqual('image/png');


    // Verificar a mensagem de texto (simplificado - checar uma parte dela)
    expect(mockChatSendMessage.mock.calls[1][0]).toContain('COMANDOS CUPIDO');
  });

  it('should handle errors gracefully and reply with an error message', async () => {
    mockCreateHelpBanner.mockRejectedValue(new Error('Banner creation failed'));

    await helpHandler.execute({} as Client, mockMessage, []);

    expect(mockCreateHelpBanner).toHaveBeenCalledTimes(1);
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining("Erro no comando 'ajuda': Error: Banner creation failed"));
    expect(mockMessage.reply).toHaveBeenCalledWith('❌ Ocorreu um erro ao mostrar a ajuda.');
  });
});
