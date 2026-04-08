# HDC Node.js 移植对比清单

## 原始项目: https://gitcode.com/openharmony/developtools_hdc.git

## 已实现模块 (18个)

| C++ 源文件 | TS 实现 | 测试数 | 状态 |
|------------|---------|--------|------|
| common/tlv.cpp | common/tlv.ts | 14 | ✅ |
| common/base.cpp | common/base.ts | 53 | ✅ |
| common/tcp.cpp | common/tcp.ts | 13 | ✅ |
| common/session.cpp | common/session.ts | 32 | ✅ |
| common/message.cpp (部分) | common/message.ts | 20 | ✅ |
| common/protocol.h | common/protocol.ts | 22 | ✅ |
| common/forward.cpp | common/forward.ts | 24 | ✅ |
| common/transfer.cpp | host/file.ts | 16 | ✅ |
| daemon/shell.cpp | host/shell.ts | 13 | ✅ |
| host/translate.cpp | host/translate.ts | 27 | ✅ |
| host/host_app.cpp | host/app.ts | 8 | ✅ |
| host/host_unity.cpp (hilog) | host/hilog.ts | 16 | ✅ |
| host/parser.cpp (部分) | host/parser.ts | 20 | ✅ |
| host/client.cpp | host/client.ts | - | ⚠️ 框架 |
| host/server.cpp | host/server.ts | - | ⚠️ 框架 |
| host/main.cpp | cli.ts | 15 | ✅ |

**总测试数:** 297 个

---

## 未实现模块 (按优先级)

### 1. 核心基础设施 (高优先级)

| C++ 源文件 | 功能 | 大小 | 优先级 |
|------------|------|------|--------|
| common/channel.cpp | 通道抽象 | 35KB | ⭐⭐⭐ |
| common/task.cpp | 任务管理 | 22KB | ⭐⭐⭐ |
| common/file.cpp | 文件操作 | 15KB | ⭐⭐ |
| common/async_cmd.cpp | 异步命令 | 12KB | ⭐⭐ |

### 2. 安全与认证 (高优先级)

| C++ 源文件 | 功能 | 大小 | 优先级 |
|------------|------|------|--------|
| common/auth.cpp | 认证机制 | 20KB | ⭐⭐⭐ |
| common/hdc_ssl.cpp | SSL/TLS | 25KB | ⭐⭐⭐ |
| common/credential_message.cpp | 凭证消息 | 8KB | ⭐⭐ |
| common/password.cpp | 密码管理 | 6KB | ⭐⭐ |
| common/hdc_huks.cpp | HUKS加密 | 10KB | ⭐ |

### 3. 连接层 (中优先级)

| C++ 源文件 | 功能 | 大小 | 优先级 |
|------------|------|------|--------|
| common/usb.cpp | USB连接 | 30KB | ⭐⭐⭐ |
| common/uart.cpp | 串口连接 | 15KB | ⭐⭐ |
| host/host_usb.cpp | 主机USB | 35KB | ⭐⭐ |
| host/host_uart.cpp | 主机串口 | 10KB | ⭐ |
| host/host_tcp.cpp | 主机TCP | 12KB | ⚠️ 部分实现 |

### 4. 守护进程 (低优先级 - 服务端)

| C++ 源文件 | 功能 | 大小 | 优先级 |
|------------|------|------|--------|
| daemon/daemon.cpp | 守护进程核心 | 51KB | ⭐ |
| daemon/daemon_tcp.cpp | TCP守护 | 15KB | ⭐ |
| daemon/daemon_usb.cpp | USB守护 | 15KB | ⭐ |
| daemon/daemon_uart.cpp | UART守护 | 8KB | ⭐ |
| daemon/daemon_app.cpp | 应用管理守护 | 12KB | ⭐ |
| daemon/daemon_forward.cpp | 转发守护 | 15KB | ⭐ |
| daemon/daemon_unity.cpp | Unity守护 | 10KB | ⭐ |
| daemon/daemon_ssl.cpp | SSL守护 | 12KB | ⭐ |
| daemon/jdwp.cpp | JDWP支持 | 20KB | ⭐ |

### 5. 其他模块 (低优先级)

| C++ 源文件 | 功能 | 大小 | 优先级 |
|------------|------|------|--------|
| common/heartbeat.cpp | 心跳 | 8KB | ⚠️ 部分实现 |
| common/compress.cpp | 压缩 | 5KB | ⭐ |
| common/decompress.cpp | 解压 | 5KB | ⭐ |
| common/circle_buffer.cpp | 环形缓冲 | 4KB | ⭐ |
| common/serial_struct.cpp | 序列化 | 10KB | ⭐ |
| host/host_updater.cpp | 更新器 | 15KB | ⭐ |
| host/ext_client.cpp | 扩展客户端 | 10KB | ⭐ |

---

## 实现建议

### 第一阶段：补齐核心基础设施
1. **channel.ts** - 通道抽象层
2. **task.ts** - 任务管理器
3. **auth.ts** - 认证机制
4. **ssl.ts** - SSL/TLS加密

### 第二阶段：完善连接层
5. **usb.ts** - USB连接
6. **uart.ts** - 串口连接

### 第三阶段：增强功能
7. **compress.ts** - 数据压缩
8. **heartbeat.ts** - 心跳机制完善
9. **jdwp.ts** - JDWP调试支持

---

## 已覆盖的核心功能 ✅

- ✅ 协议层完整实现
- ✅ TCP连接（客户端/服务端）
- ✅ 会话管理
- ✅ Shell执行
- ✅ 文件传输
- ✅ 端口转发
- ✅ 应用安装/卸载
- ✅ Hilog日志
- ✅ CLI工具

## 主要缺失功能 ❌

- ❌ USB连接
- ❌ 认证加密
- ❌ 串口连接
- ❌ JDWP调试
- ❌ 数据压缩
- ❌ 守护进程完整实现
