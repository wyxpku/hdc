/**
 * Command Translation Module
 *
 * Translates CLI commands into internal command format.
 * Translated from: src/host/translate.cpp
 */

import { CommandFlag } from '../index.js';

export interface FormatCommand {
  cmdFlag: CommandFlag;
  parameters: string;
  bJumpDo: boolean; // If true, command should not be sent to device
}

const MAX_CONNECT_KEY_SIZE = 50;

/**
 * Get help text for HDC commands
 */
export function usage(): string {
  return `OpenHarmony Device Connector (HDC) Tool
Version: Node.js Implementation

Usage: hdc [options] <command> [arguments]

Options:
  -h, --help      Show this help message
  -v, --version   Show version info
  -l[0-5]         Set log level (0=off, 5=verbose)
  -t <key>        Specify target device by key
  -s [ip:]port    Connect to server at address

Commands:
  list targets    List connected devices
  tconn key [-remove]  Connect/disconnect TCP device
  tmode usb       Switch device to USB mode
  tmode port <port>    Switch device to TCP mode
  shell [command]       Run shell command on device
  file send <local> <remote>  Send file to device
  file recv <remote> <local>  Receive file from device
  install <package>     Install application
  uninstall <package>   Uninstall application
  fport <local> <remote>  Forward port
  rport <remote> <local>  Reverse forward port
  fport ls        List port forwards
  fport rm <task> Remove port forward
  hilog           View device logs
  jpid            List JDWP debuggable processes
  target boot     Reboot device
  start           Start HDC server
  kill            Stop HDC server
  checkserver     Check server version
`;
}

export function verbose(): string {
  return usage() + `
flash commands:
  flash <partition> <image>  Flash partition with image

For more information, visit:
https://gitee.com/openharmony/developtools_hdc
`;
}

/**
 * Parse target connect command (tconn)
 */
export function targetConnect(cmd: FormatCommand): string {
  const parts = cmd.parameters.trim().split(/\s+/);

  if (parts[0].length > MAX_CONNECT_KEY_SIZE) {
    cmd.bJumpDo = true;
    return 'Error connect key\'s size';
  }

  // Check for -remove flag
  if (parts.length > 1 && parts[parts.length - 1] === '-remove') {
    cmd.cmdFlag = CommandFlag.CMD_KERNEL_TARGET_DISCONNECT;
    cmd.parameters = parts.slice(0, -1).join(' ');
    return '';
  }

  // Validate IP:port format
  const key = parts[0];
  if (key.includes(':')) {
    const [host, portStr] = key.split(':');
    const port = parseInt(portStr, 10);

    // Handle localhost
    if (host === 'localhost') {
      cmd.parameters = `127.0.0.1:${port}`;
      return '';
    }

    // Validate port range
    if (isNaN(port) || port < 1 || port > 65535) {
      cmd.bJumpDo = true;
      return 'IP:Port incorrect';
    }

    // Validate IP address
    if (!isValidIP(host)) {
      cmd.bJumpDo = true;
      return '[E001104]:IP address incorrect';
    }
  }

  cmd.cmdFlag = CommandFlag.CMD_KERNEL_TARGET_CONNECT;
  return '';
}

function isValidIP(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) {
      return false;
    }
  }
  return true;
}

/**
 * Parse forward port command (fport)
 */
export function forwardPort(input: string, cmd: FormatCommand): string {
  const trimmed = input.trim();

  if (!trimmed) {
    cmd.bJumpDo = true;
    return 'Incorrect forward command';
  }

  // Remove "fport" prefix if present
  const withoutPrefix = trimmed.replace(/^fport\s+/i, '').trim();
  const parts = withoutPrefix.split(/\s+/);
  const subCmd = parts[0].toLowerCase();

  switch (subCmd) {
    case 'ls':
    case 'list':
      cmd.cmdFlag = CommandFlag.CMD_FORWARD_LIST;
      cmd.bJumpDo = false;
      return '';

    case 'rm':
    case 'remove':
      if (parts.length < 3) {
        cmd.bJumpDo = true;
        return 'Incorrect forward command';
      }
      cmd.cmdFlag = CommandFlag.CMD_FORWARD_REMOVE;
      cmd.parameters = parts.slice(1).join(' ');
      cmd.bJumpDo = false;
      return '';

    case 'tcp':
      // fport tcp:localPort tcp:remotePort
      if (parts.length < 3) {
        cmd.bJumpDo = true;
        return 'Incorrect forward command';
      }
      cmd.cmdFlag = CommandFlag.CMD_FORWARD_INIT;
      cmd.parameters = `fport ${withoutPrefix}`;
      cmd.bJumpDo = false;
      return '';

    default:
      // Check if it's a task specification (tcp:1234 tcp:5678)
      if (parts.length >= 2 && parts[0].includes(':') && parts[1].includes(':')) {
        cmd.cmdFlag = CommandFlag.CMD_FORWARD_INIT;
        cmd.parameters = `fport ${withoutPrefix}`;
        cmd.bJumpDo = false;
        return '';
      }
      cmd.bJumpDo = true;
      return 'Incorrect forward command';
  }
}

