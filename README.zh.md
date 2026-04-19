# hdc-node

[OpenHarmony HDC](https://gitcode.com/openharmony/developtools_hdc.git) (Harmony Device Connector) 的 Node.js 实现 —— HarmonyOS / OpenHarmony 设备的调试与文件传输工具。

[English](README.md)

## 安装

```bash
npm install -g hdc-node
```

安装后即可使用 `hdc` 命令：

```bash
hdc list targets
```

**前置条件：** Node.js >= 18。USB 设备发现需要同时安装官方 [HDC SDK](https://developer.huawei.com/consumer/cn/download/)（hdc-node 会自动检测并使用）。

## 常用命令

```bash
hdc list targets              # 列出已连接设备
hdc shell                     # 交互式 Shell
hdc shell ls /data/local/tmp  # 执行单条命令
hdc file send ./app.hap /data/local/tmp/  # 推送文件
hdc file recv /data/log.txt               # 拉取文件到当前目录
hdc file recv /data/log.txt ./            # 指定本地路径
hdc install /path/to/app.hap  # 安装应用
hdc uninstall com.example.app # 卸载应用
hdc fport tcp:8080 tcp:8080   # 端口转发
hdc hilog                     # 查看设备日志
hdc start                     # 启动服务端
hdc kill                      # 停止服务端
hdc kill -r                   # 停止并重启服务端
```

## 编程接口

```typescript
import { HdcClient } from 'hdc-node';

const client = new HdcClient({ host: '127.0.0.1', port: 8710 });
await client.connect();

const result = await client.executeCommand('shell ls /data/local/tmp');
console.log(result);

await client.disconnect();
```

## 支持的命令

| 命令 | 说明 |
|------|------|
| `shell [cmd]` | 交互式或单次 Shell |
| `list targets` | 列出已连接设备 |
| `file send/recv` | 文件传输 |
| `install/uninstall` | 应用安装/卸载 |
| `fport/rport` | 端口转发 |
| `hilog` | 设备日志查看 |
| `tconn` | TCP 设备连接 |
| `tmode` | 切换 USB/TCP 模式 |
| `smode` | 切换 Root 模式 |
| `target boot` | 重启设备 |
| `keygen` | 生成 RSA 密钥对 |
| `start/kill` | 服务端管理 |

## 工作原理

hdc-node 采用与官方 HDC 工具相同的客户端-服务端架构：

```
[hdc CLI] --TCP 通道--> [HDC 服务端] --USB/TCP 会话--> [设备守护进程]
```

- **客户端**（`hdc` 命令）通过 TCP 端口 8710 连接服务端
- **服务端**发现 USB 设备并维护与设备守护进程的会话
- 当官方 `hdc` 工具在 PATH 中时，hdc-node 自动使用官方服务端进行 USB 设备发现

## 相关链接

- **官方 C++ 实现**: <https://gitcode.com/openharmony/developtools_hdc.git>
- **本项目**: <https://github.com/wyxpku/hdc-node>

## 许可证

Apache-2.0
