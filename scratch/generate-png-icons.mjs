import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Table for CRC32 calculation
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function generatePng(size) {
  const width = size;
  const height = size;

  // Raw image bytes: (width * 4 + 1 filter byte) per row
  const rowLength = width * 4 + 1;
  const rawData = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Base background: warm parchment #F5F1EA
      let r = 0xf5, g = 0xf1, b = 0xea, a = 0xff;

      // Normalize coordinates
      const nx = x / width;
      const ny = y / height;

      // Book rectangle boundaries: x: 0.18 to 0.82, y: 0.14 to 0.86
      const inBookX = nx >= 0.18 && nx <= 0.82;
      const inBookY = ny >= 0.14 && ny <= 0.86;

      if (inBookX && inBookY) {
        // Book leather color (#845E3D)
        r = 0x84; g = 0x5e; b = 0x3d;

        // Book spine fold line on left (nx around 0.28)
        if (Math.abs(nx - 0.28) < 0.01) {
          r = 0x5e; g = 0x3e; b = 0x22;
        }

        // Gold bookmark ribbon (nx: 0.40 to 0.50, ny: 0.14 to 0.48)
        if (nx >= 0.40 && nx <= 0.50 && ny >= 0.14 && ny <= 0.48) {
          // Notch at bottom of ribbon
          const isRibbonNotch = ny > 0.43 && Math.abs(nx - 0.45) < (ny - 0.43) * 1.5;
          if (!isRibbonNotch) {
            r = 0xdc; g = 0xa5; b = 0x5c; // Rich gold
          }
        }

        // Page edge on the right
        if (nx >= 0.77 && nx <= 0.80) {
          r = 0xfc; g = 0xfb; b = 0xf7; // Paper white
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // PNG Header
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression method
  ihdrData[11] = 0; // Filter method
  ihdrData[12] = 0; // Interlace method (no interlace)
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);

  // IEND chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdr, idat, iend]);
}

const iconsDir = path.resolve('public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), generatePng(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), generatePng(512));
fs.writeFileSync(path.join(iconsDir, 'maskable-icon-512.png'), generatePng(512));

console.log('Generated icon-192.png, icon-512.png, and maskable-icon-512.png successfully.');
