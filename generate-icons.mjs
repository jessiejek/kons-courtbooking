// Run once: node generate-icons.mjs
import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';

function makeIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#00694c';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.45}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('K', size / 2, size / 2);
  return canvas.toBuffer('image/png');
}

writeFileSync('public/icon-192.png', makeIcon(192));
writeFileSync('public/icon-512.png', makeIcon(512));
console.log('Icons generated.');
