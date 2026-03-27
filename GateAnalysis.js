import { log, parseResponse } from "./utils.js";

export class GateAnalysis {
  constructor(serialComm, sample, chart, vg_step, vg_min, vg_max) {
    this.serialComm = serialComm;
    this.chart = chart;

    this.vg = vg_min || 0;
    this.vg_step = vg_step;
    this.vg_min = vg_min;
    this.vg_max = vg_max;
    this.sample = sample;

    this.summary = [];
    this.isIncreasing = true;
  }

  async run() {
    console.log("Running Gate Analysis", this.vg);
    try {
      const sample = await this.serialComm.sendCommand(`s, ${this.sample}`);
      log(sample, "Sent");
      const commandRes = await this.serialComm.read();
      log(commandRes, "Received");
      const command = await this.serialComm.sendCommand(
        `ACgn, ${this.vg.toFixed(2)}`
      );
      log(command, "Sent");
      const res = await this.serialComm.read();
      log(res, "Received");
      const {
        resistance_left,
        resistance_right,
        x_gain,
        y_gain,
        current_AC,
        frequency,
      } = parseResponse(res);
      this.summary.push({
        Vg: this.vg,
        X: x_gain,
        Y: y_gain,
        I: current_AC,
        F: frequency,
      });
      this.updateChart(this.vg, resistance_left, resistance_right);
      const precision = 1e6;
      if (this.isIncreasing) {
        this.vg = Math.round((this.vg + this.vg_step) * precision) / precision;
        if (this.vg >= this.vg_max) {
          this.isIncreasing = false;
          this.vg = this.vg_max;
        }
      } else {
        this.vg = Math.round((this.vg - this.vg_step) * precision) / precision;
        if (this.vg <= this.vg_min) {
          this.isIncreasing = true;
          this.vg = this.vg_min;
        }
      }
    } catch (error) {
      log(`Gate Analysis error: ${error}`, "error");
    }
  }

  updateChart(vg, res_left, res_right) {
    this.chart.data.labels.push(vg);
    this.chart.data.datasets[0].data.push(res_left);
    this.chart.data.datasets[1].data.push(res_right);
    this.chart.update();
  }
}
