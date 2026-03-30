/**
 * Create a portable.txt marker file in the portable build
 * This helps the application detect it's running in portable mode
 */

const fs = require('fs');
const path = require('path');

// Find the portable executable in dist folder
const distFolder = path.join(__dirname, '..', 'dist');

if (!fs.existsSync(distFolder)) {
  console.log('Dist folder not found, skipping marker creation');
  process.exit(0);
}

const files = fs.readdirSync(distFolder);
const portableExe = files.find(f => f.includes('Portable') && f.endsWith('.exe'));

if (portableExe) {
  // Create marker file
  const markerPath = path.join(distFolder, 'portable.txt');
  const markerContent = `ICAC P.U.L.S.E. Portable Mode Marker
  
This file indicates the application should run in portable mode.
Data will be stored next to the executable in the ICAC_Data folder.

Do not delete this file.
`;
  
  fs.writeFileSync(markerPath, markerContent);
  console.log('✓ Created portable mode marker file:', markerPath);
  console.log('✓ Portable executable:', portableExe);
  console.log('');
  console.log('IMPORTANT: When distributing the portable version:');
  console.log('  1. Copy both files to the USB/external drive:');
  console.log('     - ' + portableExe);
  console.log('     - portable.txt');
  console.log('  2. Keep them in the same folder');
  console.log('  3. The ICAC_Data folder will be created automatically on first run');
} else {
  console.log('No portable executable found in dist folder');
}
