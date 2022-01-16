import { Canvas, RgbColor } from "./Canvas";

export type EncodedFrame = {
  colorCount: number,
  colorBuffer: Buffer,
  screenBuffer: Buffer,
}

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

    const { colorBuffer, screenBuffer, colorCount } = this.encodeCanvasToFrame(canvas);
    const paletteCount = UInt16LE(colorCount);

    const frameSize = UInt16LE(
      /* frameSize itself */ 2 +
        frameTime.length +
        paletteType.length +
        paletteCount.length +
        colorBuffer.length +
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
      colorBuffer,
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

  public encodeCanvasToFrame(canvas: Canvas): EncodedFrame {
    const palette: RgbColor[] = [];
    const paletteIndexMap = new Map<string, number>();
    const screen: number[] = [];

    canvas.traverseByRowAndColumn((_x, _y, color) => {
      const stringifiedColor = JSON.stringify(color);
      if (!paletteIndexMap.has(stringifiedColor)) {
        palette.push(color);
        const index = palette.length - 1;
        paletteIndexMap.set(stringifiedColor, index);
      }
      screen.push(paletteIndexMap.get(stringifiedColor)!);
    });

    if (palette.length > 1024) {
      throw new Error(
        `Palette to large: More than 1024 colors (${palette.length})`
      );
    }

    const colorBuffer = Buffer.alloc(palette.length * 3);
    palette.forEach((color, index) => {
      colorBuffer.writeUInt8(color[0], index * 3 + 0);
      colorBuffer.writeUInt8(color[1], index * 3 + 1);
      colorBuffer.writeUInt8(color[2], index * 3 + 2);
    });

    const referenceBitLength = Math.ceil(Math.log2(palette.length));
    if (referenceBitLength === 0) {
      throw new Error(
        `The palette reference bit size is 0. This should not happen if at least one color is defined.`
      );
    }

    let screenBuffer = Buffer.alloc(
      Math.ceil((referenceBitLength * screen.length) / 8)
    );
    // Screen buffer is using minmal amount of bits to encode all palette codes.
    // Ordering of segments is Little endion
    let bufferIndex = 0;
    let current = 0;
    let usedBits = 0;

    screen.forEach((paletteIndex) => {
      const reference = paletteIndex & (Math.pow(2, referenceBitLength) - 1);
      const leftBits = 8 - usedBits;
      let overflowBits = Math.max(0, referenceBitLength - leftBits);
      current = current | ((reference << usedBits) & 0xff);
      usedBits += referenceBitLength - overflowBits;
      while (usedBits === 8 || overflowBits > 0) {
        if (usedBits === 8) {
          // Add the byte and reset state
          screenBuffer.writeUInt8(current, bufferIndex);
          bufferIndex++;
          current = 0;
          usedBits = 0;
        }

        if (overflowBits > 0) {
          // We had an overflow and need to preserve the overflow
          current =
            current |
            ((reference >> (-1 * (overflowBits - referenceBitLength))) & 0xff);
          overflowBits = Math.max(0, overflowBits - 8);
          usedBits = Math.min(8, overflowBits);
        }
      }
    });

    // Add the last byte
    if (usedBits != 0) {
      screenBuffer.writeUInt8(current, bufferIndex);
    }

    return {
      colorBuffer,
      screenBuffer,
      colorCount: palette.length,
    }
  }
}
