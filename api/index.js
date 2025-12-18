// api/index.js
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const axios = require('axios');

// Inisialisasi font (sekali saja)
let fontsLoaded = false;

async function setupFonts() {
  if (fontsLoaded) return;
  
  try {
    // Download dan register fonts
    const [arrialF, ocrF, signF] = await Promise.all([
      axios.get('https://api.nekolabs.web.id/f/arrial.ttf', { responseType: 'arraybuffer' }),
      axios.get('https://api.nekolabs.web.id/f/ocr.ttf', { responseType: 'arraybuffer' }),
      axios.get('https://api.nekolabs.web.id/f/sign.otf', { responseType: 'arraybuffer' })
    ]);
    
    // Register fonts dari buffer (tanpa file system)
    GlobalFonts.register(arrialF.data, 'ArrialKTP');
    GlobalFonts.register(ocrF.data, 'OcrKTP');
    GlobalFonts.register(signF.data, 'SignKTP');
    
    fontsLoaded = true;
  } catch (error) {
    console.error('Error loading fonts:', error.message);
    throw error;
  }
}

async function ktpgen(data) {
  await setupFonts();
  
  const canvas = createCanvas(720, 463);
  const ctx = canvas.getContext('2d');
  
  // Load template dan foto
  const [templateImg, pasPhotoImg] = await Promise.all([
    loadImage('https://api.nekolabs.web.id/f/template.png'),
    loadImage(data.pas_photo)
  ]);
  
  // Helper functions
  const drawTextLeft = (x, y, text, font, size) => {
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x, y);
  };
  
  const drawTextCenter = (x, y, text, font, size) => {
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(text, x, y);
  };
  
  const upper = (s) => s.toUpperCase();
  
  // Draw template
  ctx.drawImage(templateImg, 0, 0, 720, 463);
  
  // Draw photo (dengan cropping yang benar)
  const PHOTO_X = 520;
  const PHOTO_Y = 80;
  const PHOTO_W = 200;
  const PHOTO_H = 280;
  
  const frameAspect = PHOTO_W / PHOTO_H;
  const imgAspect = pasPhotoImg.width / pasPhotoImg.height;
  
  let srcX, srcY, srcW, srcH;
  
  if (imgAspect > frameAspect) {
    srcH = pasPhotoImg.height;
    srcW = srcH * frameAspect;
    srcX = (pasPhotoImg.width - srcW) / 2;
    srcY = 0;
  } else {
    srcW = pasPhotoImg.width;
    srcH = srcW / frameAspect;
    srcX = 0;
    srcY = (pasPhotoImg.height - srcH) / 2;
  }
  
  const baseScale = Math.min(PHOTO_W / srcW, PHOTO_H / srcH);
  const SHRINK = 0.78;
  const scale = baseScale * SHRINK;
  
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const offsetLeft = -15;
  const drawX = PHOTO_X + (PHOTO_W - drawW) / 2 + offsetLeft;
  const drawY = PHOTO_Y + (PHOTO_H - drawH) / 2;
  
  ctx.drawImage(pasPhotoImg, srcX, srcY, srcW, srcH, drawX, drawY, drawW, drawH);
  
  // Draw text
  drawTextCenter(380, 45, `PROVINSI ${upper(data.provinsi)}`, 'ArrialKTP', 25);
  drawTextCenter(380, 70, `KOTA ${upper(data.kota)}`, 'ArrialKTP', 25);
  
  // NIK dengan font OCR
  ctx.font = '32px OcrKTP';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000000';
  ctx.fillText(data.nik, 170, 105);
  
  // Data lainnya
  drawTextLeft(190, 145, upper(data.nama), 'ArrialKTP', 16);
  drawTextLeft(190, 168, upper(data.ttl), 'ArrialKTP', 16);
  drawTextLeft(190, 191, upper(data.jenis_kelamin), 'ArrialKTP', 16);
  drawTextLeft(463, 190, upper(data.golongan_darah), 'ArrialKTP', 16);
  drawTextLeft(190, 212, upper(data.alamat), 'ArrialKTP', 16);
  drawTextLeft(190, 234, upper(data.rtRw), 'ArrialKTP', 16);
  drawTextLeft(190, 257, upper(data.kel_desa), 'ArrialKTP', 16);
  drawTextLeft(190, 279, upper(data.kecamatan), 'ArrialKTP', 16);
  drawTextLeft(190, 300, upper(data.agama), 'ArrialKTP', 16);
  drawTextLeft(190, 323, upper(data.status), 'ArrialKTP', 16);
  drawTextLeft(190, 346, upper(data.pekerjaan), 'ArrialKTP', 16);
  drawTextLeft(190, 369, upper(data.kewarganegaraan), 'ArrialKTP', 16);
  drawTextLeft(190, 390, upper(data.masa_berlaku), 'ArrialKTP', 16);
  
  drawTextLeft(553, 345, `KOTA ${upper(data.kota)}`, 'ArrialKTP', 12);
  drawTextLeft(570, 365, data.terbuat, 'ArrialKTP', 12);
  
  // Tanda tangan
  const sign = data.nama.split(' ')[0] || data.nama;
  ctx.font = '40px SignKTP';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(sign, 540, 395);
  
  return canvas.toBuffer('image/png');
}

// Handler untuk Vercel Serverless Function
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  // Handle OPTIONS request (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Hanya terima POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Hanya POST requests yang diperbolehkan'
    });
    return;
  }
  
  try {
    // Parse request body
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      res.status(400).json({ 
        error: 'Invalid JSON',
        message: 'Request body harus berupa JSON yang valid'
      });
      return;
    }
    
    // Validasi data yang diperlukan
    const requiredFields = ['nama', 'nik', 'pas_photo', 'provinsi', 'kota'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      res.status(400).json({ 
        error: 'Missing required fields',
        message: `Field berikut diperlukan: ${missingFields.join(', ')}`
      });
      return;
    }
    
    // Validasi NIK (16 digit)
    if (!/^\d{16}$/.test(body.nik)) {
      res.status(400).json({ 
        error: 'Invalid NIK',
        message: 'NIK harus 16 digit angka'
      });
      return;
    }
    
    // Generate KTP
    console.log('Generating KTP for:', body.nama);
    const ktpBuffer = await ktpgen(body);
    
    // Kirim response sebagai image PNG
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', ktpBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(ktpBuffer);
    
  } catch (error) {
    console.error('Error generating KTP:', error);
    
    // Kirim error response
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message || 'Terjadi kesalahan saat generate KTP'
    });
  }
};
