import dotenv from 'dotenv';
dotenv.config();

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
import { ICommand } from './handlers/command.interface';
import helpHandler from './handlers/help.handler';
import packagesHandler from './handlers/packages.handler';
import purchaseHandler from './handlers/purchase.handler';
import sendHandler from './handlers/send.handler';
import { handleConfirmation as newHandleConfirmation } from './handlers/confirmation.handler'; // Renamed import

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

        const commandHandlers = new Map<string, ICommand>();

        function registerCommand(command: ICommand) {
            commandHandlers.set(command.name, command);
            if (command.aliases) {
                command.aliases.forEach(alias => commandHandlers.set(alias, command));
            }
        }

        // Import and register handlers here later (Step 4 and 5)
        registerCommand(helpHandler);
        registerCommand(packagesHandler);
        registerCommand(purchaseHandler);
        registerCommand(sendHandler);

        // The old handleConfirmation function will be removed.
        // The pendingSends Map is now in pendingSends.state.ts and imported directly by confirmation.handler.ts

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
                const prefix = 'cupido ';

                if (text.startsWith(prefix)) {
                    const args = message.body.slice(prefix.length).trim().split(/ +/);
                    const commandName = args.shift()?.toLowerCase();

                    if (commandName) {
                        const command = commandHandlers.get(commandName);
                        if (command) {
                            try {
                                await command.execute(client, message, args); // Pass client
                            } catch (error) {
                                Logger.error(`Erro ao executar comando '${commandName}': ${error}`);
                                await message.reply('❌ Ocorreu um erro ao processar este comando.');
                            }
                        } else {
                            // Opcional: Responder se o comando não for encontrado
                            // await message.reply(`Comando '${commandName}' não reconhecido. Use 'cupido ajuda' para ver os comandos disponíveis.`);
                        }
                    }
                } else if (text.startsWith('cupido enviar ')) { // This will be moved to its own handler later
                    const args = text.slice('cupido enviar '.length).trim().split(' ');
                    // await handleSendCommand(message, args); // This is now handled by the router
                } else if (text === 'sim' || text === 'nao' || text === 'não') {
                    try {
                        await newHandleConfirmation(client, message); // Call the new handler
                    } catch (error) {
                        Logger.error(`Erro ao processar confirmação: ${error}`);
                        // Reply strategy is handled within newHandleConfirmation or should be minimal here
                    }
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