import qrcode from "qrcode";

// Fungsi CRC16 untuk generate checksum QRIS
function toCRC16(str) {
    let crc = 0xffff;
    for (let c = 0; c < str.length; c++) {
        crc ^= str.charCodeAt(c) << 8;
        for (let i = 0; i < 8; i++) {
            crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        }
    }
    let hex = (crc & 0xffff).toString(16).toUpperCase();
    return hex.padStart(4, "0");
}

// Fungsi utama: mengubah QRIS statis menjadi dinamis & simpan ke file
async function qrisDinamis(qrstring, nominal, path) {
    const base = qrstring.slice(0, -4).replace("010211", "010212");
    const parts = base.split("5802ID");
    const nominalTag =
        "54" + nominal.toString().padStart(2, "0") + nominal + "5802ID";
    const payload = parts[0] + nominalTag + parts[1];
    const crc = toCRC16(payload);
    const output = payload + crc;

    await qrcode.toFile(path, output, { margin: 2, scale: 10 });
    return path;
}

// Versi buffer (tanpa file) – cocok untuk kirim ke Telegram, dsb.
async function qrisDinamisBuffer(qrstring, nominal) {
    const base = qrstring.slice(0, -4).replace("010211", "010212");
    const parts = base.split("5802ID");
    const nominalTag =
        "54" + nominal.toString().padStart(2, "0") + nominal + "5802ID";
    const payload = parts[0] + nominalTag + parts[1];
    const crc = toCRC16(payload);
    const output = payload + crc;

    return await qrcode.toBuffer(output, { margin: 2, scale: 10 });
}

export { qrisDinamis, qrisDinamisBuffer, toCRC16 };
