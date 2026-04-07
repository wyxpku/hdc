# hdc-node

Node.js implementation of OpenHarmony HDC (Host Device Connector).

## What is HDC?

HDC (OpenHarmony Device Connector) is a command-line tool for developers to connect and debug OpenHarmony devices, similar to Android's ADB.

### Architecture

- **hdc client**: CLI tool running on development machine
- **hdc server**: Background process managing device connections
- **hdc daemon**: Runs on OpenHarmony device

### Features

- Device connection (USB/TCP)
- File transfer (send/recv)
- Shell access
- Port forwarding
- App installation
- Log viewing

## Installation

```bash
npm install -g hdc-node
```

## Usage

```bash
# List connected devices
hdc list targets

# Shell access
hdc shell

# File transfer
hdc file send local.txt /data/local/tmp/remote.txt
hdc file recv /data/local/tmp/remote.txt local.txt

# Install app
hdc install app.hap
```

## Development

```bash
npm install
npm run build
npm test
```

## License

Apache-2.0
