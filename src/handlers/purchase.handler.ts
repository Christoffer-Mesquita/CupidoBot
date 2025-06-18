import { Client, Message, MessageMedia } from 'whatsapp-web.js';
import { ICommand } from './command.interface';
import { Logger } from '../utils/logger';
import { MercadoPagoService } from '../services/mercadopago.service';
import { PACKAGES, PackageType } from '../utils/constants';

const purchaseHandler: ICommand = {
    name: 'comprar',
    description: 'Inicia o processo de compra de um pacote.',
    aliases: ['buy', 'subscribe'],
    execute: async (client: Client, message: Message, args: string[]): Promise<void> => {
        try {
            const packageTypeArg = args[0];
            if (!packageTypeArg) {
                await message.reply('❌ Você precisa especificar o pacote que deseja comprar. Ex: cupido comprar basico');
                return;
            }

            const contact = await message.getContact();
            const chat = await message.getChat();
            const mpService = MercadoPagoService.getInstance();

            const normalizedPackage = packageTypeArg.trim().toUpperCase();
            const packageMap: Record<string, PackageType> = {
                'BASICO': 'BASIC',
                'BÁSICO': 'BASIC',
                'BASIC': 'BASIC',
                'PREMIUM': 'PREMIUM',
                'VIP': 'VIP'
            };

            const upperPackageType = packageMap[normalizedPackage];
            if (!upperPackageType) {
                await chat.sendMessage('❌ Pacote inválido! Use cupido pacotes para ver as opções disponíveis.\nPacotes válidos: basico, premium, vip');
                return;
            }

            const pkg = PACKAGES[upperPackageType];

            const { qrCodeImage, paymentId, pixCopyPaste } = await mpService.createPayment(
                pkg.price,
                upperPackageType,
                contact.number
            );

            await chat.sendMessage('╭━━━━━━━━━━━━━━━━━━╮\\n' +
                '┃    *PAGAMENTO PIX*    ┃\\n' +
                '╰━━━━━━━━━━━━━━━━━━╯\\n\\n' +
                '💝 *Detalhes do Pacote* 💝\\n' +
                `📦 *Pacote:* ${pkg.name}\\n` +
                `💰 *Valor:* R$ ${pkg.price.toFixed(2)}\\n` +
                `⏰ *Duração:* ${pkg.duration} dias\\n\\n` +
                '📱 *Escaneie o QR Code abaixo:*');

            const media = new MessageMedia('image/png', qrCodeImage.split(',')[1], 'qr-code.png');
            await chat.sendMessage(media);

            await chat.sendMessage('╭━━━━━━━━━━━━━━━━━━╮\\n' +
                '┃   *CÓDIGO PIX COPIA E COLA*   ┃\\n' +
                '╰━━━━━━━━━━━━━━━━━━╯\\n\\n' +
                '```' + pixCopyPaste + '```\\n\\n' +
                '_Copie o código acima e cole no seu aplicativo do banco_\\n\\n' +
                '💫 *Pagamento Automático* 💫\\n' +
                'Seu pagamento será confirmado automaticamente em alguns segundos após a transferência.');

        } catch (error) {
            Logger.error(`Erro ao processar compra: ${error}`);
            await message.reply('❌ Ocorreu um erro ao processar sua compra. Por favor, tente novamente.');
        }
    }
};

export default purchaseHandler;
