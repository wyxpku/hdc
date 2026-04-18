# HDC Node.js - OpenHarmony Device Connector

完整的 OpenHarmony HDC (Harmony Device Connector) TypeScript 实现

## 项目来源

基于 OpenHarmony 官方 C++ 实现移植：
- **原始项目**: https://gitcode.com/openharmony/developtools_hdc.git
- **TypeScript 移植**: https://github.com/wyxpku/hdc.git

## 安装

```bash
git clone https://github.com/wyxpku/hdc.git
cd hdc
npm install
npm run build
```

## CLI 使用

```bash
# 启动服务端
node dist/cli.js --server

# 列出设备
node dist/cli.js list targets

# 执行 Shell 命令
node dist/cli.js shell ls -la

# 文件传输
node dist/cli.js file send /local/file /remote/path
node dist/cli.js file recv /remote/file /local/path

# 端口转发
node dist/cli.js fport add 8080 8080

# 应用管理
node dist/cli.js install /path/to/app.hap
node dist/cli.js uninstall com.example.app

# 日志查看
node dist/cli.js hilog -t TAG
```

## API 使用

```typescript
import { HdcClient } from './host/client.js';

// 连接到 HDC 服务器
const client = new HdcClient({ host: '127.0.0.1', port: 8710 });
await client.connect();

// 执行命令
const result = await client.executeCommand('shell ls /data/local/tmp');
console.log(result);

await client.disconnect();
```

## 许可证

Apache-2.0 (与原始项目一致)
