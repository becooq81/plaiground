#!/usr/bin/env node

/**
 * Simple icon generator for Chrome extension
 * Creates placeholder PNG icons if they don't exist
 * 
 * Usage: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Check if we're in a browser environment or Node.js
if (typeof window !== 'undefined') {
  console.error('This script should be run with Node.js, not in a browser');
  process.exit(1);
}

const ICON_DIR = path.join(__dirname, 'icons');
const sizes = [16, 48, 128];
const color = '#667eea'; // Brand color

console.log('🎨 Generating placeholder icons...\n');

// Create a simple SVG icon
function createSVG(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${color}" rx="${size * 0.2}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.6}" 
        fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">P</text>
</svg>`;
}

// Save SVG files
sizes.forEach(size => {
  const svgPath = path.join(ICON_DIR, `icon${size}.svg`);
  const svgContent = createSVG(size);
  
  try {
    fs.writeFileSync(svgPath, svgContent);
    console.log(`✓ Created ${svgPath}`);
  } catch (error) {
    console.error(`✗ Failed to create ${svgPath}:`, error.message);
  }
});

console.log('\n📝 SVG icons created!');
console.log('\n💡 To convert SVG to PNG, you can:');
console.log('   1. Use an online converter like https://cloudconvert.com/svg-to-png');
console.log('   2. Use a tool like ImageMagick: convert icon16.svg icon16.png');
console.log('   3. Use a design tool like Figma or Sketch');
console.log('   4. Keep the SVG files and update manifest.json to use them\n');
console.log('⚠️  Note: Chrome extensions officially require PNG, but SVG works in development mode\n');

