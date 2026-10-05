import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logoDir = path.resolve(__dirname, '../../Final_Logos/TextureLAB/dist');
const buildDir = path.resolve(__dirname, '../build');

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const sizeConfigs = [
  { size: 16, file: 'favicon-16.png' },
  { size: 32, file: 'texturelab-symbol-final-app-icon-32.png' },
  { size: 64, file: 'texturelab-symbol-final-app-icon-64.png' },
  { size: 128, file: 'texturelab-symbol-final-app-icon-128.png' },
  { size: 256, file: 'texturelab-symbol-final-app-icon-256.png' },
];
const images = [];

for (const cfg of sizeConfigs) {
  const pngPath = path.join(logoDir, cfg.file);
  if (!fs.existsSync(pngPath)) {
    console.error(`Missing size: ${pngPath}`);
    process.exit(1);
  }
  const data = fs.readFileSync(pngPath);
  images.push({ size: cfg.size, data });
}

// Write multi-resolution ICO (PNG embedded)
const headerSize = 6;
const dirEntrySize = 16;
let offset = headerSize + dirEntrySize * images.length;

const icoHeader = Buffer.alloc(headerSize);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type: 1 = ICO
icoHeader.writeUInt16LE(images.length, 4); // number of images

const entries = [];
for (const img of images) {
  const entry = Buffer.alloc(dirEntrySize);
  entry.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // width
  entry.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // height
  entry.writeUInt8(0, 2); // color count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(img.data.length, 8); // image size
  entry.writeUInt32LE(offset, 12); // image offset
  entries.push(entry);
  offset += img.data.length;
}

const icoBuffer = Buffer.concat([icoHeader, ...entries, ...images.map((i) => i.data)]);
const destPath = path.join(buildDir, 'icon.ico');
fs.writeFileSync(destPath, icoBuffer);
console.log(`Generated multi-res icon.ico (${icoBuffer.length} bytes) at ${destPath}`);
