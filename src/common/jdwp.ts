/**
 * HDC JDWP Module
 *
 * Java Debug Wire Protocol support for debugging Java applications.
 * Ported from: hdc-source/src/common/hdc_jdwp.cpp
 */

import { EventEmitter } from 'events';
import * as net from 'net';
import { GetRandomU32 } from './base.js';

// ============================================================================
// Constants
// ============================================================================

export const JDWP_HANDSHAKE = 'JDWP-Handshake';
export const JDWP_VERSION = '1.8';
export const JDWP_HEADER_SIZE = 11;

export enum JDWPState {
  IDLE = 'idle',
  HANDSHAKING = 'handshaking',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

export enum JDWPCommandSet {
  VIRTUAL_MACHINE = 1,
  REFERENCE_TYPE = 2,
  CLASS_TYPE = 3,
  ARRAY_TYPE = 4,
  INTERFACE_TYPE = 5,
  METHOD = 6,
  FIELD = 8,
  OBJECT_REFERENCE = 9,
  STRING_REFERENCE = 10,
  THREAD_REFERENCE = 11,
  THREAD_GROUP_REFERENCE = 12,
  ARRAY_REFERENCE = 13,
  CLASS_LOADER_REFERENCE = 14,
  EVENT_REQUEST = 15,
  STACK_FRAME = 16,
  CLASS_OBJECT_REFERENCE = 17,
  EVENT = 64,
}

// ============================================================================
// Types
// ============================================================================

export interface JDWPOptions {
  port?: number;
  timeout?: number;
}

export interface JDWPCommand {
  id: number;
  length: number;
  commandSet: number;
  command: number;
  data: Buffer;
}

export interface JDWPReply {
  id: number;
  length: number;
  errorCode: number;
  data: Buffer;
}

export interface JDWPEvent {
  kind: number;
  suspendPolicy: number;
  requestId: number;
  threadId: number;
}

// ============================================================================
// HdcJDWP - JDWP Debugging Support
// ============================================================================

export class HdcJDWP extends EventEmitter {
  private state: JDWPState = JDWPState.IDLE;
  private socket: net.Socket | null = null;
  private commandId: number = 0;
  private pendingCommands: Map<number, { resolve: Function; reject: Function }> = new Map();
  private buffer: Buffer = Buffer.alloc(0);
  private options: Required<JDWPOptions>;

  constructor(options: JDWPOptions = {}) {
    super();
    this.options = {
      port: options.port || 5005,
      timeout: options.timeout || 10000,
    };
  }

  /**
   * Get current state
   */
  getState(): JDWPState {
    return this.state;
  }

