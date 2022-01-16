import { getCipherInfo } from "crypto";

export type RgbColor = [number, number, number];

export type ImageData = {
  paletteBuffer: Buffer;
  screenBuffer: Buffer;
  imageBuffer: Buffer;
  palette: RgbColor[];
  screen: number[];
  paletteSizeLE: Buffer;
  screenBufferSizeLE: Buffer;
  imageBufferSizeLE: Buffer;
};

export class Canvas {
  public static WIDTH = 32;
  public static HEIGHT = 32;

  private pixels: RgbColor[] = [];

  public constructor() {
    this.transform(() => [0, 0, 0]);
  }

  public forEach(fn: (x: number, y: number, color: RgbColor) => void) {
    for (let y = 0; y < Canvas.HEIGHT; y++) {
      for (let x = 0; x < Canvas.WIDTH; x++) {
        fn(x, y, this.pixels[y * Canvas.WIDTH + x]);
      }
    }
  }

  public transform(fn: (x: number, y: number, color: RgbColor) => RgbColor) {
    for (let y = 0; y < Canvas.HEIGHT; y++) {
      for (let x = 0; x < Canvas.WIDTH; x++) {
        this.pixels[y * Canvas.WIDTH + x] = fn(
          x,
          y,
          this.pixels[y * Canvas.WIDTH + x]
        );
      }
    }
  }

  private assertBounds(x: number, y: number) {
    if (x < 0 || x > Canvas.WIDTH) {
      throw new Error(`x coordinate out of bounds: ${x} > ${Canvas.WIDTH}`);
    }

    if (y < 0 || y > Canvas.HEIGHT) {
      throw new Error(`y coordinate out of bounds: ${y} > ${Canvas.HEIGHT}`);
    }
  }

  public set(x: number, y: number, color: RgbColor): RgbColor {
    this.assertBounds(x, y);
    const oldValue = this.pixels[y * Canvas.WIDTH + x];
    this.pixels[y * Canvas.WIDTH + x] = color;
    return oldValue;
  }

  public get(x: number, y: number): RgbColor {
    this.assertBounds(x, y);
    return this.pixels[y * Canvas.WIDTH + x];
  }

  public toImageData(): ImageData {
    const palette: RgbColor[] = [];
    const paletteIndexMap = new Map<string, number>();

    const screen: number[] = [];

    this.forEach((x, y, color) => {
      const stringifiedColor = JSON.stringify(color);
      if (!paletteIndexMap.has(stringifiedColor)) {
        palette.push(color);
        const index = palette.length - 1;
        paletteIndexMap.set(stringifiedColor, index);
      }
      screen.push(paletteIndexMap.get(stringifiedColor)!);
    });

    // We should ideally dither the image in this case.
    if (palette.length > 256) {
      throw new Error(
        `Palette to large: More than 256 colors (${palette.length})`
      );
    }

    const paletteBuffer = Buffer.alloc(palette.length * 3);
    palette.forEach((color, index) => {
      paletteBuffer.writeUInt8(color[0], index * 3 + 0);
      paletteBuffer.writeUInt8(color[1], index * 3 + 1);
      paletteBuffer.writeUInt8(color[2], index * 3 + 2);
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
    // The encoding of the screen buffer is a Little Endian bitwise encoding for
    // each byte.
    let bufferIndex = 0;
    let current = 0;
    let usedBits = 0;

    screen.forEach((paletteIndex) => {
      const reference = paletteIndex & (Math.pow(2, referenceBitLength) - 1);
      const leftBits = 8 - usedBits;
      const overflowBits = Math.max(0, referenceBitLength - leftBits);
      current = current | ((reference << usedBits) & 0xff);
      usedBits += referenceBitLength - overflowBits;
      // console.log(
      //   "reference",
      //   reference,
      //   "leftBits",
      //   leftBits,
      //   "overflowBits",
      //   overflowBits,
      //   "current",
      //   current,
      //   "usedBits",
      //   usedBits
      // );
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
        usedBits = overflowBits;
      }
    });

    // Add the last byte
    if (usedBits != 0) {
      screenBuffer.writeUInt8(current, bufferIndex);
    }

    const paletteSizeLE = Buffer.alloc(2);
    if (palette.length === 65536) {
      paletteSizeLE.writeUInt16LE(0);
    } else {
      paletteSizeLE.writeUInt16LE(palette.length);
    }

    const screenBufferSizeLE = Buffer.alloc(2);
    screenBufferSizeLE.writeUInt16LE(screenBuffer.length);

    const imageBuffer = Buffer.concat([paletteBuffer, screenBuffer]);
    const imageBufferSizeLE = Buffer.alloc(2);
    imageBufferSizeLE.writeUInt16LE(imageBuffer.length);

    return {
      paletteBuffer,
      screenBuffer,
      imageBuffer,
      screen,
      palette,
      paletteSizeLE,
      screenBufferSizeLE,
      imageBufferSizeLE,
    };
  }
}
