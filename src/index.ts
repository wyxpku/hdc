/**
 * HDC (OpenHarmony Device Connector) - Node.js Implementation
 *
 * This module provides a Node.js implementation of the HDC protocol
 * for connecting and debugging OpenHarmony devices.
 */

export const VERSION = '0.0.1';
export const HDC_PORT = 8710;
export const HDC_UDS_PATH = '/tmp/hdc';

export interface HdcDevice {
  connectKey: string;
  connType: ConnType;
}

export enum ConnType {
  USB = 0,
  TCP = 1,
  UART = 2,
}

export enum CommandFlag {
  // Kernel commands
  CMD_KERNEL_HELP = 0,
  CMD_KERNEL_TARGET_CONNECT = 1,
  CMD_KERNEL_TARGET_DISCONNECT = 2,
  CMD_KERNEL_ECHO = 3,

  // Forward commands
  CMD_FORWARD_INIT = 10,
  CMD_FORWARD_LIST = 11,
  CMD_FORWARD_REMOVE = 12,

  // Unity commands
  CMD_UNITY_RUNMODE = 20,
  CMD_UNITY_REBOOT = 21,

  // Server commands
  CMD_SERVER_KILL = 100,

  // JDWP commands
  CMD_JDWP_TRACK = 200,
}
