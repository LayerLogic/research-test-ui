import { log, parseResponse } from "./utils.js";

const DEFAULT_BASELINE_WINDOW_POINTS = 5;

export class TimeAnalysis {
  constructor(serialComm, sample, chart, vg, delay) {
    this.serialComm = serialComm;
    this.sample = sample;
    this.chart = chart;
    this.timestamp = Date.now();

    this.vg = vg;
    this.delay = delay;
    this.summary = [];
    this.baseline = this.getDefaultBaseline();
  }

  getDefaultBaseline() {
    return {
      stableAtSeconds: null,
      windowPoints: DEFAULT_BASELINE_WINDOW_POINTS,
      x0: 1,
      y0: 1,
    };
  }

  getElapsedTimeSeconds(referenceTimestamp = Date.now()) {
    return (referenceTimestamp - this.timestamp) / 1000;
  }

  captureBaseline(referenceTimestamp = Date.now(), windowPoints = DEFAULT_BASELINE_WINDOW_POINTS) {
    const stableAtSeconds = this.getElapsedTimeSeconds(referenceTimestamp);
    const eligibleSummary = this.summary.filter((point) => point.t <= stableAtSeconds);

    if (!eligibleSummary.length) {
      throw new Error(`Channel ${this.sample} has no measurements to use as a stable point yet`);
    }

    const baselineWindow = eligibleSummary.slice(-Math.max(1, windowPoints));
    const x0 = baselineWindow.reduce((sum, point) => sum + point.X, 0) / baselineWindow.length;
    const y0 = baselineWindow.reduce((sum, point) => sum + point.Y, 0) / baselineWindow.length;

    this.baseline = {
      stableAtSeconds,
      windowPoints,
      x0,
      y0,
    };

    return this.baseline;
  }

  async setup() {
    try {
      const command = await this.serialComm.sendCommand(
        `Vg, ${this.vg.toFixed(2)}`,
      );
      log(command, "Sent");
      const res = await this.serialComm.read();
      log(res, "Received");
      const command2 = await this.serialComm.sendCommand(`dt, ${this.delay}`);
      log(command2, "Sent");
      const res2 = await this.serialComm.read();
      log(res2, "Received");
    } catch (error) {
      log(`Time Analysis setup error: ${error}`, "error");
    }
  }

  async run() {
    try {
      const sample = await this.serialComm.sendCommand(`s, ${this.sample}`);
      log(sample, "Sent");
      const commandRes = await this.serialComm.read();
      log(commandRes, "Received");
      const command = await this.serialComm.sendCommand(
        `ACgn, ${this.vg.toFixed(2)}`,
      );
      log(command, "sent");
      const res = await this.serialComm.read();
      log(res, "Received");
      const elapsedTime = this.getElapsedTimeSeconds();
      const {
        resistance_left,
        resistance_right,
        x_gain,
        y_gain,
        current_AC,
        frequency,
      } = parseResponse(res);
      this.summary.push({
        t: elapsedTime,
        X: x_gain,
        Y: y_gain,
        I: current_AC,
        F: frequency,
      });
      this.updateChart(
        elapsedTime.toFixed(2),
        resistance_left,
        resistance_right,
      );
    } catch (error) {
      log(`Time Analysis error: ${error}`, "error");
    }
  }

  updateChart(timestamp, res_left, res_right) {
    this.chart.data.labels.push(timestamp);
    this.chart.data.datasets[0].data.push(res_left);
    this.chart.data.datasets[1].data.push(res_right);
    this.chart.update();
  }
}
