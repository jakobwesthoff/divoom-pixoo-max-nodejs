import { Canvas } from "./Canvas";

export const UInt16LE = (...values: number[]): Buffer => {
  const buffer = Buffer.alloc(values.length * 2);
  for (let i = 0; i < values.length; i++) {
    buffer.writeUInt16LE(values[i], i * 2);
  }
  return buffer;
};

export const UInt8 = (...values: number[]): Buffer => {
  const buffer = Buffer.alloc(values.length);
  for (let i = 0; i < values.length; i++) {
    buffer.writeUInt8(values[i], i);
  }
  return buffer;
};

export const rollingSum16LE = (payload: Buffer): Buffer => {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    sum += payload[i];
  }

  return UInt16LE(sum & 0xffff);
};

export class PixooMax {
  public constructor() {}

  public setBrightness(brightness: number) {
    if (brightness < 0 || brightness > 100) {
      throw Error(
        `Brightness must be in percent between 0 and 100 (inclusive). The given value was ${brightness}`
      );
    }

    const command = UInt8(0x74);
    const value = UInt8(brightness);

    return this.createMessage(command, value);
  }

  public setStaticImage(canvas: Canvas): Buffer {
    const command = UInt8(0x44);
    const prefix = UInt8(0x00, 0x0a, 0x0a, 0x04); // Unknown what this does for now.
    const header = UInt8(0xaa);
    const frameTime = UInt16LE(0); // Always 0 vor static image
    const paletteType = UInt8(0x03); // 3 = Set PixooMax Palette (max. 1024 colors)

    const { paletteBuffer, screenBuffer, palette } = canvas.toImageData();
    const paletteCount = UInt16LE(palette.length);

    const frameSize = UInt16LE(
      /* frameSize itself */ 2 +
        frameTime.length +
        paletteType.length +
        paletteCount.length +
        paletteBuffer.length +
        screenBuffer.length
    );

    return this.createMessage(
      command,
      prefix,
      header,
      frameSize,
      frameTime,
      paletteType,
      paletteCount,
      paletteBuffer,
      screenBuffer
    );
  }

  private createMessage(...parts: Buffer[]): Buffer {
    const start = UInt8(0x01);
    const end = UInt8(0x02);
    const payload = Buffer.concat(parts);
    const length = UInt16LE(payload.length + 2 /* checksum length */);
    const checksum = rollingSum16LE(Buffer.concat([length, payload]));
    return Buffer.concat([start, length, payload, checksum, end]);
  }
}
