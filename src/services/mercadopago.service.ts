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
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || 'APP_USR-6757036394702521-060908-53ba606a7aca64317acbce1cdb1d1a8a-118720625';
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

            this.pollPaymentStatus(paymentId);

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

    private async pollPaymentStatus(paymentId: string): Promise<void> {
        const maxAttempts = 24; // 2 minutes = 24 attempts (5 seconds each)
        let attempts = 0;

        const checkStatus = async () => {
            try {
                const status = await this.checkPaymentStatus(paymentId);
                Logger.info(`Status do pagamento ${paymentId}: ${status}`);

                const payment = await PaymentModel.findOne({ mercadoPagoId: paymentId });
                if (!payment) {
                    Logger.error(`Pagamento ${paymentId} não encontrado no banco de dados`);
                    return;
                }

                // Update payment status in database
                await PaymentModel.findOneAndUpdate(
                    { mercadoPagoId: paymentId },
                    { $set: { status: status } }
                );

                if (status === 'approved') {
                    Logger.success(`Pagamento ${paymentId} aprovado! 💚`);
                    
                    // Update user subscription
                    if (!payment.metadata) {
                        Logger.error('Metadados do pagamento não encontrados');
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

                    // Send success message
                    await this.sendPaymentNotification(payment, 'approved');
                    return;
                }

                attempts++;
                if (attempts >= maxAttempts) {
                    Logger.warning(`Tempo limite excedido para pagamento ${paymentId}`);
                    // Send timeout message
                    await this.sendPaymentNotification(payment, 'timeout');
                    return;
                }

                setTimeout(checkStatus, 5000);
            } catch (error) {
                Logger.error(`Erro ao verificar status do pagamento ${paymentId}: ${error}`);
            }
        };

        checkStatus();
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