import { BluetoothSerialPort } from "node-bluetooth-serial-port";

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

// function PError(
//   fn: (...args: unknown[]) => unknown
// ): (...args: unknown[]) => Promise<unknown> {
//   return (...args: unknown[]) =>
//     new Promise((resolve, reject) =>
//       fn(...args, (error: unknown, ...data: unknown[]) => {
//         if (error) {
//           reject(error);
//         } else {
//           resolve(data);
//         }
//       })
//     );
// }

// function P(
//   fn: (...args: unknown[]) => unknown
// ): (...args: unknown[]) => Promise<unknown> {
//   return (...args: unknown[]) =>
//     new Promise((resolve, reject) =>
//       fn(
//         ...args,
//         (...data: unknown[]) => resolve(data),
//         (error: Error) => reject(error)
//       )
//     );
// }

async function sendPayload(
  bt: BluetoothSerialPort,
  payload: Buffer
): Promise<void> {
  const msg = createMessage(payload);

  await new Promise<void>((resolve, reject) =>
    bt.write(msg, (error?: Error) => (error ? reject(error) : resolve()))
  );
  console.log("<<< ", msg);
}

(async () => {
  try {
    const HCI_ADDRESS = "11:75:58:36:A6:0A";

    console.log("Creating BT");
    const bt = new BluetoothSerialPort();

    bt.on("error", (error) => console.error("Error: ", error));
    bt.on("data", (data: Buffer) => console.log(">>> ", data));

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

    await delay(100);

    for (let i = 0; i <= 100; i += 10) {
      await sendPayload(bt, Buffer.from([0x74, i]));
      await delay(250);
    }

  } catch (error) {
    console.error("Main error: ", error);
    process.exit(1);
  }
})();
