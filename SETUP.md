# Setup Instructions

## Install Dependencies

Run this command in the `rakall-repo` directory:

```bash
cd /Users/atanda98/RAKALL/rakall-repo
npm install --legacy-peer-deps
```

## Start Development Server

After dependencies are installed, run:

```bash
npm run dev
```

The server will start and you'll see output like:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: http://192.168.x.x:3000/
```

## Access from External Browser

1. **On the same network**: Use the Network URL shown (e.g., `http://192.168.x.x:3000/`)
2. **From your computer's IP**: Find your IP address and use `http://YOUR_IP:3000/`

To find your IP address:
- **Mac/Linux**: Run `ifconfig | grep "inet "` or `ipconfig getifaddr en0`
- **Windows**: Run `ipconfig` and look for IPv4 Address

## Troubleshooting

If port 3000 is already in use:
- The server will automatically try the next available port
- Check the terminal output for the actual port number
- Or kill the process using port 3000: `lsof -ti:3000 | xargs kill -9`
