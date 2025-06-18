import { Client, Message, MessageMedia } from 'whatsapp-web.js';
import { ICommand } from './command.interface';
import { Logger } from '../utils/logger';
import { User } from '../database/models/user.model';
import { pendingSends, PendingSendDetails } from './pendingSends.state';

const sendHandler: ICommand = {
    name: 'enviar',
    description: 'Envia uma mensagem especial para alguém, de forma normal ou anônima.',
    aliases: ['send', 'message'],
    execute: async (client: Client, message: Message, args: string[]): Promise<void> => {
        try {
            const chat = await message.getChat();
            const sender = await message.getContact();

            if (args.length < 3) {
                await chat.sendMessage('❌ Formato inválido!\\n\\n' +
                    'Use: cupido enviar <número> <anonimo/normal> <mensagem>\\n' +
                    'Exemplo: cupido enviar 11999999999 anonimo Você é muito especial! 💝\\n\\n' +
                    '📱 *Formato do número:*\\n' +
                    '• DDD + número (ex: 11999999999)\\n' +
                    '• Sem o +55 no início\\n' +
                    '• Apenas números, sem espaços ou caracteres especiais');
                return;
            }

            const rawNumber = args[0].replace(/\D/g, '');
            if (!/^[1-9][1-9]9?\d{8}$/.test(rawNumber)) {
                await chat.sendMessage('❌ Número inválido!\\n\\n' +
                    '📱 O número deve estar no formato:\\n' +
                    '• DDD + número (ex: 11999999999)\\n' +
                    '• Sem o +55 no início\\n' +
                    '• Apenas números\\n' +
                    '• DDD deve começar com 1-9\\n' +
                    '• Número deve ter 8 ou 9 dígitos');
                return;
            }

            const targetNumber = '55' + rawNumber;
            const messageType = args[1].toLowerCase();
            const messageContent = args.slice(2).join(' ');

            if (messageType !== 'anonimo' && messageType !== 'normal') {
                await chat.sendMessage('❌ Tipo de mensagem inválido!\\n' +
                    'Use "anonimo" ou "normal"');
                return;
            }

            try {
                const targetContact = await client.getContactById(`${targetNumber}@c.us`);
                const targetProfilePic = await targetContact.getProfilePicUrl();

                const senderUser = await User.findOne({ phoneNumber: sender.number });
                const isVIP = senderUser?.subscription?.plan === 'VIP' && senderUser?.subscription?.isActive;
                const recipientUser = await User.findOne({ phoneNumber: rawNumber }); // Use rawNumber for DB lookup
                const hasActivePlan = recipientUser?.subscription?.isActive;

                const willSeeIdentity = messageType === 'normal' ?
                    (isVIP || hasActivePlan) :
                    (hasActivePlan && !isVIP);

                let confirmMessage = '╭━━━━━━━━━━━━━━━━━━╮\\n' +
                    '┃  *CONFIRMAR ENVIO*  ┃\\n' +
                    '╰━━━━━━━━━━━━━━━━━━╯\\n\\n' +
                    '💌 *Detalhes da Mensagem:*\\n\\n' +
                    `📱 *Para:* ${targetContact.pushname || rawNumber}\\n` +
                    `💝 *Tipo:* ${messageType === 'anonimo' ? 'Anônima' : 'Normal'}\\n` +
                    `✉️ *Mensagem:* ${messageContent}\\n\\n` +
                    `👁️ *Visibilidade:* ${willSeeIdentity ?
                        'O destinatário poderá ver quem enviou' :
                        'O destinatário NÃO poderá ver quem enviou'}\\n\\n` +
                    'Confirme se esta é a pessoa certa!\\n\\n' +
                    'Responda com *SIM* para enviar ou *NAO* para cancelar.';

                // Store send request in memory for confirmation
                pendingSends.set(sender.id._serialized, {
                    targetNumber,
                    messageType,
                    messageContent,
                    timestamp: Date.now(),
                    originalMessage: message // Store original message
                });

                if (targetProfilePic) {
                    const profilePicMedia = await MessageMedia.fromUrl(targetProfilePic);
                    await chat.sendMessage(profilePicMedia);
                }
                await chat.sendMessage(confirmMessage);

            } catch (error) {
                Logger.error(`Erro ao buscar contato ou preparar envio: ${error}`);
                await chat.sendMessage('❌ Número inválido ou não encontrado no WhatsApp!\\n' +
                    'Verifique se:\\n' +
                    '• O número está correto\\n' +
                    '• O número está cadastrado no WhatsApp\\n' +
                    '• O formato está correto (ex: 11999999999)');
            }

        } catch (error) {
            Logger.error(`Erro no comando 'enviar': ${error}`);
            await message.reply('❌ Ocorreu um erro ao processar seu pedido de envio. Por favor, tente novamente.');
        }
    }
};

export default sendHandler;
