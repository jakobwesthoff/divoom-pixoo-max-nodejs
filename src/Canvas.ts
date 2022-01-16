import { getCipherInfo } from "crypto";

export type RgbColor = [number, number, number];

export class Canvas {
  public static WIDTH = 32;
  public static HEIGHT = 32;

  private pixels: RgbColor[] = [];

  public constructor() {
    this.transformByRowAndColumn(() => [0, 0, 0]);
  }

  public traverseByRowAndColumn(
    fn: (x: number, y: number, color: RgbColor, index: number) => void
  ) {
    for (let y = 0; y < Canvas.HEIGHT; y++) {
      for (let x = 0; x < Canvas.WIDTH; x++) {
        const index = y * Canvas.WIDTH + x;
        fn(x, y, this.pixels[index], index);
      }
    }
  }

  public transformByRowAndColumn(
    fn: (x: number, y: number, color: RgbColor, index: number) => RgbColor
  ) {
    for (let y = 0; y < Canvas.HEIGHT; y++) {
      for (let x = 0; x < Canvas.WIDTH; x++) {
        const index = y * Canvas.WIDTH + x;
        this.pixels[index] = fn(x, y, this.pixels[index], index);
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
}
