# Copy Logo Instructions

To make the logo appear in the app, you need to copy the logo file to the public folder.

## Quick Method (Terminal):

```bash
cd /Users/atanda98/RAKALL/rakall-repo
mkdir -p public
cp ../logo.png public/logo.png
```

## Or using the setup script:

```bash
cd /Users/atanda98/RAKALL/rakall-repo
node setup-logo.js
```

## Manual Method (Finder):

1. Open Finder
2. Navigate to: `/Users/atanda98/RAKALL/`
3. Copy the file `logo.png`
4. Navigate to: `/Users/atanda98/RAKALL/rakall-repo/`
5. Create a folder named `public` if it doesn't exist
6. Paste `logo.png` into the `public` folder

The logo should now appear when you run `npm run dev`!
