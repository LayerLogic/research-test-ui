import { log } from "./utils.js";

export class SerialCommunication {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.isConnected = false;
    this.readableStreamClosed = null;
    this.autoConnect = JSON.parse(
      localStorage.getItem("autoConnect") || "false",
    );
  }

  async connect(manualConnect = true) {
    try {
      // If this is a manual connection request, store the info
      if (manualConnect) {
        localStorage.setItem("autoConnect", "true");
        this.autoConnect = true;
      }

      if (!this.isConnected) {
        // Request a port or use one from a previous session
        this.port = manualConnect
          ? await navigator.serial.requestPort()
          : (await navigator.serial.getPorts())[0];

        if (!this.port) {
          if (!manualConnect) {
            log("No previously connected port found", "info");
            return false;
          } else {
            throw new Error("Failed to get port");
          }
        }

        await this.port.open({ baudRate: 115200 });

        const textDecoder = new TextDecoderStream();
        // Store the promise so we can properly handle stream closure
        this.readableStreamClosed = this.port.readable
          .pipeTo(textDecoder.writable)
          .catch((error) => {
            // Don't log if it's an expected close
            if (error.name !== "AbortError") {
              log(`Stream pipe error: ${error}`, "error");
            }
          });
        this.reader = textDecoder.readable.getReader();
        this.writer = this.port.writable.getWriter();

        // Use timeout for initial read to prevent hanging
        // Some devices might not send data immediately
        try {
          const res = await this.read(5000); // 5 second timeout
          if (res) {
            log(res, "success");
          } else {
            log("Connected (no initial response from device)", "info");
          }
        } catch (readError) {
          // Connection is still valid even if initial read times out
          log(
            "Connected (device handshake timeout - this may be normal)",
            "info",
          );
        }

        this.isConnected = true;
        return true;
      }
      return true;
    } catch (error) {
      log(`Error connecting: ${error}`, "error");
      // Cleanup on failure
      await this.cleanup();
      if (manualConnect) {
        // Reset state if manual connection fails
        localStorage.removeItem("autoConnect");
        this.autoConnect = false;
      }
      this.isConnected = false;
      return false;
    }
  }

  // Helper to create a timeout promise
  withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  async read(timeoutMs = null) {
    let receivedBuffer = "";
    try {
      // If no reader available, return null
      if (!this.reader) {
        return null;
      }

      const readOnce = async () => {
        const { value, done } = await this.reader.read();
        if (done) {
          return { value: null, done: true };
        }
        return { value, done: false };
      };

      while (true) {
        let result;
        if (timeoutMs) {
          result = await this.withTimeout(readOnce(), timeoutMs);
        } else {
          result = await readOnce();
        }

        const { value, done } = result;
        if (done) {
          return null;
        }
        if (value) {
          receivedBuffer += value;
          const lines = receivedBuffer.split("\n");
          while (lines.length > 1) {
            const line = lines.shift().trim();
            if (line) {
              return line;
            }
          }
          receivedBuffer = lines[0];
        }
      }
    } catch (error) {
      if (error.message && error.message.includes("timed out")) {
        // Timeout is not a fatal error, just return null
        return null;
      }
      log(`Read error: ${error}`, "error");
      this.isConnected = false;
      return null;
    }
  }

  // Helper method to cleanup resources
  async cleanup() {
    try {
      if (this.reader) {
        await this.reader.cancel().catch(() => {});
        this.reader.releaseLock();
        this.reader = null;
      }
    } catch (e) {
      /* ignore cleanup errors */
    }

    try {
      if (this.writer) {
        await this.writer.close().catch(() => {});
        this.writer.releaseLock();
        this.writer = null;
      }
    } catch (e) {
      /* ignore cleanup errors */
    }

    try {
      if (this.readableStreamClosed) {
        await this.readableStreamClosed.catch(() => {});
        this.readableStreamClosed = null;
      }
    } catch (e) {
      /* ignore cleanup errors */
    }

    try {
      if (this.port) {
        await this.port.close().catch(() => {});
        this.port = null;
      }
    } catch (e) {
      /* ignore cleanup errors */
    }
  }

  async sendCommand(command) {
    if (!this.writer) {
      await this.connect(false);
      if (!this.writer) {
        log("No connection available", "error");
        return;
      }
    }

    const commandWithNewline = command.trim() + "\n";
    const encoder = new TextEncoder();
    const data = encoder.encode(commandWithNewline);
    await this.writer.write(data);
    return command;
  }

  async disconnect() {
    await this.cleanup();
    this.isConnected = false;
    localStorage.removeItem("autoConnect");
    this.autoConnect = false;
  }
}
