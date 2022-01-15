import SerialPort = require("serialport");

const calculateChecksum = (payload: Buffer) => {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    sum += payload[i];
  }
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(sum & 0xffff);
  return buffer;
};

(async () => {
  try {
    const DEVICE_FILE = "/dev/cu.Pixoo-Max";
    const BAUDRATE = 115200;
    const STOPBITS = 1;
    const DATABITS = 8;
    const PARITY = "none";

    const port = new SerialPort(DEVICE_FILE, {
      baudRate: BAUDRATE,
      stopBits: STOPBITS,
      dataBits: DATABITS,
      parity: PARITY,
      autoOpen: false,
    });

    port.on("readable", async () => {
      console.log(">>> ", port.read());
      await new Promise<void>((resolve, reject) =>
        port.close((error) => (error ? reject(error) : resolve()))
      );
      process.exit(0);
    });
    port.on("error", (error) => console.error(error));

    await new Promise<void>((resolve, reject) =>
      port.open((error) => (error ? reject(error) : resolve()))
    );
    // await new Promise((resolve) => setTimeout(resolve, 1000));

    // console.log(
    //   await new Promise((resolve, reject) =>
    //     port.get((error, status) => (error ? reject(error) : resolve(status)))
    //   )
    // );

    // await new Promise<void>((resolve, reject) =>
    //   port.set({ brk: true }, (error) => (error ? reject(error) : resolve()))
    // );

    // await new Promise((resolve) => setTimeout(resolve, 100));

    // await new Promise<void>((resolve, reject) =>
    //   port.set({ brk: false }, (error) => (error ? reject(error) : resolve()))
    // );
    // const payload = Buffer.alloc(1);
    // payload.writeUInt8(0x46, 0);
    const payload = Buffer.from([0x45, 0x00]);
    //01    1b 00  04 46 55 00 00 01 ff 50 00 3c 00 01 00 3c 01 ff 50 00 08 01 00 00 00 24 15 15 04    02
    //start length                                                                            checksum end
    const start = Buffer.alloc(1);
    start.writeUInt8(0x01);
    const end = Buffer.alloc(1);
    end.writeUInt8(0x02);
    const length = Buffer.alloc(2);
    length.writeUInt16LE(payload.length + 2 /*checksum*/);
    const checksum = calculateChecksum(Buffer.concat([length, payload]));

    const msg = Buffer.concat([start, length, payload, checksum, end]);

    let sending = 10;
    while (sending) {
      // await new Promise<void>((resolve, reject) =>
      //   port.write(Buffer.from([0x01, 0x02]), (error) =>
      //     error ? reject(error) : resolve()
      //   )
      // );
      await new Promise<void>((resolve, reject) =>
        port.write(msg, (error) => (error ? reject(error) : resolve()))
      );
      await new Promise<void>((resolve, reject) =>
        port.drain((error) => (error ? reject(error) : resolve()))
      );
      console.log("<<< ", msg);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      sending--;
    }

    // await new Promise<void>((resolve, reject) =>
    //   port.close((error) => (error ? reject(error) : resolve()))
    // );
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
