/**
 * HDC Heartbeat Module
 *
 * Connection keep-alive and health monitoring.
 * Ported from: hdc-source/src/common/heartbeat.cpp
 */

import { EventEmitter } from 'events';
import { GetRuntimeMSec } from './base.js';

// ============================================================================
// Constants
// ============================================================================

export const HEARTBEAT_INTERVAL = 10000; // 10 seconds
export const HEARTBEAT_TIMEOUT = 30000; // 30 seconds
export const MAX_MISSED_HEARTBEATS = 3;

export enum HeartbeatState {
  STOPPED = 'stopped',
  RUNNING = 'running',
  TIMEOUT = 'timeout',
}

// ============================================================================
// Types
// ============================================================================

export interface HeartbeatOptions {
  interval?: number;
  timeout?: number;
  maxMissed?: number;
}

export interface HeartbeatStats {
  sent: number;
  received: number;
  missed: number;
  lastSent: number;
  lastReceived: number;
  latency: number;
}

// ============================================================================
// HdcHeartbeat - Heartbeat Manager
// ============================================================================

export class HdcHeartbeat extends EventEmitter {
  private state: HeartbeatState = HeartbeatState.STOPPED;
  private interval: number;
  private timeout: number;
  private maxMissed: number;
  
  private timer: NodeJS.Timeout | null = null;
  private sent: number = 0;
  private received: number = 0;
  private missed: number = 0;
  private lastSent: number = 0;
  private lastReceived: number = 0;
  private latency: number = 0;
  private sendCallback: (() => Promise<void>) | null = null;

  constructor(options: HeartbeatOptions = {}) {
    super();
    this.interval = options.interval ?? HEARTBEAT_INTERVAL;
    this.timeout = options.timeout ?? HEARTBEAT_TIMEOUT;
    this.maxMissed = options.maxMissed ?? MAX_MISSED_HEARTBEATS;
  }

  /**
   * Get current state
   */
  getState(): HeartbeatState {
    return this.state;
  }

  /**
   * Set send callback
   */
  setSendCallback(callback: () => Promise<void>): void {
    this.sendCallback = callback;
  }

  /**
   * Start heartbeat
   */
  start(): void {
    if (this.state === HeartbeatState.RUNNING) {
      return;
    }

    this.state = HeartbeatState.RUNNING;
    this.missed = 0;

    this.timer = setInterval(() => {
      this.sendHeartbeat();
    }, this.interval);

    this.emit('start');
  }

  /**
   * Stop heartbeat
   */
  stop(): void {
    if (this.state === HeartbeatState.STOPPED) {
      return;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.state = HeartbeatState.STOPPED;
    this.emit('stop');
  }

  /**
   * Send heartbeat
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.sendCallback) {
      return;
    }

    this.lastSent = GetRuntimeMSec();
    this.sent++;

    try {
      await this.sendCallback();
      this.emit('send', this.lastSent);
    } catch (err) {
      this.emit('error', err);
    }

    // Check for timeout
    if (this.lastReceived > 0) {
      const elapsed = this.lastSent - this.lastReceived;
      if (elapsed > this.timeout) {
        this.missed++;
        this.emit('missed', this.missed);

        if (this.missed >= this.maxMissed) {
          this.state = HeartbeatState.TIMEOUT;
          this.emit('timeout');
        }
      }
    }
  }

  /**
   * Handle received heartbeat
   */
  onReceive(timestamp?: number): void {
    this.received++;
    this.lastReceived = GetRuntimeMSec();

    if (timestamp) {
      this.latency = this.lastReceived - timestamp;
    }

    this.missed = 0; // Reset missed count

    if (this.state === HeartbeatState.TIMEOUT) {
      this.state = HeartbeatState.RUNNING;
    }

    this.emit('receive', {
      timestamp: this.lastReceived,
      latency: this.latency,
    });
  }

  /**
   * Get statistics
   */
  getStats(): HeartbeatStats {
    return {
      sent: this.sent,
      received: this.received,
      missed: this.missed,
      lastSent: this.lastSent,
      lastReceived: this.lastReceived,
      latency: this.latency,
    };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.sent = 0;
    this.received = 0;
    this.missed = 0;
    this.lastSent = 0;
    this.lastReceived = 0;
    this.latency = 0;
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(): boolean {
    return this.state === HeartbeatState.RUNNING && this.missed < this.maxMissed;
  }

  /**
   * Get latency in milliseconds
   */
  getLatency(): number {
    return this.latency;
  }
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Create heartbeat timestamp buffer
 */
export function createHeartbeatPayload(): Buffer {
  const timestamp = BigInt(GetRuntimeMSec());
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(timestamp, 0);
  return buffer;
}

/**
 * Parse heartbeat timestamp
 */
export function parseHeartbeatPayload(buffer: Buffer): number {
  if (buffer.length < 8) {
    return 0;
  }
  return Number(buffer.readBigUInt64BE(0));
}
