import { BluetoothSerialPort } from "node-bluetooth-serial-port";
import { Grid, RgbColor } from "./src/Grid";

function calculateChecksum(payloadWithLength: Buffer): Buffer {
  let sum = 0;
  for (let i = 0; i < payloadWithLength.length; i++) {
    sum += payloadWithLength[i];
  }
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(sum & 0xffff);
  return buffer;
}

function createMessage(payload: Buffer): Buffer {
  const start = Buffer.alloc(1);
  start.writeUInt8(0x01);
  const end = Buffer.alloc(1);
  end.writeUInt8(0x02);
  const length = Buffer.alloc(2);
  length.writeUInt16LE(payload.length + 2 /*checksum*/);
  const checksum = calculateChecksum(Buffer.concat([length, payload]));

  const msg = Buffer.concat([start, length, payload, checksum, end]);
  return msg;
}

function delay(timeout: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, timeout));
}

async function sendPayload(
  bt: BluetoothSerialPort,
  payload: Buffer
): Promise<void> {
  const msg = createMessage(payload);

  await new Promise<void>((resolve, reject) =>
    bt.write(msg, (error?: Error) => (error ? reject(error) : resolve()))
  );
  console.log("<<<", msg.toString("hex"));
}

function encodeFrame(grid: Grid): Buffer {
  const { imageBuffer, paletteSizeLE } = grid.toImageData();
  const frameSize = Buffer.alloc(2);
  frameSize.writeUInt16LE(8 + imageBuffer.length);

  return Buffer.concat([
    Buffer.from([0xaa]),
    frameSize,
    Buffer.from([0x00, 0x00, 0x03]),
    paletteSizeLE,
    imageBuffer,
  ]);
}

function encodeAnimationFrame(image: Buffer): Buffer {
  const lengthBuffer = Buffer.alloc(2);
  lengthBuffer.writeUInt16LE(image.length + 3);
  return Buffer.concat([Buffer.from([0xaa]), lengthBuffer, image]);
}

function encodeAnimationChunk(
  encodedFrame: Buffer,
  index: number,
  chunk: Buffer
): Buffer {
  const lengthBuffer = Buffer.alloc(2);
  lengthBuffer.writeUInt16LE(encodedFrame.length);
  return Buffer.concat([lengthBuffer, Buffer.from([index]), chunk]);
}

function createAnimationFrame(
  timeCode: number,
  paletteSizeLE: Buffer,
  imageData: Buffer
): Buffer {
  const timeCodeLE = Buffer.alloc(2);
  timeCodeLE.writeUInt16LE(timeCode);
  return Buffer.concat([
    timeCodeLE,
    Buffer.from([0x00]),
    paletteSizeLE,
    imageData,
  ]);
}

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

    /*
     * Brightness Change
     * Command: 0x74
     * Args: 0x00 - 0x64 (1 byte) (somehow stepped)
     */
    // for (let i = 0; i <= 100; i += 10) {
    //   await sendPayload(bt, Buffer.from([0x74, i]));
    //   await delay(250);
    // }
    await sendPayload(bt, Buffer.from([0x74, 0x64]));

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

    let iteration = 0;
    while (true) {
      const grid = new Grid();
      const colors: RgbColor[] = [
        [255, 255, 255],
        // [0, 0, 0],
        // [255, 0, 0],
        // [0, 255, 0],
        // [0, 0, 255],
        // [255, 255, 0],
        [255, 0, 255],
        // [0, 255, 255],
      ];
      // let currentColor = iteration++ % colors.length;
      let currentColor = 0;
      let index = 0;

      grid.map((_x, _y, color) => {
        if (index > iteration) {
          return color;
        }

        let newColor = currentColor;
        currentColor = (currentColor + 1) % colors.length;

        index++;

        return colors[newColor];
      });

      await sendPayload(
        bt,
        Buffer.concat([
          Buffer.from([0x44, 0x00, 0x0a, 0x0a, 0x04]),
          encodeFrame(grid),
        ])
      );

      iteration++;
      await delay(16);
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
