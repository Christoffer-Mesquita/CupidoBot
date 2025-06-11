import { createCanvas, loadImage, registerFont } from 'canvas';
import path from 'path';

export class BannerService {
    private static instance: BannerService;

    private constructor() {}

    public static getInstance(): BannerService {
        if (!BannerService.instance) {
            BannerService.instance = new BannerService();
        }
        return BannerService.instance;
    }

    public async createHelpBanner(): Promise<string> {
        const width = 800;
        const height = 300;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#ff69b4');  // Hot pink
        gradient.addColorStop(1, '#ff1493');  // Deep pink
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Add decorative hearts pattern
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 30 + 10;
            this.drawHeart(ctx, x, y, size);
        }

        // Add title
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Cupid Bot', width/2, 100);

        // Add subtitle
        ctx.font = '24px Arial';
        ctx.fillText('Seu Assistente do Amor', width/2, 140);

        // Add decorative border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 5;
        ctx.strokeRect(10, 10, width-20, height-20);

        // Convert to base64
        return canvas.toDataURL('image/png').split(',')[1];
    }

    private drawHeart(ctx: any, x: number, y: number, size: number) {
        ctx.beginPath();
        ctx.moveTo(x, y + size / 4);
        ctx.quadraticCurveTo(x, y, x + size / 4, y);
        ctx.quadraticCurveTo(x + size / 2, y, x + size / 2, y + size / 4);
        ctx.quadraticCurveTo(x + size / 2, y, x + size * 3/4, y);
        ctx.quadraticCurveTo(x + size, y, x + size, y + size / 4);
        ctx.quadraticCurveTo(x + size, y + size / 2, x + size / 2, y + size * 3/4);
        ctx.quadraticCurveTo(x, y + size / 2, x, y + size / 4);
        ctx.fill();
    }

    public async createMessageBanner(
        isVIP: boolean = false,
        senderPicture?: string,
        receiverPicture?: string
    ): Promise<string> {
        const width = 800;
        const height = 300;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Gradient background - different colors for VIP
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        if (isVIP) {
            gradient.addColorStop(0, '#FFD700');  // Gold
            gradient.addColorStop(1, '#FFA500');  // Orange
        } else {
            gradient.addColorStop(0, '#ff69b4');  // Hot pink
            gradient.addColorStop(1, '#ff1493');  // Deep pink
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Add decorative hearts pattern
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 20 + 10;
            this.drawHeart(ctx, x, y, size);
        }

        // Check if both pictures are available
        if (senderPicture && receiverPicture) {
            try {
                // Load and draw profile pictures
                const senderImg = await loadImage(senderPicture);
                const receiverImg = await loadImage(receiverPicture);

                // Create circular clips for profile pictures
                const picSize = 100;
                
                // Draw sender picture (left side)
                ctx.save();
                ctx.beginPath();
                ctx.arc(120, height/2, picSize/2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(senderImg, 70, height/2 - picSize/2, picSize, picSize);
                ctx.restore();

                // Draw receiver picture (right side)
                ctx.save();
                ctx.beginPath();
                ctx.arc(width - 120, height/2, picSize/2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(receiverImg, width - 170, height/2 - picSize/2, picSize, picSize);
                ctx.restore();

                // Draw connecting heart between pictures
                ctx.fillStyle = isVIP ? 'rgba(255, 215, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)';
                this.drawHeart(ctx, width/2 - 25, height/2 - 25, 50);

                // Add glowing effect around pictures
                ctx.shadowBlur = 20;
                ctx.shadowColor = isVIP ? '#FFD700' : '#ff69b4';
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(120, height/2, picSize/2 + 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(width - 120, height/2, picSize/2 + 5, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Add message at the top
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                
                if (isVIP) {
                    ctx.font = 'bold 40px Arial';
                    ctx.fillText('✨ Mensagem VIP ✨', width/2, 60);
                    ctx.font = '28px Arial';
                    ctx.fillText('Enviada com Carinho Especial', width/2, height - 40);
                } else {
                    ctx.font = 'bold 36px Arial';
                    ctx.fillText('💌 Mensagem Especial 💌', width/2, 60);
                    ctx.font = '24px Arial';
                    ctx.fillText('Enviada com Amor', width/2, height - 40);
                }
                ctx.shadowBlur = 0;
            } catch (error) {
                console.error('Error loading profile pictures:', error);
                // If there's an error loading pictures, fall back to the default banner
                this.drawDefaultBanner(ctx, width, height, isVIP);
            }
        } else {
            // If no pictures are provided, draw the default banner
            this.drawDefaultBanner(ctx, width, height, isVIP);
        }

        // Add decorative border with double line effect
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, width-20, height-20);
        ctx.strokeRect(15, 15, width-30, height-30);

        // Convert to base64
        return canvas.toDataURL('image/png').split(',')[1];
    }

    private drawDefaultBanner(ctx: any, width: number, height: number, isVIP: boolean) {
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        
        if (isVIP) {
            ctx.font = 'bold 40px Arial';
            ctx.fillText('✨ Mensagem VIP ✨', width/2, height/2 - 20);
            ctx.font = '28px Arial';
            ctx.fillText('Enviada com Carinho Especial', width/2, height/2 + 30);
        } else {
            ctx.font = 'bold 36px Arial';
            ctx.fillText('💌 Mensagem Especial 💌', width/2, height/2 - 20);
            ctx.font = '24px Arial';
            ctx.fillText('Enviada com Amor', width/2, height/2 + 30);
        }
        ctx.shadowBlur = 0;
    }
} 