import { Message } from 'whatsapp-web.js';
import { Client } from 'whatsapp-web.js'; // Import Client
import { ICommand } from './command.interface';
import { Logger } from '../utils/logger';
import { PACKAGES } from '../utils/constants'; // Certifique-se que PACKAGES está acessível

const packagesHandler: ICommand = {
    name: 'pacotes',
    description: 'Lista todos os pacotes de assinatura disponíveis.',
    aliases: ['planos', 'precos'], // Example aliases
    execute: async (client: Client, message: Message, args: string[]): Promise<void> => { // Add client parameter
        try {
            const chat = await message.getChat();
            let response = '💝 *Pacotes Disponíveis* 💝\\n\\n';
            Object.entries(PACKAGES).forEach(([key, pkg]) => {
                response += `*${pkg.name}*\\n`;
                response += `💰 Preço: R$ ${pkg.price.toFixed(2)}\\n`;
                response += `⏰ Duração: ${pkg.duration} dias\\n\\n`;
            });
            response += 'Para comprar, envie o comando:\\n';
            response += 'cupido comprar basico|premium|vip';

            await chat.sendMessage(response);
        } catch (error) {
            Logger.error(`Erro no comando 'pacotes': ${error}`);
            await message.reply('❌ Ocorreu um erro ao listar os pacotes.');
        }
    }
};

export default packagesHandler;
