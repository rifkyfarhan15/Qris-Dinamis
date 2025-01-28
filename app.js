import TelegramBot from 'node-telegram-bot-api';
import { qrisDinamis } from './qrDinamis.js';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import QrCode from 'qrcode-reader';
import { createRequire } from 'module';
import dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const Jimp = require('jimp');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const bot = new TelegramBot(process.env.TOKEN_BOTMU, { polling: true });

const userStates = {};
const qrisExpiration = new Map();

const EXPIRATION_TIME = 30 * 60 * 1000;

const generateRandomDigits = () => {
    return Math.floor(Math.random() * 900) + 100;
};

const cleanupExpiredQRIS = async (chatId, filePath) => {
    try {
        if (filePath && await fs.access(filePath).then(() => true).catch(() => false)) {
            await fs.unlink(filePath);
        }
        delete userStates[chatId];
        qrisExpiration.delete(chatId);
    } catch (error) {
        console.error('Error cleaning up files:', error);
    }
};

const readQRCode = (imagePath) => {
    return new Promise((resolve, reject) => {
        Jimp.read(imagePath)
            .then(image => {
                const qr = new QrCode();
                
                qr.callback = (err, value) => {
                    if (err) {
                        reject(new Error('Gagal membaca QR Code: ' + err.message));
                        return;
                    }
                    
                    if (!value || !value.result) {
                        reject(new Error('QR Code tidak terdeteksi'));
                        return;
                    }
                    
                    if (!value.result.includes('00020101')) {
                        reject(new Error('Bukan format QRIS yang valid'));
                        return;
                    }
                    
                    resolve(value.result);
                };
                
                qr.decode(image.bitmap);
            })
            .catch(err => {
                reject(new Error('Gagal memproses gambar: ' + err.message));
            });
    });
};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Selamat datang di Bot QRIS Dinamis!\n\nUntuk menggunakan bot ini:\n1. Kirim foto QRIS statis\n2. Bot akan meminta nominal\n3. Masukkan nominal (angka saja)\n4. Bot akan mengirim QRIS dinamis yang berlaku selama 30 menit');
});

bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    try {
        const photo = msg.photo[msg.photo.length - 1];
        const filePath = path.join(__dirname, `temp_${chatId}.jpg`);
        
        const fileStream = await bot.getFile(photo.file_id);
        const downloadedFile = await bot.downloadFile(fileStream.file_id, __dirname);
        await fs.rename(downloadedFile, filePath);
        
        const qrisString = await readQRCode(filePath);

        userStates[chatId] = {
            qrisString: qrisString,
            filePath: filePath
        };

        bot.sendMessage(chatId, 'QRIS berhasil dibaca. Silakan masukkan nominal (angka saja)');
    } catch (error) {
        bot.sendMessage(chatId, 'Terjadi kesalahan: ' + (error.message || 'Gagal membaca QR Code'));
        if (userStates[chatId]?.filePath) {
            await cleanupExpiredQRIS(chatId, userStates[chatId].filePath);
        }
    }
});

bot.on('text', async (msg) => {
    const chatId = msg.chat.id;
    
    if (!userStates[chatId] || msg.text.startsWith('/')) {
        return;
    }

    try {
        const baseNominal = parseInt(msg.text);
        if (isNaN(baseNominal)) {
            throw new Error('Nominal harus berupa angka');
        }

        const randomDigits = generateRandomDigits();
        const finalNominal = parseInt(`${baseNominal}${randomDigits}`);

        const outputPath = path.join(__dirname, `qris_dynamic_${chatId}.jpg`);
        await qrisDinamis(userStates[chatId].qrisString, finalNominal, outputPath);

        const expirationTime = Date.now() + EXPIRATION_TIME;
        qrisExpiration.set(chatId, {
            path: outputPath,
            timeout: setTimeout(() => cleanupExpiredQRIS(chatId, outputPath), EXPIRATION_TIME)
        });

        const expirationTimeString = new Date(expirationTime).toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        await bot.sendPhoto(chatId, outputPath, {
            caption: `QRIS Dinamis dengan nominal Rp ${finalNominal.toLocaleString('id-ID')}\nBerlaku hingga: ${expirationTimeString} (30 menit)`
        });

        await fs.unlink(userStates[chatId].filePath);
        delete userStates[chatId];
    } catch (error) {
        bot.sendMessage(chatId, 'Terjadi kesalahan: ' + (error.message || 'Gagal membuat QRIS dinamis'));
        if (userStates[chatId]?.filePath) {
            await cleanupExpiredQRIS(chatId, userStates[chatId].filePath);
        }
    }
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

process.on('SIGINT', async () => {
    for (const [chatId, data] of qrisExpiration.entries()) {
        clearTimeout(data.timeout);
        await cleanupExpiredQRIS(chatId, data.path);
    }
    process.exit(0);
});