  /**
   * Connect to JDWP server
   */
  async connect(host: string = '127.0.0.1'): Promise<void> {
    if (this.state !== JDWPState.IDLE) {
      throw new Error('JDWP already connected');
    }

    this.state = JDWPState.HANDSHAKING;

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({
        host,
        port: this.options.port,
      });

      const timeout = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error('Connection timeout'));
      }, this.options.timeout);

      this.socket.on('connect', async () => {
        clearTimeout(timeout);
        this.emit('connect');

        try {
          await this.performHandshake();
          this.state = JDWPState.CONNECTED;
          this.emit('ready');
          resolve();
        } catch (err) {
          this.state = JDWPState.ERROR;
          this.emit('error', err);
          reject(err);
        }
      });

      this.socket.on('error', (err: Error) => {
        clearTimeout(timeout);
        this.state = JDWPState.ERROR;
        this.emit('error', err);
        reject(err);
      });

      this.socket.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      this.socket.on('close', () => {
        this.state = JDWPState.DISCONNECTED;
        this.emit('close');
      });
    });
  }

  /**
   * Perform JDWP handshake
   */
  private async performHandshake(): Promise<void> {
    // Send handshake
    const handshake = Buffer.from(JDWP_HANDSHAKE);
    this.socket!.write(handshake);

    // Wait for response
    return new Promise((resolve, reject) => {
      const handler = (data: Buffer) => {
        if (data.toString() === JDWP_HANDSHAKE) {
          this.socket!.off('data', handler);
          resolve();
        } else {
          this.socket!.off('data', handler);
          reject(new Error('Invalid handshake response'));
        }
      };

      this.socket!.on('data', handler);
    });
  }

  /**
   * Handle incoming data
   */
  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
    this.processBuffer();
  }

  /**
   * Process buffered data
   */
  private processBuffer(): void {
    while (this.buffer.length >= JDWP_HEADER_SIZE) {
      const length = this.buffer.readInt32BE(0);
      const id = this.buffer.readInt32BE(4);
      const flags = this.buffer.readUInt8(8);

      if (this.buffer.length < length) {
        break; // Wait for more data
      }

      const packet = this.buffer.subarray(0, length);
      this.buffer = this.buffer.subarray(length);

      if (flags === 0x80) {
        // Reply packet
        const errorCode = packet.readInt16BE(9);
        const replyData = packet.subarray(11);
        this.handleReply(id, errorCode, replyData);
      } else {
        // Command packet
        const commandSet = packet.readUInt8(9);
        const command = packet.readUInt8(10);
        const commandData = packet.subarray(11);
        this.handleCommand(id, commandSet, command, commandData);
      }
    }
  }

  /**
   * Handle reply packet
   */
  private handleReply(id: number, errorCode: number, data: Buffer): void {
    const pending = this.pendingCommands.get(id);
    if (pending) {
      this.pendingCommands.delete(id);

      if (errorCode === 0) {
        pending.resolve(data);
      } else {
        pending.reject(new Error(`JDWP error: ${errorCode}`));
      }
    } else {
      this.emit('reply', { id, errorCode, data });
    }
  }

  /**
   * Handle command packet
   */
  private handleCommand(id: number, commandSet: number, command: number, data: Buffer): void {
    this.emit('command', {
      id,
      commandSet,
      command,
      data,
    });
  }

  /**
   * Send command and wait for reply
   */
  async sendCommand(commandSet: number, command: number, data: Buffer = Buffer.alloc(0)): Promise<Buffer> {
    if (this.state !== JDWPState.CONNECTED) {
      throw new Error('JDWP not connected');
    }

    const id = ++this.commandId;
    const length = JDWP_HEADER_SIZE + data.length;

    const packet = Buffer.alloc(length);
    packet.writeInt32BE(length, 0);
    packet.writeInt32BE(id, 4);
    packet.writeUInt8(0, 8); // Flags
    packet.writeUInt8(commandSet, 9);
    packet.writeUInt8(command, 10);
    data.copy(packet, 11);

    return new Promise((resolve, reject) => {
      this.pendingCommands.set(id, { resolve, reject });
      this.socket!.write(packet);

      // Timeout
      setTimeout(() => {
        if (this.pendingCommands.has(id)) {
          this.pendingCommands.delete(id);
          reject(new Error('Command timeout'));
        }
      }, this.options.timeout);
    });
  }

  /**
   * Send reply
   */
  sendReply(id: number, errorCode: number, data: Buffer = Buffer.alloc(0)): void {
    if (this.state !== JDWPState.CONNECTED) {
      throw new Error('JDWP not connected');
    }

    const length = JDWP_HEADER_SIZE + data.length;

    const packet = Buffer.alloc(length);
    packet.writeInt32BE(length, 0);
    packet.writeInt32BE(id, 4);
    packet.writeUInt8(0x80, 8); // Reply flag
    packet.writeInt16BE(errorCode, 9);
    data.copy(packet, 11);

    this.socket!.write(packet);
  }

  /**
   * Get VM version
   */
  async getVersion(): Promise<{ description: string; jdwpMajor: number; jdwpMinor: number; vmVersion: string; vmName: string }> {
    const data = await this.sendCommand(JDWPCommandSet.VIRTUAL_MACHINE, 1);

    let offset = 0;
    const descriptionLen = data.readInt32BE(offset);
    offset += 4;
    const description = data.subarray(offset, offset + descriptionLen).toString('utf8');
    offset += descriptionLen;

    const jdwpMajor = data.readInt32BE(offset);
    offset += 4;
    const jdwpMinor = data.readInt32BE(offset);
    offset += 4;

    const vmVersionLen = data.readInt32BE(offset);
    offset += 4;
    const vmVersion = data.subarray(offset, offset + vmVersionLen).toString('utf8');
    offset += vmVersionLen;

    const vmNameLen = data.readInt32BE(offset);
    offset += 4;
    const vmName = data.subarray(offset, offset + vmNameLen).toString('utf8');

    return { description, jdwpMajor, jdwpMinor, vmVersion, vmName };
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    if (this.state === JDWPState.DISCONNECTED || !this.socket) {
      return;
    }

    return new Promise((resolve) => {
      this.socket!.once('close', () => {
        this.state = JDWPState.DISCONNECTED;
        this.socket = null;
        resolve();
      });

      this.socket!.end();
    });
  }
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Check if JDWP is available
 */
export function isJDWPAvailable(): boolean {
  return typeof net.createConnection === 'function';
}
