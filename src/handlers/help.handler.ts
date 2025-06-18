import { Message, MessageMedia } from 'whatsapp-web.js';
import { ICommand } from './command.interface';
import { Logger } from '../utils/logger';
import { BannerService } from '../services/banner.service';
import { Client } from 'whatsapp-web.js'; // Import Client
// Outras importações necessárias (PACKAGES, etc., se usadas diretamente aqui)

const helpHandler: ICommand = {
    name: 'ajuda',
    description: 'Mostra a mensagem de ajuda com todos os comandos disponíveis.',
    aliases: ['help'], // Exemplo se for usar aliases
    execute: async (client: Client, message: Message, args: string[]): Promise<void> => { // Add client parameter
        try {
            const chat = await message.getChat();
            const bannerService = BannerService.getInstance();

            const bannerBase64 = await bannerService.createHelpBanner();
            const media = new MessageMedia('image/png', bannerBase64, 'cupid-help.png');
            await chat.sendMessage(media);

            const helpMessage = '╭━━━━━━━━━━━━━━━━━━╮\\n' +
                '┃    *COMANDOS CUPIDO*    ┃\\n' +
                '╰━━━━━━━━━━━━━━━━━━╯\\n\\n' +
                '💘 *Comandos Disponíveis:*\\n\\n' +
                '📜 *cupido ajuda*\\n' +
                '_Mostra esta mensagem de ajuda_\\n\\n' +
                '💝 *cupido pacotes*\\n' +
                '_Lista todos os pacotes disponíveis_\\n\\n' +
                '🛍️ *cupido comprar [pacote]*\\n' +
                '_Inicia o processo de compra do pacote_\\n' +
                '_Exemplo: cupido comprar premium_\\n\\n' +
                '💌 *cupido enviar [número] [anonimo/normal] [mensagem]*\\n' +
                '_Envia uma mensagem especial para alguém_\\n' +
                '_Exemplo: cupido enviar 11999999999 anonimo Você é incrível!_\\n' +
                '_Formato do número: DDD + número (sem +55)_\\n\\n' +
                '✨ *Pacotes Disponíveis:*\\n' +
                '• básico - 7 dias\\n' +
                '• premium - 30 dias\\n' +
                '• vip - 90 dias\\n\\n' +
                '💫 *Observações:*\\n' +
                '• Pagamentos via PIX\\n' +
                '• Confirmação automática\\n' +
                '• Ativação imediata após pagamento\\n\\n' +
                '💕 _Desenvolvido com amor pelo Cupido_';

            await chat.sendMessage(helpMessage);
        } catch (error) {
            Logger.error(`Erro no comando 'ajuda': ${error}`);
            await message.reply('❌ Ocorreu um erro ao mostrar a ajuda.');
        }
    }
};

export default helpHandler;
