/**
 * HDC Forward Module
 *
 * Provides port forwarding functionality (TCP port forwarding).
 * Ported from: hdc-source/src/common/forward.cpp
 */

import { EventEmitter } from 'events';
import * as net from 'net';
import { HdcSession } from '../common/session.js';
import { GetRandomString } from '../common/base.js';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_BUFFER_SIZE = 64 * 1024;

export enum ForwardType {
  TCP = 'tcp',
  JDWP = 'jdwp',
  ABSTRACT = 'abstract',
  RESERVED = 'reserved',
}

export enum ForwardState {
  IDLE = 'idle',
  LISTENING = 'listening',
  CONNECTING = 'connecting',
  FORAWRDING = 'forwarding',
  CLOSED = 'closed',
  ERROR = 'error',
}

// ============================================================================
// Types
// ============================================================================

export interface ForwardOptions {
  localPort: number;
  remoteHost: string;
  remotePort: number;
  type?: ForwardType;
}

export interface ForwardSession {
  id: string;
  type: ForwardType;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  state: ForwardState;
  bytesForwarded: number;
  connections: number;
  startTime: number;
}

// ============================================================================
// HdcForward - Port Forwarding
// ============================================================================

export class HdcForward extends EventEmitter {
  private id: string;
  private type: ForwardType;
  private localPort: number;
  private remoteHost: string;
  private remotePort: number;
  private state: ForwardState = ForwardState.IDLE;
  private server: net.Server | null = null;
  private deviceSocket: net.Socket | null = null;
  private bytesForwarded: number = 0;
  private connections: number = 0;
  private startTime: number = 0;
  private activeSockets: Set<net.Socket> = new Set();

  constructor(options: ForwardOptions) {
    super();
    this.id = GetRandomString(8);
    this.type = options.type || ForwardType.TCP;
    this.localPort = options.localPort;
    this.remoteHost = options.remoteHost;
    this.remotePort = options.remotePort;
  }

  /**
   * Get forward session ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get current state
   */
  getState(): ForwardState {
    return this.state;
  }

  /**
   * Get local port
   */
  getLocalPort(): number {
    return this.localPort;
  }

  /**
   * Get remote address
   */
  getRemoteAddress(): string {
    return `${this.remoteHost}:${this.remotePort}`;
  }

  /**
   * Get bytes forwarded
   */
  getBytesForwarded(): number {
    return this.bytesForwarded;
  }

  /**
   * Get active connections
   */
  getConnections(): number {
    return this.connections;
  }

  /**
   * Get session info
   */
  getSession(): ForwardSession {
    return {
      id: this.id,
      type: this.type,
      localPort: this.localPort,
      remoteHost: this.remoteHost,
      remotePort: this.remotePort,
      state: this.state,
      bytesForwarded: this.bytesForwarded,
      connections: this.connections,
      startTime: this.startTime,
    };
  }

  /**
   * Start forwarding (listen on local port)
   */
  async start(): Promise<void> {
    if (this.state !== ForwardState.IDLE) {
      throw new Error('Forward already started');
    }

    this.state = ForwardState.LISTENING;
    this.startTime = Date.now();

    return new Promise((resolve, reject) => {
      this.server = net.createServer((clientSocket: net.Socket) => {
        this.handleConnection(clientSocket);
      });

      this.server.on('error', (err: Error) => {
        this.state = ForwardState.ERROR;
        this.emit('error', err);
        reject(err);
      });

      this.server.listen(this.localPort, () => {
        this.state = ForwardState.FORAWRDING;
        this.emit('listening', this.localPort);
        resolve();
      });
    });
  }

  /**
   * Handle new connection to local port
   */
  private handleConnection(clientSocket: net.Socket): void {
    this.connections++;
    this.activeSockets.add(clientSocket);

    this.emit('connection', {
      localAddress: clientSocket.localAddress,
      localPort: clientSocket.localPort,
      remoteAddress: clientSocket.remoteAddress,
      remotePort: clientSocket.remotePort,
    });

    // Connect to remote target
    const targetSocket = net.createConnection(
      { host: this.remoteHost, port: this.remotePort },
      () => {
        this.setupForwarding(clientSocket, targetSocket);
      }
    );

    targetSocket.on('error', (err: Error) => {
      this.emit('target-error', err);
      clientSocket.destroy();
    });

    clientSocket.on('error', (err: Error) => {
      this.emit('client-error', err);
      targetSocket.destroy();
    });

    clientSocket.on('close', () => {
      this.connections--;
      this.activeSockets.delete(clientSocket);
    });
  }

  /**
   * Setup bidirectional forwarding between client and target
   */
  private setupForwarding(client: net.Socket, target: net.Socket): void {
    // Client -> Target
    client.on('data', (data: Buffer) => {
      this.bytesForwarded += data.length;
      target.write(data);
    });

    // Target -> Client
    target.on('data', (data: Buffer) => {
      this.bytesForwarded += data.length;
      client.write(data);
    });

    // Handle close
    client.on('close', () => target.destroy());
    target.on('close', () => client.destroy());
  }

  /**
   * Stop forwarding
   */
  async stop(): Promise<void> {
    if (this.state === ForwardState.CLOSED) {
      return;
    }

    this.state = ForwardState.CLOSED;

    // Close all active connections
    for (const socket of this.activeSockets) {
      socket.destroy();
    }
    this.activeSockets.clear();

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    this.emit('close');
  }

  /**
   * Check if forwarding is active
   */
  isActive(): boolean {
    return this.state === ForwardState.FORAWRDING;
  }
}

// ============================================================================
// HdcForwardManager - Manage multiple forwards
// ============================================================================

export class HdcForwardManager extends EventEmitter {
  private forwards: Map<string, HdcForward> = new Map();

  /**
   * Create and start a new forward
   */
  async createForward(options: ForwardOptions): Promise<HdcForward> {
    const forward = new HdcForward(options);
    
    forward.on('listening', (port: number) => {
      this.emit('forward-start', forward, port);
    });

    forward.on('close', () => {
      this.emit('forward-stop', forward);
      this.forwards.delete(forward.getId());
    });

    forward.on('error', (err: Error) => {
      this.emit('forward-error', forward, err);
    });

    await forward.start();
    this.forwards.set(forward.getId(), forward);
    
    return forward;
  }

  /**
   * Stop and remove a forward
   */
  async removeForward(id: string): Promise<boolean> {
    const forward = this.forwards.get(id);
    if (!forward) {
      return false;
    }

    await forward.stop();
    return true;
  }

  /**
   * Get forward by ID
   */
  getForward(id: string): HdcForward | undefined {
    return this.forwards.get(id);
  }

  /**
   * List all forwards
   */
  listForwards(): HdcForward[] {
    return Array.from(this.forwards.values());
  }

  /**
   * Get forward count
   */
  get count(): number {
    return this.forwards.size;
  }

  /**
   * Stop all forwards
   */
  async stopAll(): Promise<void> {
    const promises = Array.from(this.forwards.values()).map(f => f.stop());
    await Promise.all(promises);
    this.forwards.clear();
  }
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Create a simple TCP forward
 */
export async function createTcpForward(
  localPort: number,
  remoteHost: string,
  remotePort: number
): Promise<HdcForward> {
  const forward = new HdcForward({
    localPort,
    remoteHost,
    remotePort,
    type: ForwardType.TCP,
  });

  await forward.start();
  return forward;
}
