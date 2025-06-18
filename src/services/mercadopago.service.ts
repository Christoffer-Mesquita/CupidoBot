import { MercadoPagoConfig, Payment } from 'mercadopago';
import QRCode from 'qrcode';
import { Logger } from '../utils/logger';
import { Payment as PaymentModel } from '../database/models/payment.model';
import { User } from '../database/models/user.model';
import { PACKAGES, PackageType } from '../utils/constants';

export class MercadoPagoService {
    private static instance: MercadoPagoService;
    private isInitialized: boolean = false;
    private mercadopago: MercadoPagoConfig;
    private whatsappClient: any;

    private constructor() {
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!accessToken) {
            throw new Error('MERCADOPAGO_ACCESS_TOKEN is not defined in environment variables.');
        }
        this.mercadopago = new MercadoPagoConfig({ accessToken });
    }

    public static getInstance(): MercadoPagoService {
        if (!MercadoPagoService.instance) {
            MercadoPagoService.instance = new MercadoPagoService();
        }
        return MercadoPagoService.instance;
    }

    public setWhatsappClient(client: any) {
        this.whatsappClient = client;
    }

    public async initialize(): Promise<void> {
        try {
            Logger.info('Inicializando serviço de pagamento... 💳');
            this.isInitialized = true;
            Logger.success('Serviço de pagamento inicializado com sucesso! 💖');
        } catch (error) {
            Logger.error(`Falha ao inicializar serviço de pagamento: ${error}`);
            throw error;
        }
    }

    public async createPayment(amount: number, packageType: string, userPhone: string): Promise<{ qrCodeImage: string, paymentId: string, pixCopyPaste: string, status?: string }> {
        try {
            // First, get or create user
            const user = await User.findOneAndUpdate(
                { phoneNumber: userPhone },
                { 
                    $setOnInsert: { 
                        phoneNumber: userPhone,
                        createdAt: new Date()
                    }
                },
                { upsert: true, new: true }
            );

            const payment = new Payment(this.mercadopago);
            
            Logger.info('🔍 Testando criação de pagamento com valores fixos...');
            
            const result = await payment.create({ 
                body: {
                    transaction_amount: amount,
                    description: `Cupid Bot - Pacote ${packageType}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: 'financeiro@cupidbot.com'
                    }
                }, 
                requestOptions: { 
                    idempotencyKey: `${userPhone}-${Date.now()}`
                } 
            });

            Logger.info('✅ Resposta do Mercado Pago:');
            Logger.info(JSON.stringify(result, null, 2));

            if (!result.id) {
                throw new Error('Mercado Pago não retornou um ID de pagamento válido');
            }

            if (!result.point_of_interaction?.transaction_data?.qr_code) {
                throw new Error('Falha ao gerar QR Code PIX');
            }

            const qrCodeImage = await QRCode.toDataURL(result.point_of_interaction.transaction_data.qr_code);
            const paymentId = result.id.toString();
            const pixCopyPaste = result.point_of_interaction.transaction_data.qr_code;

            // Check if payment already exists
            const existingPayment = await PaymentModel.findOne({ mercadoPagoId: paymentId });
            
            if (!existingPayment) {
                // Create new payment only if it doesn't exist
                await PaymentModel.create({
                    userId: user._id,
                    mercadoPagoId: paymentId,
                    amount: amount,
                    currency: 'BRL',
                    status: 'pending',
                    metadata: {
                        packageType: packageType,
                        duration: PACKAGES[packageType as keyof typeof PACKAGES].duration,
                        userPhone: userPhone,
                        pixCode: pixCopyPaste
                    }
                });
            }

            return {
                qrCodeImage,
                paymentId,
                pixCopyPaste
            };

        } catch (error) {
            Logger.error(`Erro ao criar pagamento: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
            throw error;
        }
    }

    public async handleWebhookNotification(notificationPayload: any): Promise<void> {
        Logger.info('Recebida notificação de webhook do Mercado Pago:');
        Logger.info(JSON.stringify(notificationPayload, null, 2));

        try {
            // TODO: Consultar a documentação do Mercado Pago para a estrutura exata do payload.
            // Exemplo comum: notificationPayload.data.id ou notificationPayload.resource (URL do recurso)
            const paymentId = notificationPayload?.data?.id || notificationPayload?.resource?.split('/').pop();

            if (!paymentId) {
                Logger.error('Não foi possível extrair o ID do pagamento da notificação do webhook.');
                // Poderia lançar um erro aqui ou retornar, dependendo da política de tratamento.
                // throw new Error('ID do pagamento não encontrado no payload do webhook.');
                return;
            }

            Logger.info(`Processando notificação para o pagamento ID: ${paymentId}`);
            const status = await this.checkPaymentStatus(paymentId.toString());
            Logger.info(`Status atualizado do pagamento ${paymentId}: ${status}`);

            const payment = await PaymentModel.findOne({ mercadoPagoId: paymentId.toString() });
            if (!payment) {
                Logger.error(`Pagamento ${paymentId} não encontrado no banco de dados para notificação de webhook.`);
                // Poderia lançar um erro aqui ou retornar.
                // throw new Error(`Pagamento ${paymentId} não encontrado no banco.`);
                return;
            }

            // Atualiza o status do pagamento no banco de dados
            await PaymentModel.findOneAndUpdate(
                { mercadoPagoId: paymentId.toString() },
                { $set: { status: status } }
            );

            if (status === 'approved') {
                Logger.success(`Pagamento ${paymentId} aprovado via webhook! 💚`);

                if (!payment.metadata) {
                    Logger.error(`Metadados do pagamento ${paymentId} não encontrados.`);
                    // throw new Error(`Metadados do pagamento ${paymentId} não encontrados.`);
                    return;
                }

                const packageType = payment.metadata.packageType as PackageType;
                const duration = PACKAGES[packageType].duration;
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + duration);

                await User.findByIdAndUpdate(payment.userId, {
                    $set: {
                        'subscription.plan': packageType,
                        'subscription.expiresAt': expiresAt,
                        'subscription.isActive': true
                    }
                });

                await this.sendPaymentNotification(payment, 'approved');
            } else if (status === 'cancelled' || status === 'failed' || status === 'rejected') {
                // Opcional: Tratar outros status como cancelado, falhado, rejeitado
                Logger.warning(`Pagamento ${paymentId} com status: ${status}. Notificando usuário se necessário.`);
                // Se desejar, pode enviar uma notificação específica para esses casos.
                // await this.sendPaymentNotification(payment, 'failed_or_cancelled'); // Precisaria adaptar sendPaymentNotification
            } else {
                Logger.info(`Pagamento ${paymentId} com status: ${status}. Nenhuma ação adicional por enquanto.`);
            }

        } catch (error) {
            Logger.error(`Erro ao processar notificação de webhook do Mercado Pago: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
            // É importante não lançar um erro que derrube o servidor de webhook,
            // a menos que seja uma falha crítica na configuração.
            // O Mercado Pago pode tentar reenviar a notificação, então é bom logar bem o erro.
        }
    }

    private async sendPaymentNotification(payment: any, type: 'approved' | 'timeout'): Promise<void> {
        try {
            if (!this.whatsappClient) {
                Logger.error('Cliente WhatsApp não inicializado');
                return;
            }

            const userPhone = payment.metadata.userPhone;
            const packageInfo = PACKAGES[payment.metadata.packageType as PackageType];

            let message = '';
            if (type === 'approved') {
                message = '╭━━━━━━━━━━━━━━━━━━╮\n' +
                    '┃  *PAGAMENTO APROVADO*  ┃\n' +
                    '╰━━━━━━━━━━━━━━━━━━╯\n\n' +
                    '✨ *Seu pacote foi ativado!* ✨\n\n' +
                    `📦 *Pacote:* ${packageInfo.name}\n` +
                    `💰 *Valor:* R$ ${payment.amount.toFixed(2)}\n` +
                    `⏰ *Duração:* ${payment.metadata.duration} dias\n\n` +
                    '💝 Aproveite sua jornada no amor! 💘';
            } else {
                message = '╭━━━━━━━━━━━━━━━━━━╮\n' +
                    '┃  *TEMPO EXCEDIDO*  ┃\n' +
                    '╰━━━━━━━━━━━━━━━━━━╯\n\n' +
                    '⚠️ O tempo máximo de verificação do pagamento foi atingido.\n\n' +
                    'Caso ainda não tenha pago, use o comando cupido comprar novamente para gerar um novo código PIX.';
            }

            await this.whatsappClient.sendMessage(`${userPhone}@c.us`, message);

        } catch (error) {
            Logger.error(`Erro ao enviar notificação de pagamento: ${error}`);
        }
    }

    public async checkPaymentStatus(paymentId: string): Promise<string> {
        try {
            const payment = new Payment(this.mercadopago);
            const result = await payment.get({ id: parseInt(paymentId) });
            return result.status || 'unknown';
        } catch (error) {
            Logger.error(`Erro ao verificar status do pagamento: ${error}`);
            throw error;
        }
    }

    public isReady(): boolean {
        return this.isInitialized;
    }
} 