import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const svgPath = join(import.meta.dirname, '..', 'static', 'icon.svg');
const iconsDir = join(import.meta.dirname, '..', 'src-tauri', 'icons');

const svg = readFileSync(svgPath);

// All required icon sizes for Tauri
const icons = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
  // Windows Store logos
  { name: 'Square30x30Logo.png', size: 30 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
  { name: 'StoreLogo.png', size: 50 },
];

// Generate PNGs
for (const icon of icons) {
  await sharp(svg)
    .resize(icon.size, icon.size)
    .png()
    .toFile(join(iconsDir, icon.name));
  console.log(`Generated ${icon.name} (${icon.size}x${icon.size})`);
}

// Generate ICO (256x256 PNG inside, Windows uses this)
const ico256 = await sharp(svg).resize(256, 256).png().toBuffer();
const ico48 = await sharp(svg).resize(48, 48).png().toBuffer();
const ico32 = await sharp(svg).resize(32, 32).png().toBuffer();
const ico16 = await sharp(svg).resize(16, 16).png().toBuffer();

// Simple ICO generator - ICO format header + PNG data
function createIco(images) {
  // Each image: { buffer, width, height }
  const numImages = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;
  
  let offset = headerSize + dirSize;
  const entries = [];
  
  for (const img of images) {
    entries.push({ ...img, offset });
    offset += img.buffer.length;
  }
  
  const totalSize = offset;
  const buf = Buffer.alloc(totalSize);
  
  // ICO header
  buf.writeUInt16LE(0, 0);      // Reserved
  buf.writeUInt16LE(1, 2);      // Type: 1 = ICO
  buf.writeUInt16LE(numImages, 4); // Number of images
  
  // Directory entries
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const off = headerSize + i * dirEntrySize;
    buf.writeUInt8(e.width >= 256 ? 0 : e.width, off);      // Width
    buf.writeUInt8(e.height >= 256 ? 0 : e.height, off + 1); // Height
    buf.writeUInt8(0, off + 2);                                // Color palette
    buf.writeUInt8(0, off + 3);                                // Reserved
    buf.writeUInt16LE(1, off + 4);                             // Color planes
    buf.writeUInt16LE(32, off + 6);                            // Bits per pixel
    buf.writeUInt32LE(e.buffer.length, off + 8);               // Size of image data
    buf.writeUInt32LE(e.offset, off + 12);                     // Offset to image data
  }
  
  // Image data
  for (const e of entries) {
    e.buffer.copy(buf, e.offset);
  }
  
  return buf;
}

const icoBuffer = createIco([
  { buffer: ico256, width: 256, height: 256 },
  { buffer: ico48, width: 48, height: 48 },
  { buffer: ico32, width: 32, height: 32 },
  { buffer: ico16, width: 16, height: 16 },
]);

const { writeFileSync } = await import('fs');
writeFileSync(join(iconsDir, 'icon.ico'), icoBuffer);
console.log('Generated icon.ico');

// Generate ICNS for macOS (simplified - just use the 512px PNG wrapped)
// For a proper ICNS we'd need a dedicated tool, but Tauri can work with PNG fallback
// Let's create a minimal ICNS with the 256x256 icon
const icns512 = await sharp(svg).resize(512, 512).png().toBuffer();
const icns256 = await sharp(svg).resize(256, 256).png().toBuffer();

function createIcns(images) {
  // ICNS format: magic + size, then icon entries
  // ic08 = 256x256 PNG, ic09 = 512x512 PNG, ic10 = 1024x1024 PNG
  const entries = [
    { type: 'ic08', buffer: images[1] }, // 256x256
    { type: 'ic09', buffer: images[0] }, // 512x512
  ];
  
  let totalSize = 8; // header
  for (const e of entries) {
    totalSize += 8 + e.buffer.length;
  }
  
  const buf = Buffer.alloc(totalSize);
  buf.write('icns', 0, 4, 'ascii');
  buf.writeUInt32BE(totalSize, 4);
  
  let offset = 8;
  for (const e of entries) {
    buf.write(e.type, offset, 4, 'ascii');
    buf.writeUInt32BE(8 + e.buffer.length, offset + 4);
    e.buffer.copy(buf, offset + 8);
    offset += 8 + e.buffer.length;
  }
  
  return buf;
}

const icnsBuffer = createIcns([icns512, icns256]);
writeFileSync(join(iconsDir, 'icon.icns'), icnsBuffer);
console.log('Generated icon.icns');

// Also generate a tray icon (32x32 for tray)
await sharp(svg)
  .resize(32, 32)
  .png()
  .toFile(join(iconsDir, 'tray-icon.png'));
console.log('Generated tray-icon.png');

console.log('\nAll icons generated successfully!');
