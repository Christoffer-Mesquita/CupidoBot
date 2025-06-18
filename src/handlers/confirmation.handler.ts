import { Client, Message, MessageMedia } from 'whatsapp-web.js';
import { Logger } from '../utils/logger';
import { User } from '../database/models/user.model';
import { BannerService } from '../services/banner.service';
import { pendingSends, PendingSendDetails } from './pendingSends.state'; // Importar o Map

export async function handleConfirmation(client: Client, message: Message): Promise<void> {
    try {
        const chat = await message.getChat();
        const senderContact = await message.getContact(); // Renomeado para evitar conflito com senderUser
        const response = message.body.toLowerCase();

        const pendingSend = pendingSends.get(senderContact.id._serialized);
        if (!pendingSend) return;

        if (Date.now() - pendingSend.timestamp > 5 * 60 * 1000) { // 5 minutes timeout
            pendingSends.delete(senderContact.id._serialized);
            await chat.sendMessage('⌛ Tempo de confirmação expirado. Por favor, envie o comando novamente.');
            return;
        }

        if (response === 'sim') {
            const senderUser = await User.findOne({ phoneNumber: senderContact.number });
            const isVIP = senderUser?.subscription?.plan === 'VIP' && senderUser?.subscription?.isActive;
            const bannerService = BannerService.getInstance();

            const recipientNumber = pendingSend.targetNumber.slice(2); // Remove '55'
            const recipientUser = await User.findOne({ phoneNumber: recipientNumber });
            const hasActivePlan = recipientUser?.subscription?.isActive;

            const targetChat = await client.getChatById(`${pendingSend.targetNumber}@c.us`);

            const senderProfilePicUrl = await client.getProfilePicUrl(senderContact.id._serialized);
            const recipientProfilePicUrl = await client.getProfilePicUrl(`${pendingSend.targetNumber}@c.us`);

            const bannerBase64 = await bannerService.createMessageBanner(
                isVIP || false, // Pass isVIP, default to false if undefined
                senderProfilePicUrl || undefined,
                recipientProfilePicUrl || undefined
            );
            const media = new MessageMedia('image/png', bannerBase64, 'message-banner.png');
            await targetChat.sendMessage(media);

            let formattedMessage = '╭━━━━━━━━━━━━━━━━━━╮\\n' +
                '┃  *MENSAGEM ESPECIAL*  ┃\\n' +
                '╰━━━━━━━━━━━━━━━━━━╯\\n\\n' +
                '✨ *Uma mensagem chegou até você* ✨\\n' +
                '💫 Às vezes, as palavras mais doces\\n' +
                '💝 vêm no momento mais inesperado...\\n\\n';

            if (pendingSend.messageType === 'anonimo') {
                if (!hasActivePlan) {
                    formattedMessage += '💌 Alguém especial enviou esta mensagem!\\n' +
                        '💭 Quer descobrir quem é?\\n' +
                        '🌟 Assine qualquer plano do Cupido e\\n' +
                        '✨ descubra quem pensou em você!\\n\\n' +
                        '💝 Use "cupido pacotes" para conhecer\\n' +
                        '💫 nossos planos especiais!\\n\\n';
                } else if (!isVIP) {
                    formattedMessage += '💫 *Revelando o Mistério* 💫\\n' +
                        '✨ Como você tem um plano ativo,\\n' +
                        '💝 posso revelar quem enviou:\\n\\n' +
                        `👤 *De:* ${pendingSend.originalMessage.getContact().then(c => c.pushname || c.number) || senderContact.pushname || senderContact.number}\\n\\n`;
                }

                formattedMessage += '✨ *Mensagem:*\\n' +
                    `_"${pendingSend.messageContent}"_\\n\\n` +
                    (hasActivePlan && !isVIP ? '' : '🎭 _De: Um admirador secreto_\\n') +
                    '💫 _Enviado com carinho através do Cupido_\\n\\n' +
                    '╭─────── ♡ ───────╮\\n' +
                    '   Que esse momento\\n' +
                    '   especial ilumine\\n' +
                    '    seu dia! ✨\\n' +
                    '╰─────── ♡ ───────╯';
            } else { // Mensagem normal
                if (!hasActivePlan && !isVIP) {
                    formattedMessage += '💌 Alguém quer se conectar com você!\\n' +
                        '💭 Para ver quem é, assine um de\\n' +
                        '✨ nossos planos especiais!\\n\\n' +
                        '💝 Use "cupido pacotes" para\\n' +
                        '💫 descobrir mais!\\n\\n';
                }

                formattedMessage += '✨ *Mensagem:*\\n' +
                    `_"${pendingSend.messageContent}"_\\n\\n` +
                    (hasActivePlan || isVIP ? `💌 _De: ${pendingSend.originalMessage.getContact().then(c => c.pushname || c.number) || senderContact.pushname || senderContact.number}_\\n` : '💌 _De: Alguém especial_\\n') +
                    '💫 _Enviado com carinho através do Cupido_\\n\\n' +
                    '╭─────── ♡ ───────╮\\n' +
                    '   Que essa mensagem\\n' +
                    '   toque seu coração\\n' +
                    '    como tocou o meu!\\n' +
                    '╰─────── ♡ ───────╯';
            }

            if (isVIP) {
                formattedMessage += '\\n\\n👑 _Mensagem enviada por um usuário VIP_';
            }

            await targetChat.sendMessage(formattedMessage);
            // Use originalMessage to reply to the sender who initiated the command
            const originalSenderChat = await pendingSend.originalMessage.getChat();
            await originalSenderChat.sendMessage('✨ Sua mensagem foi entregue com sucesso! 💝\\n\\n' +
                '💫 Que esse gesto de carinho\\n' +
                '💌 possa fazer a diferença\\n' +
                '💝 no dia de alguém especial!');

        } else if (response === 'nao' || response === 'não') {
            // Use originalMessage to reply to the sender
            const originalSenderChat = await pendingSend.originalMessage.getChat();
            await originalSenderChat.sendMessage('❌ Envio cancelado.\\n\\n' +
                '💫 Não se preocupe! Às vezes\\n' +
                '💭 o momento certo ainda está\\n' +
                '💝 por vir...');
        }

        pendingSends.delete(senderContact.id._serialized);

    } catch (error) {
        Logger.error(`Erro ao processar confirmação: ${error}`);
        // Avoid replying directly if the original message context is lost or unclear
        // Consider logging more details or sending a generic error to a predefined admin number if critical
    }
}
