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
const userLastRequest = new Map();

const EXPIRATION_TIME = 10 * 60 * 1000; // 10 menit
const RATE_LIMIT_TIME = 30 * 1000; // 30 detik

const generateRandomDigits = () => {
    return Math.floor(Math.random() * (200 - 10 + 1)) + 10;
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

// Command /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Selamat datang di Bot QRIS Dinamis!\n\nUntuk menggunakan bot ini:\n1. Kirim foto QRIS statis\n2. Bot akan meminta nominal\n3. Masukkan nominal (angka saja)\n4. Bot akan mengirim QRIS dinamis yang berlaku selama 30 menit');
});

// Command /status
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const info = qrisExpiration.get(chatId);

    if (info) {
        const waktu = new Date(Date.now() + info.timeout._idleTimeout - info.timeout._idleStart);
        bot.sendMessage(chatId, `QRIS masih aktif hingga sekitar ${waktu.toLocaleTimeString('id-ID')}`);
    } else {
        bot.sendMessage(chatId, 'Tidak ada QRIS aktif saat ini.');
    }
});

// Command /cancel
bot.onText(/\/cancel/, (msg) => {
    const chatId = msg.chat.id;

    const currentState = userStates[chatId] || qrisExpiration.get(chatId);
    const filePath = currentState?.filePath || currentState?.path;

    if (filePath) {
        cleanupExpiredQRIS(chatId, filePath);
        bot.sendMessage(chatId, 'Proses dibatalkan dan QRIS dihapus.');
    } else {
        bot.sendMessage(chatId, 'Tidak ada proses yang sedang berjalan.');
    }
});

// Saat user kirim foto
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    // Rate limiting
    const lastRequestTime = userLastRequest.get(chatId) || 0;
    const now = Date.now();

    if (now - lastRequestTime < RATE_LIMIT_TIME) {
        const waitSeconds = Math.ceil((RATE_LIMIT_TIME - (now - lastRequestTime)) / 1000);
        return bot.sendMessage(chatId, `Tunggu ${waitSeconds} detik sebelum mengirim QR lagi.`);
    }

    userLastRequest.set(chatId, now);

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

// Saat user kirim nominal (angka)
bot.on('text', async (msg) => {
    const chatId = msg.chat.id;

    // Jika bukan dalam proses input nominal atau command
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

        const tanggal = new Date().toLocaleDateString('id-ID', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
        });

        const orderId = `ORD-${chatId}-${Date.now().toString().slice(-6)}`;

        await bot.sendPhoto(chatId, outputPath, {
            caption: `🧾 QRIS Dinamis
🆔 Order ID: ${orderId}
📅 Tanggal: ${tanggal}
💵 Nominal: Rp ${finalNominal.toLocaleString('id-ID')}
⏳ Berlaku hingga: ${expirationTimeString} (10 menit)`
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

// Jika polling error
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Saat proses dihentikan
process.on('SIGINT', async () => {
    for (const [chatId, data] of qrisExpiration.entries()) {
        clearTimeout(data.timeout);
        await cleanupExpiredQRIS(chatId, data.path);
    }
    process.exit(0);
});
