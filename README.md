# hdc-node

Node.js implementation of [OpenHarmony HDC](https://gitcode.com/openharmony/developtools_hdc.git) (Host Device Connector) — the debugging and file transfer tool for HarmonyOS / OpenHarmony devices.

[中文文档](README.zh.md)

## Install

```bash
npm install -g hdc-node
```

After installation, the `hdc` command is available:

```bash
hdc list targets
```

**Requirements:** Node.js >= 18. For USB device discovery, the official [HDC SDK](https://developer.huawei.com/consumer/en/download/) should also be installed (hdc-node auto-detects and uses it).

## CLI Usage

```bash
# List connected devices
hdc list targets

# Interactive shell on device
hdc shell

# Run a one-shot command
hdc shell ls -la /data/local/tmp

# File transfer
hdc file send ./local.txt /data/local/tmp/
hdc file recv /data/local/tmp/remote.txt        # defaults to current dir
hdc file recv /data/local/tmp/remote.txt ./

# Port forwarding
hdc fport tcp:8080 tcp:8080
hdc fport ls
hdc fport rm tcp:8080 tcp:8080

# Install / uninstall apps
hdc install /path/to/app.hap
hdc uninstall com.example.app

# View device logs
hdc hilog

# Server management
hdc start          # start server
hdc kill           # kill server
hdc kill -r        # kill and restart
```

## Programmatic API

```typescript
import { HdcClient } from 'hdc-node';

const client = new HdcClient({ host: '127.0.0.1', port: 8710 });
await client.connect();

const result = await client.executeCommand('shell ls /data/local/tmp');
console.log(result);

await client.disconnect();
```

## Supported Commands

| Command | Description |
|---------|-------------|
| `shell [cmd]` | Interactive or one-shot shell |
| `list targets` | List connected devices |
| `file send/recv` | File transfer |
| `install/uninstall` | App management |
| `fport/rport` | Port forwarding |
| `hilog` | Device log viewer |
| `tconn` | TCP device connection |
| `tmode` | Switch USB/TCP mode |
| `smode` | Toggle root mode |
| `target boot` | Reboot device |
| `keygen` | Generate RSA keypair |
| `start/kill` | Server lifecycle |

## How It Works

hdc-node follows the same client-server architecture as the official HDC tool:

```
[hdc CLI] --TCP channel--> [HDC Server] --USB/TCP session--> [Device Daemon]
```

- **Client** (`hdc` command) connects to the server via TCP on port 8710
- **Server** discovers USB devices and maintains sessions with device daemons
- When the official `hdc` binary is in PATH, hdc-node auto-starts the official server for USB device discovery

## Related

- **Original C++ implementation**: <https://gitcode.com/openharmony/developtools_hdc.git>
- **This project**: <https://github.com/wyxpku/hdc>

## License

Apache-2.0
