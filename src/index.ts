import { Client, LocalAuth, Message, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import chalk from 'chalk';
import figlet from 'figlet';
import moment from 'moment';
import fs from 'fs';
import path from 'path';
import { DatabaseConnection } from './database/connection';
import { Logger } from './utils/logger';
import { User } from './database/models/user.model';
import { Payment } from './database/models/payment.model';
import { MercadoPagoService } from './services/mercadopago.service';
import { PACKAGES, PackageType } from './utils/constants';
import { BannerService } from './services/banner.service';

const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshot');
const SESSION_DIR = path.join(__dirname, '..', '.wwebjs_auth');
const APP_NAME = 'Cupid Bot';
const VERSION = '1.0.0';
const HEARTS = '♥♥♥♥♥♥♥♥♥♥';

[SCREENSHOT_DIR, SESSION_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

console.log(chalk.magenta(figlet.textSync(APP_NAME, {
    font: 'Big',
    horizontalLayout: 'default',
    verticalLayout: 'default'
})));

console.log(chalk.red(HEARTS.repeat(8)));
console.log(chalk.magenta(`${chalk.red('♥')} Versão: ${VERSION}`));
console.log(chalk.magenta(`${chalk.red('♥')} Iniciado em: ${Logger.timestamp()}`));
console.log(chalk.magenta(`${chalk.red('♥')} Plataforma: ${process.platform}`));
console.log(chalk.magenta(`${chalk.red('♥')} Versão do Node: ${process.version}`));
console.log(chalk.red(HEARTS.repeat(8)));

async function initialize() {
    try {
        const db = DatabaseConnection.getInstance();
        await db.connect();

        const mpService = MercadoPagoService.getInstance();
        await mpService.initialize();

        const hasExistingSession = fs.existsSync(SESSION_DIR) && 
            fs.readdirSync(SESSION_DIR).length > 0;

        if (hasExistingSession) {
            Logger.info('Cupido encontrou uma sessão de amor anterior! Tentando reconectar... 💕');
        } else {
            Logger.info('Primeira vez do Cupido por aqui! Vamos começar uma nova história de amor... 💘');
        }

        const client = new Client({
            authStrategy: new LocalAuth({
                clientId: 'cupid-bot',
                dataPath: SESSION_DIR
            }),
            puppeteer: {
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920x1080'
                ],
                headless: true
            }
        });

        mpService.setWhatsappClient(client);

        client.on('qr', (qr) => {
            Logger.info('💘 Escaneie o código do amor para se conectar! 💘');
            qrcode.generate(qr, { small: true });
        });

        client.on('loading_screen', (percent: number) => {
            Logger.info(`Cupido está se preparando... ${percent}% concluído 💫`);
        });

        client.on('ready', async () => {
            Logger.success('Cupido está online e pronto para espalhar amor! 💘');
            
            try {
                const page = await client.pupPage;
                if (!page) {
                    throw new Error('Página do navegador não inicializada');
                }
                const screenshotPath = path.join(SCREENSHOT_DIR, 'whatsapp-connection.png');
                
                if (fs.existsSync(screenshotPath)) {
                    fs.unlinkSync(screenshotPath);
                    Logger.info('Removendo foto antiga do amor...');
                }
                
                await page.screenshot({
                    path: screenshotPath,
                    fullPage: true
                });
                Logger.success('Capturei uma nova foto do amor! 📸💕');
                
            } catch (error) {
                Logger.error(`Ops! Cupido deixou cair sua câmera: ${error}`);
            }
        });

        async function handlePaymentCommand(message: Message): Promise<void> {
            try {
                const contact = await message.getContact();
                const chat = await message.getChat();
                
                let response = '💝 *Pacotes Disponíveis* 💝\n\n';
                Object.entries(PACKAGES).forEach(([key, pkg]) => {
                    response += `*${pkg.name}*\n`;
                    response += `💰 Preço: R$ ${pkg.price.toFixed(2)}\n`;
                    response += `⏰ Duração: ${pkg.duration} dias\n\n`;
                });
                response += 'Para comprar, envie o comando:\n';
                response += 'cupido comprar basico|premium|vip';

                await chat.sendMessage(response);

            } catch (error) {
                Logger.error(`Erro ao processar comando de pagamento: ${error}`);
            }
        }

        async function handlePurchaseCommand(message: Message, packageType: string): Promise<void> {
            try {
                const contact = await message.getContact();
                const chat = await message.getChat();
                
                const normalizedPackage = packageType.trim().toUpperCase();
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

                await chat.sendMessage('╭━━━━━━━━━━━━━━━━━━╮\n' +
                    '┃    *PAGAMENTO PIX*    ┃\n' +
                    '╰━━━━━━━━━━━━━━━━━━╯\n\n' +
                    '💝 *Detalhes do Pacote* 💝\n' +
                    `📦 *Pacote:* ${pkg.name}\n` +
                    `💰 *Valor:* R$ ${pkg.price.toFixed(2)}\n` +
                    `⏰ *Duração:* ${pkg.duration} dias\n\n` +
                    '📱 *Escaneie o QR Code abaixo:*');

                const media = new MessageMedia('image/png', qrCodeImage.split(',')[1], 'qr-code.png');
                await chat.sendMessage(media);

                await chat.sendMessage('╭━━━━━━━━━━━━━━━━━━╮\n' +
                    '┃   *CÓDIGO PIX COPIA E COLA*   ┃\n' +
                    '╰━━━━━━━━━━━━━━━━━━╯\n\n' +
                    '```' + pixCopyPaste + '```\n\n' +
                    '_Copie o código acima e cole no seu aplicativo do banco_\n\n' +
                    '💫 *Pagamento Automático* 💫\n' +
                    'Seu pagamento será confirmado automaticamente em alguns segundos após a transferência.');

            } catch (error) {
                Logger.error(`Erro ao processar compra: ${error}`);
                await message.reply('❌ Ocorreu um erro ao processar sua compra. Por favor, tente novamente.');
            }
        }

        async function handleHelpCommand(message: Message): Promise<void> {
            try {
                const chat = await message.getChat();
                const bannerService = BannerService.getInstance();
                
                const bannerBase64 = await bannerService.createHelpBanner();
                const media = new MessageMedia('image/png', bannerBase64, 'cupid-help.png');
                await chat.sendMessage(media);

                const helpMessage = '╭━━━━━━━━━━━━━━━━━━╮\n' +
                    '┃    *COMANDOS CUPIDO*    ┃\n' +
                    '╰━━━━━━━━━━━━━━━━━━╯\n\n' +
                    '💘 *Comandos Disponíveis:*\n\n' +
                    '📜 *cupido ajuda*\n' +
                    '_Mostra esta mensagem de ajuda_\n\n' +
                    '💝 *cupido pacotes*\n' +
                    '_Lista todos os pacotes disponíveis_\n\n' +
                    '🛍️ *cupido comprar [pacote]*\n' +
                    '_Inicia o processo de compra do pacote_\n' +
                    '_Exemplo: cupido comprar premium_\n\n' +
                    '💌 *cupido enviar [número] [anonimo/normal] [mensagem]*\n' +
                    '_Envia uma mensagem especial para alguém_\n' +
                    '_Exemplo: cupido enviar 11999999999 anonimo Você é incrível!_\n' +
                    '_Formato do número: DDD + número (sem +55)_\n\n' +
                    '✨ *Pacotes Disponíveis:*\n' +
                    '• básico - 7 dias\n' +
                    '• premium - 30 dias\n' +
                    '• vip - 90 dias\n\n' +
                    '💫 *Observações:*\n' +
                    '• Pagamentos via PIX\n' +
                    '• Confirmação automática\n' +
                    '• Ativação imediata após pagamento\n\n' +
                    '💕 _Desenvolvido com amor pelo Cupido_';

                await chat.sendMessage(helpMessage);

            } catch (error) {
                Logger.error(`Erro ao processar comando de ajuda: ${error}`);
                await message.reply('❌ Ocorreu um erro ao mostrar a ajuda. Por favor, tente novamente.');
            }
        }

        // Handle commands
        async function handleSendCommand(message: Message, args: string[]): Promise<void> {
            try {
                const chat = await message.getChat();
                const sender = await message.getContact();

                // Check arguments
                if (args.length < 3) {
                    await chat.sendMessage('❌ Formato inválido!\n\n' +
                        'Use: cupido enviar <número> <anonimo/normal> <mensagem>\n' +
                        'Exemplo: cupido enviar 11999999999 anonimo Você é muito especial! 💝\n\n' +
                        '📱 *Formato do número:*\n' +
                        '• DDD + número (ex: 11999999999)\n' +
                        '• Sem o +55 no início\n' +
                        '• Apenas números, sem espaços ou caracteres especiais');
                    return;
                }

                // Parse and validate number
                const rawNumber = args[0].replace(/\D/g, ''); // Remove non-digits
                
                // Validate number format (DDD + 8 or 9 digits)
                if (!/^[1-9][1-9]9?\d{8}$/.test(rawNumber)) {
                    await chat.sendMessage('❌ Número inválido!\n\n' +
                        '📱 O número deve estar no formato:\n' +
                        '• DDD + número (ex: 11999999999)\n' +
                        '• Sem o +55 no início\n' +
                        '• Apenas números\n' +
                        '• DDD deve começar com 1-9\n' +
                        '• Número deve ter 8 ou 9 dígitos');
                    return;
                }

                // Add country code (55)
                const targetNumber = '55' + rawNumber;
                const messageType = args[1].toLowerCase();
                const messageContent = args.slice(2).join(' ');

                // Validate message type
                if (messageType !== 'anonimo' && messageType !== 'normal') {
                    await chat.sendMessage('❌ Tipo de mensagem inválido!\n' +
                        'Use "anonimo" ou "normal"');
                    return;
                }

                try {
                    // Try to get target contact info
                    const targetContact = await client.getContactById(`${targetNumber}@c.us`);
                    const targetProfilePic = await targetContact.getProfilePicUrl();

                    // Check subscription status
                    const senderUser = await User.findOne({ phoneNumber: sender.number });
                    const isVIP = senderUser?.subscription?.plan === 'VIP' && senderUser?.subscription?.isActive;
                    const recipientUser = await User.findOne({ phoneNumber: rawNumber });
                    const hasActivePlan = recipientUser?.subscription?.isActive;

                    // Determine if recipient will see the sender
                    const willSeeIdentity = messageType === 'normal' ? 
                        (isVIP || hasActivePlan) : // No modo normal: VIP sempre mostra, ou destinatário com plano vê
                        (hasActivePlan && !isVIP);  // No modo anônimo: só vê se tiver plano E remetente não for VIP

                    // Send confirmation message with profile picture
                    let confirmMessage = '╭━━━━━━━━━━━━━━━━━━╮\n' +
                        '┃  *CONFIRMAR ENVIO*  ┃\n' +
                        '╰━━━━━━━━━━━━━━━━━━╯\n\n' +
                        '💌 *Detalhes da Mensagem:*\n\n' +
                        `📱 *Para:* ${targetContact.pushname || rawNumber}\n` +
                        `💝 *Tipo:* ${messageType === 'anonimo' ? 'Anônima' : 'Normal'}\n` +
                        `✉️ *Mensagem:* ${messageContent}\n\n` +
                        `👁️ *Visibilidade:* ${willSeeIdentity ? 
                            'O destinatário poderá ver quem enviou' : 
                            'O destinatário NÃO poderá ver quem enviou'}\n\n` +
                        'Confirme se esta é a pessoa certa!\n\n' +
                        'Responda com *SIM* para enviar ou *NAO* para cancelar.';

                    // Store send request in memory for confirmation
                    pendingSends.set(sender.id._serialized, {
                        targetNumber,
                        messageType,
                        messageContent,
                        timestamp: Date.now()
                    });

                    // Send profile picture if available
                    if (targetProfilePic) {
                        const profilePicMedia = await MessageMedia.fromUrl(targetProfilePic);
                        await chat.sendMessage(profilePicMedia);
                    }

                    await chat.sendMessage(confirmMessage);

                } catch (error) {
                    await chat.sendMessage('❌ Número inválido ou não encontrado no WhatsApp!\n' +
                        'Verifique se:\n' +
                        '• O número está correto\n' +
                        '• O número está cadastrado no WhatsApp\n' +
                        '• O formato está correto (ex: 11999999999)');
                }

            } catch (error) {
                Logger.error(`Erro ao processar comando de envio: ${error}`);
                await message.reply('❌ Ocorreu um erro ao processar seu pedido. Por favor, tente novamente.');
            }
        }

        // Store pending send requests
        const pendingSends = new Map<string, {
            targetNumber: string;
            messageType: string;
            messageContent: string;
            timestamp: number;
        }>();

        // Handle confirmation responses
        async function handleConfirmation(message: Message): Promise<void> {
            try {
                const chat = await message.getChat();
                const sender = await message.getContact();
                const response = message.body.toLowerCase();

                // Check if user has a pending send request
                const pendingSend = pendingSends.get(sender.id._serialized);
                if (!pendingSend) return;

                // Remove pending send after 5 minutes
                if (Date.now() - pendingSend.timestamp > 5 * 60 * 1000) {
                    pendingSends.delete(sender.id._serialized);
                    await chat.sendMessage('⌛ Tempo de confirmação expirado. Por favor, envie o comando novamente.');
                    return;
                }

                if (response === 'sim') {
                    const senderUser = await User.findOne({ phoneNumber: sender.number });
                    const isVIP = senderUser?.subscription?.plan === 'VIP' && senderUser?.subscription?.isActive;
                    const bannerService = BannerService.getInstance();

                    const recipientNumber = pendingSend.targetNumber.slice(2); // Remove '55'
                    const recipientUser = await User.findOne({ phoneNumber: recipientNumber });
                    const hasActivePlan = recipientUser?.subscription?.isActive;

                    // Send the message
                    const targetChat = await client.getChatById(`${pendingSend.targetNumber}@c.us`);
                    
                    // Get profile pictures
                    const senderProfilePicUrl = await client.getProfilePicUrl(sender.id._serialized);
                    const recipientProfilePicUrl = await client.getProfilePicUrl(`${pendingSend.targetNumber}@c.us`);
                    
                    // Generate and send the banner
                    const bannerBase64 = await bannerService.createMessageBanner(
                        isVIP,
                        senderProfilePicUrl || undefined,       
                        recipientProfilePicUrl || undefined
                    );
                    const media = new MessageMedia('image/png', bannerBase64, 'message-banner.png');
                    await targetChat.sendMessage(media);

                    let formattedMessage = '╭━━━━━━━━━━━━━━━━━━╮\n' +
                        '┃  *MENSAGEM ESPECIAL*  ┃\n' +
                        '╰━━━━━━━━━━━━━━━━━━╯\n\n' +
                        '✨ *Uma mensagem chegou até você* ✨\n' +
                        '💫 Às vezes, as palavras mais doces\n' +
                        '💝 vêm no momento mais inesperado...\n\n';

                    if (pendingSend.messageType === 'anonimo') {
                        if (!hasActivePlan) {
                            // Destinatário sem plano ativo
                            formattedMessage += '💌 Alguém especial enviou esta mensagem!\n' +
                                '💭 Quer descobrir quem é?\n' +
                                '🌟 Assine qualquer plano do Cupido e\n' +
                                '✨ descubra quem pensou em você!\n\n' +
                                '💝 Use "cupido pacotes" para conhecer\n' +
                                '💫 nossos planos especiais!\n\n';
                        } else if (!isVIP) {
                            // Destinatário tem plano ativo e remetente não é VIP
                            formattedMessage += '💫 *Revelando o Mistério* 💫\n' +
                                '✨ Como você tem um plano ativo,\n' +
                                '💝 posso revelar quem enviou:\n\n' +
                                `👤 *De:* ${sender.pushname || sender.number}\n\n`;
                        }
                        
                        formattedMessage += '✨ *Mensagem:*\n' +
                            `_"${pendingSend.messageContent}"_\n\n` +
                            (hasActivePlan && !isVIP ? '' : '🎭 _De: Um admirador secreto_\n') +
                            '💫 _Enviado com carinho através do Cupido_\n\n' +
                            '╭─────── ♡ ───────╮\n' +
                            '   Que esse momento\n' +
                            '   especial ilumine\n' +
                            '    seu dia! ✨\n' +
                            '╰─────── ♡ ───────╯';
                    } else {
                        // Mensagem normal
                        if (!hasActivePlan && !isVIP) {
                            // Destinatário sem plano ativo e remetente não é VIP
                            formattedMessage += '💌 Alguém quer se conectar com você!\n' +
                                '💭 Para ver quem é, assine um de\n' +
                                '✨ nossos planos especiais!\n\n' +
                                '💝 Use "cupido pacotes" para\n' +
                                '💫 descobrir mais!\n\n';
                        }

                        formattedMessage += '✨ *Mensagem:*\n' +
                            `_"${pendingSend.messageContent}"_\n\n` +
                            (hasActivePlan || isVIP ? `💌 _De: ${sender.pushname || sender.number}_\n` : '💌 _De: Alguém especial_\n') +
                            '💫 _Enviado com carinho através do Cupido_\n\n' +
                            '╭─────── ♡ ───────╮\n' +
                            '   Que essa mensagem\n' +
                            '   toque seu coração\n' +
                            '    como tocou o meu!\n' +
                            '╰─────── ♡ ───────╯';
                    }

                    // Adiciona selo VIP se aplicável
                    if (isVIP) {
                        formattedMessage += '\n\n👑 _Mensagem enviada por um usuário VIP_';
                    }

                    await targetChat.sendMessage(formattedMessage);
                    await chat.sendMessage('✨ Sua mensagem foi entregue com sucesso! 💝\n\n' +
                        '💫 Que esse gesto de carinho\n' +
                        '💌 possa fazer a diferença\n' +
                        '💝 no dia de alguém especial!');

                } else if (response === 'nao' || response === 'não') {
                    await chat.sendMessage('❌ Envio cancelado.\n\n' +
                        '💫 Não se preocupe! Às vezes\n' +
                        '💭 o momento certo ainda está\n' +
                        '💝 por vir...');
                }

                // Remove pending send
                pendingSends.delete(sender.id._serialized);

            } catch (error) {
                Logger.error(`Erro ao processar confirmação: ${error}`);
                await message.reply('❌ Ocorreu um erro ao processar sua confirmação. Por favor, tente novamente.');
            }
        }

        client.on('message', async (message) => {
            try {
                const contact = await message.getContact();
                
                await User.findOneAndUpdate(
                    { phoneNumber: contact.number },
                    {
                        $set: {
                            name: contact.pushname || contact.number,
                            lastInteraction: new Date()
                        }
                    },
                    { upsert: true }
                );
                
                Logger.database(`Interação registrada para: ${contact.pushname || contact.number} 💘`);

                const text = message.body.toLowerCase();
                if (text === 'cupido ajuda' || text === 'cupido help') {
                    await handleHelpCommand(message);
                } else if (text === 'cupido pacotes') {
                    await handlePaymentCommand(message);
                } else if (text.startsWith('cupido comprar ')) {
                    const packageType = text.split('cupido comprar ')[1];
                    await handlePurchaseCommand(message, packageType);
                } else if (text.startsWith('cupido enviar ')) {
                    const args = text.slice('cupido enviar '.length).trim().split(' ');
                    await handleSendCommand(message, args);
                } else if (text === 'sim' || text === 'nao' || text === 'não') {
                    await handleConfirmation(message);
                }
                
            } catch (error) {
                Logger.error(`Erro ao processar mensagem: ${error}`);
            }
        });

        client.on('authenticated', () => {
            Logger.success('Cupido autenticado com sucesso! Pronto para espalhar amor! 💘');
            Logger.info('Sua sessão de amor foi salva para futuros encontros! 💝');
        });

        client.on('auth_failure', async (msg) => {
            Logger.error(`Autenticação falhou! Cupido perdeu suas flechas: ${msg}`);
            Logger.info('Tentando limpar sessão antiga para um novo começo... 🔄');
            
            if (fs.existsSync(SESSION_DIR)) {
                fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                Logger.info('Sessão antiga removida. Por favor, tente conectar novamente! 🎯');
            }
        });

        client.on('disconnected', async (reason) => {
            Logger.warning(`Cupido precisa descansar um pouco: ${reason}`);
            Logger.info('Não se preocupe, sua sessão de amor está guardada! ❤️');
            
            await db.disconnect();
        });

        Logger.info('Cupido está abrindo suas asas...');
        await client.initialize();

    } catch (error) {
        Logger.error(`Erro fatal durante inicialização: ${error}`);
        process.exit(1);
    }
}

process.on('SIGINT', async () => {
    Logger.warning('Cupido está se preparando para dormir... 💤');
    try {
        await DatabaseConnection.getInstance().disconnect();
        Logger.success('Cupido foi dormir! Até a próxima aventura do amor! 💝');
        process.exit(0);
    } catch (error) {
        Logger.error(`Erro ao encerrar: ${error}`);
        process.exit(1);
    }
});

initialize(); 