// tests/handlers/purchase.handler.spec.ts
import purchaseHandler from '../../src/handlers/purchase.handler';
import { MercadoPagoService } from '../../src/services/mercadopago.service';
import { PACKAGES } from '../../src/utils/constants';
import { Logger } from '../../src/utils/logger'; // Mockado em setupTests.ts
import { Message, Chat, Contact, MessageMedia, Client } from 'whatsapp-web.js'; // Adicionado Client

// Mock MercadoPagoService
jest.mock('../../src/services/mercadopago.service');
const mockCreatePayment = jest.fn();
MercadoPagoService.getInstance = jest.fn().mockReturnValue({
  createPayment: mockCreatePayment,
});

// Mock whatsapp-web.js classes parciais
const mockChatSendMessage = jest.fn();
const mockGetChat = jest.fn().mockResolvedValue({
  sendMessage: mockChatSendMessage,
} as unknown as Chat);
const mockGetContact = jest.fn().mockResolvedValue({
  number: '123456789', // Mock contact number
} as unknown as Contact);

const mockMessage = {
  getChat: mockGetChat,
  getContact: mockGetContact, // Adicionado para purchase handler
  reply: jest.fn(),
  body: '', // Será definido em cada teste conforme necessário
} as unknown as Message;

// Mock MessageMedia
// Assegurando que o mock de MessageMedia do help.handler.spec.ts ou setupTests.ts seja aplicado
// Esta é uma forma de garantir que o mock está ativo para este arquivo de teste.
const actualWWebJS = jest.requireActual('whatsapp-web.js');
jest.mock('whatsapp-web.js', () => ({
    ...actualWWebJS,
    MessageMedia: jest.fn().mockImplementation((type, data, filename) => ({
        mimetype: type,
        data: data,
        filename: filename,
        constructorSpy: true, // Flag para verificar se nosso mock foi chamado
    })),
}), { virtual: true }); // virtual: true pode ser útil se houver conflitos de mock entre arquivos

describe('Purchase Handler', () => {
  beforeEach(() => {
    mockCreatePayment.mockClear();
    mockChatSendMessage.mockClear();
    mockGetChat.mockClear();
    mockGetContact.mockClear();
    (mockMessage.reply as jest.Mock).mockClear();
    (MessageMedia as jest.Mock).mockClear();
  });

  it('should have a name and description', () => {
    expect(purchaseHandler.name).toBe('comprar');
    // Ajustando a descrição para corresponder ao que está no handler
    expect(purchaseHandler.description).toBe('Inicia o processo de compra de um pacote.');
  });

  it('should process a valid package purchase successfully', async () => {
    mockCreatePayment.mockResolvedValue({
      qrCodeImage: 'base64QrCodeImage',
      paymentId: 'mockPaymentId',
      pixCopyPaste: 'mockPixCopyPasteCode',
    });

    // args[0] é o tipo de pacote para o handler 'comprar'
    await purchaseHandler.execute({} as Client, mockMessage, ['basico']);

    expect(mockGetContact).toHaveBeenCalledTimes(1);
    expect(mockCreatePayment).toHaveBeenCalledTimes(1);
    expect(mockCreatePayment).toHaveBeenCalledWith(
      PACKAGES.BASIC.price,
      'BASIC',
      '123456789'
    );
    expect(mockChatSendMessage).toHaveBeenCalledTimes(3);
    expect(MessageMedia).toHaveBeenCalledWith('image/png', 'base64QrCodeImage', 'qr-code.png');
    expect(mockChatSendMessage.mock.calls[0][0]).toContain('*PAGAMENTO PIX*');
    expect(mockChatSendMessage.mock.calls[0][0]).toContain(PACKAGES.BASIC.name);
    expect(mockChatSendMessage.mock.calls[1][0].constructorSpy).toBe(true); // Verifica o mock da MessageMedia
    expect(mockChatSendMessage.mock.calls[1][0].mimetype).toEqual('image/png');
    expect(mockChatSendMessage.mock.calls[2][0]).toContain('*CÓDIGO PIX COPIA E COLA*');
    expect(mockChatSendMessage.mock.calls[2][0]).toContain('mockPixCopyPasteCode');
  });

  it('should handle different casing and accents for package names', async () => {
    mockCreatePayment.mockResolvedValue({
      qrCodeImage: 'base64QrCodeImage',
      paymentId: 'mockPaymentId',
      pixCopyPaste: 'mockPixCopyPasteCode',
    });

    await purchaseHandler.execute({} as Client, mockMessage, ['BÁsIcO']);
    expect(mockCreatePayment).toHaveBeenCalledWith(
      PACKAGES.BASIC.price,
      'BASIC',
      '123456789'
    );
  });

  it('should reply with an error if package type is invalid', async () => {
    await purchaseHandler.execute({} as Client, mockMessage, ['invalido']);

    expect(mockCreatePayment).not.toHaveBeenCalled();
    expect(mockChatSendMessage).toHaveBeenCalledTimes(1);
    // A mensagem de erro é enviada para o chat, não via reply.
    expect(mockChatSendMessage).toHaveBeenCalledWith(expect.stringContaining('❌ Pacote inválido!'));
  });

  it('should reply with an error if no package type is provided', async () => {
    // O handler espera o tipo de pacote como args[0]
    await purchaseHandler.execute({} as Client, mockMessage, []);

    expect(mockCreatePayment).not.toHaveBeenCalled();
    // A mensagem de erro é enviada para o chat (mockMessage.reply não é usado para esta condição no handler)
    expect(mockChatSendMessage).toHaveBeenCalledTimes(1);
    expect(mockChatSendMessage).toHaveBeenCalledWith(expect.stringContaining('❌ Você precisa especificar o pacote que deseja comprar.'));
  });

  it('should handle errors from MercadoPagoService.createPayment', async () => {
    mockCreatePayment.mockRejectedValue(new Error('MP Error'));

    await purchaseHandler.execute({} as Client, mockMessage, ['premium']);

    expect(mockCreatePayment).toHaveBeenCalledTimes(1);
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Erro ao processar compra: Error: MP Error'));
    expect(mockMessage.reply).toHaveBeenCalledWith('❌ Ocorreu um erro ao processar sua compra. Por favor, tente novamente.');
  });

  it('should handle errors when sending messages', async () => {
    mockCreatePayment.mockResolvedValue({
      qrCodeImage: 'base64QrCodeImage',
      paymentId: 'mockPaymentId',
      pixCopyPaste: 'mockPixCopyPasteCode',
    });
    mockChatSendMessage.mockRejectedValueOnce(new Error('Send error'));

    await purchaseHandler.execute({} as Client, mockMessage, ['vip']);

    expect(mockCreatePayment).toHaveBeenCalledTimes(1);
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Erro ao processar compra: Error: Send error'));
    expect(mockMessage.reply).toHaveBeenCalledWith('❌ Ocorreu um erro ao processar sua compra. Por favor, tente novamente.');
  });
});
