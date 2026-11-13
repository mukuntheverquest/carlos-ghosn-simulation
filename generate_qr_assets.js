const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

async function generateQRCodes() {
  const targetUrl = process.argv[2] || 'https://carlos-ghosn-simulation.onrender.com';
  const outputDir = path.resolve(__dirname, '..');
  const outputPath = path.join(outputDir, 'Carlos_Ghosn_Simulation_QR_Code.png');
  const publicOutputPath = path.join(__dirname, 'public', 'simulation_qr.png');

  console.log(`Generating high-resolution QR Code for: ${targetUrl}`);

  const options = {
    errorCorrectionLevel: 'H',
    type: 'png',
    quality: 1.0,
    margin: 3,
    color: {
      dark: '#0F172A',  // Dark navy matching our presentation palette
      light: '#FFFFFF'
    },
    width: 1200
  };

  await QRCode.toFile(outputPath, targetUrl, options);
  await QRCode.toFile(publicOutputPath, targetUrl, options);

  console.log(`✓ High-resolution QR Code saved to: ${outputPath}`);
  console.log(`✓ Web asset QR Code saved to: ${publicOutputPath}`);
}

generateQRCodes().catch(err => {
  console.error('Error generating QR code:', err);
  process.exit(1);
});
