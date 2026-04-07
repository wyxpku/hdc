/**
 * TLV (Tag-Length-Value) buffer implementation
 *
 * TLV format:
 * - Tag: 4 bytes (uint32)
 * - Length: 4 bytes (uint32)
 * - Value: N bytes
 */

const TLV_HEAD_SIZE = 8;
const TLV_VALUE_MAX_LEN = 10 * 1024 * 1024; // 10MB

export class TlvBuf {
  private buffer: Buffer;
  private size: number;
  private validTags?: Set<number>;

  constructor(data?: Buffer, size?: number, validTags?: Set<number>) {
    this.buffer = Buffer.alloc(0);
    this.size = 0;
    this.validTags = validTags;

    if (data && size) {
      this.parseBuffer(data, size);
    }
  }

  getBufSize(): number {
    return this.size;
  }

  clear(): void {
    this.buffer = Buffer.alloc(0);
    this.size = 0;
  }

  append(tag: number, data: Buffer): boolean;
  append(tag: number, length: number, value: Buffer | null): boolean;
  append(tag: number, lengthOrData: number | Buffer, value?: Buffer | null): boolean {
    let length: number;
    let data: Buffer;

    if (typeof lengthOrData === 'number') {
      length = lengthOrData;
      data = value ?? Buffer.alloc(0);
    } else {
      data = lengthOrData;
      length = data.length;
    }

    if (length === 0 || length > TLV_VALUE_MAX_LEN || data.length === 0) {
      return false;
    }

    // Check for duplicate tag
    if (this.findTag(tag)) {
      return false;
    }

    const headBuf = Buffer.alloc(TLV_HEAD_SIZE);
    headBuf.writeUInt32LE(tag, 0);
    headBuf.writeUInt32LE(length, 4);

    this.buffer = Buffer.concat([this.buffer, headBuf, data]);
    this.size += TLV_HEAD_SIZE + length;
    return true;
  }

  appendString(tag: number, value: string): boolean {
    return this.append(tag, Buffer.from(value, 'utf-8'));
  }

  findTag(tag: number): { length: number; value: Buffer } | null {
    let offset = 0;
    while (offset + TLV_HEAD_SIZE <= this.size) {
      const currentTag = this.buffer.readUInt32LE(offset);
      const length = this.buffer.readUInt32LE(offset + 4);

      if (currentTag === tag) {
        const value = this.buffer.subarray(offset + TLV_HEAD_SIZE, offset + TLV_HEAD_SIZE + length);
        return { length, value };
      }

      offset += TLV_HEAD_SIZE + length;
    }
    return null;
  }

  findString(tag: number): string | null {
    const result = this.findTag(tag);
    return result ? result.value.toString('utf-8') : null;
  }

  copyToBuf(buf: Buffer, bufSize: number): boolean {
    if (!buf || buf.length === 0 || bufSize < this.size) {
      return false;
    }
    this.buffer.copy(buf, 0, 0, this.size);
    return true;
  }

  containInvalidTag(): boolean {
    if (!this.validTags) {
      return false;
    }

    let offset = 0;
    while (offset + TLV_HEAD_SIZE <= this.size) {
      const tag = this.buffer.readUInt32LE(offset);
      if (!this.validTags.has(tag)) {
        return true;
      }
      const length = this.buffer.readUInt32LE(offset + 4);
      offset += TLV_HEAD_SIZE + length;
    }
    return false;
  }

  private parseBuffer(data: Buffer, size: number): boolean {
    // Validate TLV structure
    let offset = 0;
    while (offset + TLV_HEAD_SIZE <= size) {
      const length = data.readUInt32LE(offset + 4);
      if (length > TLV_VALUE_MAX_LEN) {
        return false;
      }
      offset += TLV_HEAD_SIZE + length;
    }

    if (offset !== size) {
      return false;
    }

    this.buffer = Buffer.from(data.subarray(0, size));
    this.size = size;
    return true;
  }
}

export { TLV_HEAD_SIZE, TLV_VALUE_MAX_LEN };
