# Extension Icons

Place your extension icons in this directory:

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon48.png` - 48x48 pixels (extension management page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Quick Icon Generation

You can:
1. Create icons using design tools (Figma, Sketch, etc.)
2. Use online generators like [favicon.io](https://favicon.io)
3. Use the placeholder script below to generate simple colored icons

## Temporary Placeholder

For development, you can use any PNG images with the correct dimensions or generate them using tools like ImageMagick:

```bash
# If you have ImageMagick installed:
convert -size 16x16 xc:#667eea icons/icon16.png
convert -size 48x48 xc:#667eea icons/icon48.png
convert -size 128x128 xc:#667eea icons/icon128.png
```

Or simply create simple colored squares in any image editor.

