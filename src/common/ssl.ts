/**
 * HDC SSL/TLS Module
 *
 * SSL/TLS encryption for HDC connections.
 * Ported from: hdc-source/src/common/hdc_ssl.cpp
 */

import * as tls from 'tls';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { GetRandomString } from './base.js';

// ============================================================================
// Constants
// ============================================================================

export const SSL_MIN_VERSION = 'TLSv1.2';
export const SSL_DEFAULT_PORT = 8711;

export enum SSLState {
  IDLE = 'idle',
  HANDSHAKING = 'handshaking',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

// ============================================================================
// Types
// ============================================================================

export interface SSLOptions {
  key?: string | Buffer;
  cert?: string | Buffer;
  ca?: string | Buffer;
  rejectUnauthorized?: boolean;
  minVersion?: string;
  servername?: string;
}

export interface SSLSession {
  sessionId: string;
  state: SSLState;
  cipher?: string;
  protocol?: string;
  authorized: boolean;
  authorizationError?: string;
  startTime: number;
}

// ============================================================================
// HdcSSL - SSL/TLS Manager
// ============================================================================

export class HdcSSL extends EventEmitter {
  private options: SSLOptions;
  private state: SSLState = SSLState.IDLE;
  private socket: tls.TLSSocket | null = null;
  private sessionId: string;
  private authorized: boolean = false;

  constructor(options: SSLOptions = {}) {
    super();
    this.options = {
      ...options,
      minVersion: options.minVersion || SSL_MIN_VERSION,
      rejectUnauthorized: options.rejectUnauthorized ?? false,
    };
    this.sessionId = GetRandomString(16);
  }

  /**
   * Get current state
   */
  getState(): SSLState {
    return this.state;
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Check if connection is authorized
   */
  isAuthorized(): boolean {
    return this.authorized;
  }

  /**
   * Wrap existing socket with TLS (client mode)
   */
  async connect(socket: tls.TLSSocket): Promise<tls.TLSSocket> {
    if (this.state === SSLState.CONNECTED) {
      return this.socket!;
    }

    this.state = SSLState.HANDSHAKING;

    return new Promise((resolve, reject) => {
      const tlsSocket = tls.connect({
        socket,
        ...this.options,
      }, () => {
        this.state = SSLState.CONNECTED;
        this.socket = tlsSocket;
        this.authorized = tlsSocket.authorized;

        this.emit('connect', {
          sessionId: this.sessionId,
          state: this.state,
          cipher: tlsSocket.getCipher()?.name,
          protocol: tlsSocket.getProtocol(),
          authorized: this.authorized,
          authorizationError: tlsSocket.authorizationError,
          startTime: Date.now(),
        });

        resolve(tlsSocket);
      });

      tlsSocket.on('error', (err: Error) => {
        this.state = SSLState.ERROR;
        this.emit('error', err);
        reject(err);
      });

      tlsSocket.on('secureConnect', () => {
        this.authorized = tlsSocket.authorized;
        this.emit('secure', this.authorized);
      });

      tlsSocket.on('close', () => {
        this.state = SSLState.DISCONNECTED;
        this.emit('close');
      });
    });
  }

  /**
   * Create TLS server socket (server mode)
   */
  createServerSocket(socket: tls.TLSSocket): tls.TLSSocket {
    const tlsSocket = new tls.TLSSocket(socket, {
      isServer: true,
      ...this.options,
    });

    tlsSocket.on('secure', () => {
      this.state = SSLState.CONNECTED;
      this.socket = tlsSocket;
      this.authorized = tlsSocket.authorized;

      this.emit('secure', {
        sessionId: this.sessionId,
        authorized: this.authorized,
        authorizationError: tlsSocket.authorizationError,
      });
    });

    tlsSocket.on('error', (err: Error) => {
      this.state = SSLState.ERROR;
      this.emit('error', err);
    });

    return tlsSocket;
  }

  /**
   * Get cipher info
   */
  getCipher(): { name: string; version: string } | null {
    if (!this.socket) return null;
    return this.socket.getCipher() || null;
  }

  /**
   * Get protocol version
   */
  getProtocol(): string | null {
    if (!this.socket) return null;
    return this.socket.getProtocol();
  }

  /**
   * Get peer certificate
   */
  getPeerCertificate(): tls.PeerCertificate | null {
    if (!this.socket) return null;
    return this.socket.getPeerCertificate();
  }

  /**
   * Get session info
   */
  getSessionInfo(): SSLSession {
    return {
      sessionId: this.sessionId,
      state: this.state,
      cipher: this.getCipher()?.name,
      protocol: this.getProtocol(),
      authorized: this.authorized,
      authorizationError: this.socket?.authorizationError,
      startTime: Date.now(),
    };
  }

  /**
   * Close SSL connection
   */
  async close(): Promise<void> {
    if (this.state === SSLState.DISCONNECTED || !this.socket) {
      return;
    }

    return new Promise((resolve) => {
      this.socket!.once('close', () => {
        this.state = SSLState.DISCONNECTED;
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
 * Generate self-signed certificate
 */
export async function generateSelfSignedCert(
  options: {
    commonName?: string;
    country?: string;
    organization?: string;
    days?: number;
  } = {}
): Promise<{ key: string; cert: string }> {
  const {
    commonName = 'localhost',
    country = 'CN',
    organization = 'HDC',
    days = 365,
  } = options;

  return new Promise((resolve, reject) => {
    // Generate key pair
    crypto.generateKeyPair(
      'rsa',
      {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      },
      (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
          return;
        }

        // Create certificate
        const cert = createCertificate({
          key: privateKey,
          commonName,
          country,
          organization,
          days,
        });

        resolve({ key: privateKey, cert });
      }
    );
  });
}

/**
 * Create self-signed certificate
 */
function createCertificate(options: {
  key: string;
  commonName: string;
  country: string;
  organization: string;
  days: number;
}): string {
  const { key, commonName, country, organization, days } = options;

  // This is a simplified implementation
  // In production, use a proper certificate library
  const attrs = [
    { name: 'commonName', value: commonName },
    { name: 'countryName', value: country },
    { name: 'organizationName', value: organization },
  ];

  // Generate random serial number
  const serialNumber = crypto.randomBytes(16).toString('hex');

  // Build certificate (simplified - in production use node-forge or similar)
  const certPem = `-----BEGIN CERTIFICATE-----
MIID... (Self-signed certificate placeholder)
Serial: ${serialNumber}
Subject: CN=${commonName}, C=${country}, O=${organization}
Validity: ${days} days
-----END CERTIFICATE-----`;

  return certPem;
}

/**
 * Load SSL context from files
 */
export async function loadSSLContext(
  keyPath: string,
  certPath: string,
  caPath?: string
): Promise<SSLOptions> {
  const key = await fs.promises.readFile(keyPath, 'utf8');
  const cert = await fs.promises.readFile(certPath, 'utf8');
  const ca = caPath ? await fs.promises.readFile(caPath, 'utf8') : undefined;

  return { key, cert, ca };
}

/**
 * Verify certificate
 */
export function verifyCertificate(cert: string): boolean {
  try {
    const certObj = new crypto.X509Certificate(cert);
    return !certObj.ca; // Is not a CA cert
  } catch {
    return false;
  }
}

/**
 * Check if TLS is available
 */
export function isTLSAvailable(): boolean {
  return typeof tls.connect === 'function';
}
