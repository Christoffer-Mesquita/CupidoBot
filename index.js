const venom = require('venom-bot');
const fs = require('fs');
const path = require('path');

const screenshotDir = path.join(__dirname, 'screenshot');
if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
}

venom
    .create({
        session: 'bot-session',
        multidevice: true,
        puppeteerOptions: {
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080'
            ],
            headless: true,
            defaultViewport: null
        },
        chromiumArgs: [
            '--disable-web-security',
            '--no-sandbox',
            '--disable-web-security',
            '--aggressive-cache-discard',
            '--disable-cache',
            '--disable-application-cache',
            '--disable-offline-load-stale-cache',
            '--disk-cache-size=0'
        ]
    })
    .then((client) => start(client))
    .catch((error) => {
        console.log('Error creating client:', error);
    });

async function start(client) {
    try {
        console.log('Bot is ready!');
        
        const page = await client.page;
        const screenshotPath = path.join(screenshotDir, 'whatsapp-connection.png');
        
        if (fs.existsSync(screenshotPath)) {
            fs.unlinkSync(screenshotPath);
        }
        
        await page.screenshot({
            path: screenshotPath,
            fullPage: true
        });
        
        console.log('Screenshot saved successfully at:', screenshotPath);

    } catch (error) {
        console.error('Error in start function:', error);
    }
} 