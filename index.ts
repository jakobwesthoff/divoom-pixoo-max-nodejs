import { BluetoothSerialPort } from "node-bluetooth-serial-port";
import { off } from "process";
import { Canvas, RgbColor } from "./src/Canvas";
import { hslToRgb } from "./src/colorutils";
import { PixooMax } from "./src/PixooMax";

function delay(timeout: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, timeout));
}

async function sendRaw(bt: BluetoothSerialPort, data: Buffer): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    bt.write(data, (error?: Error) => (error ? reject(error) : resolve()))
  );
  // console.log("<<<", data.toString("hex"));
  console.log("<<<", data);
}

// function encodeAnimationFrame(image: Buffer): Buffer {
//   const lengthBuffer = Buffer.alloc(2);
//   lengthBuffer.writeUInt16LE(image.length + 3);
//   return Buffer.concat([Buffer.from([0xaa]), lengthBuffer, image]);
// }

// function encodeAnimationChunk(
//   encodedFrame: Buffer,
//   index: number,
//   chunk: Buffer
// ): Buffer {
//   const lengthBuffer = Buffer.alloc(2);
//   lengthBuffer.writeUInt16LE(encodedFrame.length);
//   return Buffer.concat([lengthBuffer, Buffer.from([index]), chunk]);
// }

// function createAnimationFrame(
//   timeCode: number,
//   paletteSizeLE: Buffer,
//   imageData: Buffer
// ): Buffer {
//   const timeCodeLE = Buffer.alloc(2);
//   timeCodeLE.writeUInt16LE(timeCode);
//   return Buffer.concat([
//     timeCodeLE,
//     Buffer.from([0x00]),
//     paletteSizeLE,
//     imageData,
//   ]);
// }

(async () => {
  try {
    const HCI_ADDRESS = "11:75:58:36:A6:0A";

    console.log("Creating BT");
    const bt = new BluetoothSerialPort();

    bt.on("error", (error) => console.error("Error: ", error));
    bt.on("data", (data: Buffer) => console.log(">>>", data.toString("hex")));

    console.log(`Searching for COM channel on ${HCI_ADDRESS}...`);
    const channel = await new Promise<number>((resolve, reject) =>
      bt.findSerialPortChannel(HCI_ADDRESS, resolve, reject)
    );
    console.log(`Found COM channel: ${channel}`);

    console.log(`Connecting to ${HCI_ADDRESS} channel ${channel}...`);
    await new Promise<void>((resolve, reject) =>
      bt.connect(HCI_ADDRESS, channel, resolve, reject)
    );
    console.log("connected");

    // DO NOT REMOVE
    //
    // We need to wait a little after connecting before talking to the display,
    // as otherwise our cammands are ignored or only read partially.
    // 100ms seems to work. No idea what the minimum here would be.
    //
    // DO NOT REMOVE
    await delay(100);

    // Playing with channel switching
    // await sendPayload(bt, Buffer.from([0x74, 0x64]));
    // await delay(1000);
    // await sendPayload(bt, Buffer.from([0x45, 0x00, 0x00, 0x01, 0x00])); // Clock?
    // await delay(5000);
    // await sendPayload(bt, Buffer.from([0x45, 0x00, 0x00, 0x01, 0x01])); // Clock?
    // await delay(5000);
    // await sendPayload(bt, Buffer.from([0x45, 0x00, 0x00, 0x01, 0x02])); // Clock?
    // await delay(5000);
    // await sendPayload(bt, Buffer.from([0x45, 0x00, 0x00, 0x01, 0x03])); // Clock?
    // await delay(5000);
    // await sendPayload(bt, Buffer.from([0x45, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00])); // Clock? / No real idea!
    // await delay(5000);
    // await sendPayload(bt, Buffer.from([0x45, 0x00, 0x00, 0x01, 0x05])); // Clock?
    // await delay(2000);
    // await sendPayload(bt, Buffer.from([0x45, 0x01, 0xff, 0xff, 0x00, 0x64, 0x00, 0x01, 0x00, 0x00, 0x00])); // Lightning (see documentation)
    // await delay(2000);
    // await sendPayload(bt, Buffer.from([0x45, 0x02])); // Cloud Channel
    // await delay(2000);
    // await sendPayload(bt, Buffer.from([0x45, 0x03])); // No real idea some random animations
    // await delay(2000);
    // await sendPayload(bt, Buffer.from([0x45, 0x04])); // Visualization (see documentation)
    // await delay(2000);
    // await sendPayload(bt, Buffer.from([0x45, 0x06]));
    // await delay(2000);
    // await sendPayload(bt, Buffer.from([0x45, 0x07]));
    // await delay(2000);

    const pixoo = new PixooMax();

    let colorCount = 1024;
    const canvas = new Canvas();

    let offset = 0;
    while (true) {
      canvas.transformByRowAndColumn((x, y, _color, index) => {
        if (
          x === 0 ||
          // x === 1 ||
          x === 31 ||
          // x === 30 ||
          y === 0 ||
          // y === 1 ||
          y === 31 // ||
          // y === 30
        ) {
          return [0, 0, 0];
        }

        const offsettedIndex = (index + offset) % colorCount;
        return hslToRgb(offsettedIndex / colorCount, 1, 0.5) as RgbColor;
      });


      // await sendRaw(bt, pixoo.setBrightness(100));
      const raw = pixoo.setStaticImage(canvas);
      console.log(raw.length);
      await sendRaw(bt, raw);
      await delay(16);
      offset += 3;
    }

    // ANIMATION TRYOUT
    // const allLength = Buffer.alloc(2);
    // allLength.writeUInt16LE(6 + imageBuffer.length);

    // const newImageBufferLength = Buffer.alloc(2);
    // allLength.writeUInt16LE(3 + imageBuffer.length);

    // let chunkSize = 200;
    // let start = 0;
    // let chunk = imageBuffer.slice(
    //   start,
    //   Math.min(imageBuffer.length, start + chunkSize)
    // );
    // let chunkIndex = 0;

    // let aframe = encodeAnimationFrame(
    //   createAnimationFrame(100, paletteSizeLE, imageBuffer)
    // );

    // const animationFrame = Buffer.concat([aframe, aframe]);

    // while (start < animationFrame.length) {
    //   await sendPayload(
    //     bt,
    //     Buffer.concat([
    //       Buffer.from([0x49]),
    //       encodeAnimationChunk(animationFrame, chunkIndex++, chunk),
    //     ])
    //   );

    //   start += chunkSize;
    //   chunk = animationFrame.slice(
    //     start,
    //     Math.min(animationFrame.length, start + chunkSize)
    //   );
    // }
  } catch (error) {
    console.error("Main error: ", error);
    process.exit(1);
  }
})();