/**
 * Parse run mode command (tmode)
 */
export function runMode(input: string, cmd: FormatCommand): string {
  const trimmed = input.trim();

  if (!trimmed) {
    cmd.bJumpDo = true;
    return 'Error tmode command';
  }

  // Remove "tmode" prefix if present
  const withoutPrefix = trimmed.replace(/^tmode\s+/i, '').trim();
  if (!withoutPrefix) {
    cmd.bJumpDo = true;
    return 'Error tmode command';
  }

  const parts = withoutPrefix.split(/\s+/);
  const mode = parts[0].toLowerCase();

  if (mode !== 'port' && mode !== 'usb') {
    cmd.bJumpDo = true;
    return 'Error tmode command';
  }

  if (mode === 'usb') {
    cmd.cmdFlag = CommandFlag.CMD_UNITY_RUNMODE;
    cmd.parameters = 'usb';
    cmd.bJumpDo = false;
    return '';
  }

  // port mode
  if (parts.length < 2) {
    cmd.bJumpDo = true;
    return 'Incorrect port range';
  }

  const portStr = parts[1];
  if (portStr.toLowerCase() === 'close') {
    cmd.cmdFlag = CommandFlag.CMD_UNITY_RUNMODE;
    cmd.parameters = 'port close';
    cmd.bJumpDo = false;
    return '';
  }

  const port = parseInt(portStr, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    cmd.bJumpDo = true;
    return 'Incorrect port range';
  }

  cmd.cmdFlag = CommandFlag.CMD_UNITY_RUNMODE;
  cmd.parameters = `port ${port}`;
  cmd.bJumpDo = false;
  return '';
}

/**
 * Parse target reboot command
 */
export function targetReboot(input: string, cmd: FormatCommand): void {
  const trimmed = input.trim();
  cmd.cmdFlag = CommandFlag.CMD_UNITY_REBOOT;

  if (trimmed.includes('-bootloader')) {
    cmd.parameters = 'bootloader';
  } else {
    cmd.parameters = '';
  }
}

/**
 * Main command parser
 */
export function string2FormatCommand(
  input: string,
  cmd: FormatCommand
): string {
  const trimmed = input.trim();
  const parts = trimmed.split(/\s+/);
  const mainCmd = parts[0].toLowerCase();

  // Reset command state
  cmd.cmdFlag = CommandFlag.CMD_KERNEL_HELP;
  cmd.parameters = parts.slice(1).join(' ');
  cmd.bJumpDo = false;

  switch (mainCmd) {
    case 'help':
    case '-h':
    case '--help':
      cmd.cmdFlag = CommandFlag.CMD_KERNEL_HELP;
      cmd.bJumpDo = true;
      return usage() + '\n';

    case 'version':
    case '-v':
    case '--version':
      cmd.bJumpDo = true;
      return 'hdc-node v0.0.1\n';

    case 'kill':
      cmd.cmdFlag = CommandFlag.CMD_SERVER_KILL;
      return '';

    case 'start':
      cmd.bJumpDo = true;
      return 'Server started\n';

    case 'checkserver':
      cmd.bJumpDo = true;
      return 'Server version: 0.0.1\n';

    case 'list':
      if (parts[1]?.toLowerCase() === 'targets') {
        cmd.bJumpDo = false;
        cmd.parameters = 'list targets';
        return '';
      }
      break;

    case 'tconn':
      return targetConnect(cmd);

    case 'tmode':
      return runMode(cmd.parameters, cmd);

    case 'target':
      if (parts[1]?.toLowerCase() === 'boot') {
        targetReboot(parts.slice(2).join(' '), cmd);
        return '';
      }
      break;

    case 'fport':
    case 'rport':
      return forwardPort(cmd.parameters, cmd);

    case 'track-jpid':
    case 'jpid':
      if (parts[1] === '-p') {
        cmd.cmdFlag = CommandFlag.CMD_JDWP_TRACK;
        cmd.parameters = 'p';
      } else {
        cmd.cmdFlag = CommandFlag.CMD_JDWP_TRACK;
        cmd.parameters = '';
      }
      return '';

    default:
      break;
  }

  cmd.bJumpDo = true;
  return 'Unknown command...\n';
}

/**
 * Create a default FormatCommand
 */
export function createFormatCommand(): FormatCommand {
  return {
    cmdFlag: CommandFlag.CMD_KERNEL_HELP,
    parameters: '',
    bJumpDo: false,
  };
}
