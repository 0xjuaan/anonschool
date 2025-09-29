const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateFavicons() {
  const inputFile = path.join(__dirname, '../public/favicon.png');
  const outputDir = path.join(__dirname, '../public');

  // Generate different sizes
  await sharp(inputFile)
    .resize(16, 16)
    .png()
    .toFile(path.join(outputDir, 'favicon-16x16.png'));

  await sharp(inputFile)
    .resize(32, 32)
    .png()
    .toFile(path.join(outputDir, 'favicon-32x32.png'));

  await sharp(inputFile)
    .resize(180, 180)
    .png()
    .toFile(path.join(outputDir, 'apple-touch-icon.png'));

  // For favicon.ico, we'll create a 32x32 ICO
  await sharp(inputFile)
    .resize(32, 32)
    .toFormat('ico')
    .toFile(path.join(outputDir, 'favicon.ico'));
}

generateFavicons().catch(console.error);
