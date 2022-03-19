import { Canvas, RgbColor } from "./Canvas";

export type PixelData = {
  colorCount: number;
  colorBuffer: Buffer;
  screenBuffer: Buffer;
};

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

    return this.createMessage(command, prefix, this.encodeFrame(canvas, 0));
  }

  public setAnimation(canvass: Canvas[], timePerFrame: number): Buffer[] {
    const frameBuffers = canvass.map((canvas, index) =>
      this.encodeFrame(canvas, index * timePerFrame)
    );

    const chunkLength = 200;
    const allFrames = Buffer.concat(frameBuffers);
    const chunkCount = Math.ceil(allFrames.length / chunkLength);
    const chunks: Buffer[] = [];
    for (let i = 0; i < chunkCount; i++) {
      chunks.push(
        Buffer.concat([
          UInt16LE(allFrames.length),
          UInt8(i),
          allFrames.subarray(i * chunkLength, (i + 1) * chunkLength),
        ])
      );
    }

    const command = UInt8(0x49);
    return chunks.map((chunk) => this.createMessage(command, chunk));
  }

  private encodeFrame(canvas: Canvas, timecode: number = 0): Buffer {
    const { screenBuffer, colorBuffer, colorCount } =
      this.encodeCanvasToPixelData(canvas);
    const header = UInt8(0xaa);
    const frameTime = UInt16LE(timecode); // Always 0 vor static image
    const paletteType = UInt8(0x03); // 3 = Set PixooMax Palette (max. 1024 colors)
    const paletteCount = UInt16LE(colorCount);

    const frameSize = UInt16LE(
      0 +
        header.length +
        /* frameSize itself */ 2 +
        frameTime.length +
        paletteType.length +
        paletteCount.length +
        colorBuffer.length +
        screenBuffer.length
    );

    return Buffer.concat([
      header,
      frameSize,
      frameTime,
      paletteType,
      paletteCount,
      colorBuffer,
      screenBuffer,
    ]);
  }

  private createMessage(...parts: Buffer[]): Buffer {
    const start = UInt8(0x01);
    const end = UInt8(0x02);
    const payload = Buffer.concat(parts);
    const length = UInt16LE(payload.length + 2 /* checksum length */);
    const checksum = rollingSum16LE(Buffer.concat([length, payload]));
    return Buffer.concat([start, length, payload, checksum, end]);
  }

  public encodeCanvasToPixelData(canvas: Canvas): PixelData {
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

    // Calculate how many bits are needed to fit all the palette values in
    // log(1) === 0. Therefore we clamp to [1,..]
    const referenceBitLength = Math.max(
      1,
      Math.ceil(Math.log2(palette.length))
    );

    let screenBuffer = Buffer.alloc(
      Math.ceil((referenceBitLength * screen.length) / 8)
    );
    // Screen buffer is using minmal amount of bits to encode all palette codes.
    // Ordering of segments is Little endion
    let bufferIndex = 0;
    let current = 0;
    let currentIndex = 0;

    screen.forEach((paletteIndex) => {
      // Add the new color reference to the accumulator
      const reference = paletteIndex & (Math.pow(2, referenceBitLength) - 1);
      current = current | (reference << currentIndex);
      currentIndex += referenceBitLength;

      // Write out all filled up bytes
      while (currentIndex >= 8) {
        const lastByte = current & 0xff;
        current = current >> 8;
        currentIndex -= 8;
        screenBuffer.writeUInt8(lastByte, bufferIndex);
        bufferIndex++;
      }
    });

    // Add the last byte
    if (currentIndex !== 0) {
      screenBuffer.writeUInt8(current, bufferIndex);
    }

    return {
      colorBuffer,
      screenBuffer,
      colorCount: palette.length,
    };
  }
}
