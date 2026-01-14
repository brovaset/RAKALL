// Quick script to copy logo to public folder
const fs = require('fs');
const path = require('path');

const sourceLogo = path.join(__dirname, '..', 'logo.png');
const publicDir = path.join(__dirname, 'public');
const destLogo = path.join(publicDir, 'logo.png');

try {
  // Create public directory
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // Copy logo
  if (fs.existsSync(sourceLogo)) {
    fs.copyFileSync(sourceLogo, destLogo);
    console.log('✅ Logo copied successfully to public/logo.png');
  } else {
    console.log('❌ Logo not found at:', sourceLogo);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}
