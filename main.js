import { log, saveGateToTxt, saveTimeToTxt, sleep } from "./utils.js";
import { gateChartConfig, timeChartConfig } from "./chartsConfig.js";
import { SerialCommunication } from "./SerialCommunication.js";
import { GateAnalysis } from "./GateAnalysis.js";
import { TimeAnalysis } from "./TimeAnalysis.js";

document.addEventListener("DOMContentLoaded", async () => {
  let vg = parseFloat(document.getElementById("gateV").value);
  let delay = parseFloat(document.getElementById("delay").value);
  let vgStep = parseFloat(document.getElementById("stepSize").value);
  let vgMin = parseFloat(document.getElementById("vgMin").value);
  let vgMax = parseFloat(document.getElementById("vgMax").value);
  const channelsArr = [];

  const serialComm = new SerialCommunication();
  const connectButton = document.getElementById("connectButton");
  const resetZoomButton = document.getElementById("resetZoomButton");
  const stopButton = document.getElementById("stopButton");
  const startGateAnalysisButton = document.getElementById(
    "startGateAnalysisButton"
  );
  const startTimeAnalysisButton = document.getElementById(
    "startTimeAnalysisButton"
  );
  const sendCommandsButton = document.getElementById("sendCommandsButton");
  const saveDataButton = document.getElementById("saveDataButton");
  const toggleGridButton = document.getElementById("toggleGrid");
  const infoCommandsButton = document.getElementById("infoCommandsButton");
  const commandsTextArea = document.getElementById("commandsTextArea");
  const stepSizeInput = document.getElementById("stepSize");
  const vgMinInput = document.getElementById("vgMin");
  const vgMaxInput = document.getElementById("vgMax");
  const gateVInput = document.getElementById("gateV");
  const delayInput = document.getElementById("delay");
  const channels = document.getElementById("channels").children;

  let isRunning = false;
  const gateAnalysiss = {};
  const timeAnalysiss = {};

  // Try to auto-connect if previously connected
  if (serialComm.autoConnect) {
    log("Attempting to reconnect...", "info");
    const connected = await serialComm.connect(false);
    if (connected) {
      log("Reconnected successfully!", "success");
    } else {
      log(
        "Could not automatically reconnect. Please connect manually.",
        "warning"
      );
    }
  }

  /**** EVENT LISTENERS ****/
  // Connect to Arduino
  connectButton.addEventListener("click", () => serialComm.connect(true));
  // disable the connect button if the connection is successful
  if (serialComm.isConnected) {
    connectButton.disabled = true;
    connectButton.innerText = "Connected";
  } else {
    connectButton.disabled = false;
    connectButton.innerText = "Connect";
  }

  // Reset zoom for all charts
  resetZoomButton.addEventListener("click", () => {
    if (Object.keys(gateAnalysiss).length > 0) {
      for (const sample in gateAnalysiss) {
        const gateChart = gateAnalysiss[sample].chart;
        gateChart.resetZoom();
      }
    } else if (Object.keys(timeAnalysiss).length > 0) {
      for (const sample in timeAnalysiss) {
        const timeChart = timeAnalysiss[sample].chart;
        timeChart.resetZoom();
      }
    }
  });

  // Stop all analyses
  stopButton.addEventListener("click", () => {
    isRunning = false;
  });

  // Toggle grid change the       grid-template-columns: 1fr; to grid-template-columns: 1fr 1fr;
  toggleGridButton.addEventListener("click", () => {
    const container = document.getElementById("chart-container");
    if (container.style.gridTemplateColumns === "1fr") {
      container.style.gridTemplateColumns = "1fr 1fr";
      toggleGridButton.innerText = "Grid";
    } else {
      container.style.gridTemplateColumns = "1fr";
      toggleGridButton.innerText = "Single Column";
    }
  });

  // Start Gate analyses
  startGateAnalysisButton.addEventListener("click", async () => {
    if (!serialComm.isConnected) {
      const connected = await serialComm.connect(false);
      if (!connected) {
        log("Please connect to Arduino first", "error");
        return;
      }
    }
    if (channelsArr.length === 0) {
      log("Please select at least one channel", "error");
      return;
    }
    for (const sample of channelsArr) {
      const canvas = document.createElement("canvas");
      canvas.id = sample;
      canvas.style.border = "1px solid #ddd";
      const container = document.getElementById("chart-container");
      container.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const gateChart = new Chart(ctx, gateChartConfig(sample));

      gateAnalysiss[sample] = new GateAnalysis(
        serialComm,
        sample,
        gateChart,
        vgStep,
        vgMin,
        vgMax
      );
    }
    startGateAnalysisButton.disabled = true;
    startTimeAnalysisButton.disabled = true;

    let index = 0;
    isRunning = true;
    while (isRunning) {
      let current = (index % channelsArr.length) + 1;
      const gateAnalysis = gateAnalysiss[current];
      await gateAnalysis.run();
      index++;
    }
  });

  startTimeAnalysisButton.addEventListener("click", async () => {
    if (!serialComm.isConnected) {
      const connected = await serialComm.connect(false);
      if (!connected) {
        log("Please connect to Arduino first", "error");
        return;
      }
    }
    if (channelsArr.length === 0) {
      log("Please select at least one channel", "error");
      return;
    }
    for (const sample of channelsArr) {
      const canvas = document.createElement("canvas");
      canvas.id = sample;
      canvas.style.border = "1px solid #ddd";
      const container = document.getElementById("chart-container");
      container.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const timeChart = new Chart(ctx, timeChartConfig(sample));
      timeAnalysiss[sample] = new TimeAnalysis(
        serialComm,
        sample,
        timeChart,
        vg,
        delay
      );
    }
    startGateAnalysisButton.disabled = true;
    startTimeAnalysisButton.disabled = true;

    let index = 0;
    isRunning = true;
    while (isRunning) {
      let current = (index % channelsArr.length) + 1;
      const timeAnalysis = timeAnalysiss[current];
      await timeAnalysis.setup();
      await timeAnalysis.run();
      index++;
    }
  });

  sendCommandsButton.addEventListener("click", async () => {
    if (!serialComm.isConnected) {
      const connected = await serialComm.connect(false);
      if (!connected) {
        log("Please connect to Arduino first", "error");
        return;
      }
    }

    const commands = commandsTextArea.value.trim().split("\n");
    for (const command of commands) {
      const req = await serialComm.sendCommand(command);
      log(req, "info");
      const res = await serialComm.read();
      log(res, "info");

      /* Wait for 500ms before sending the next command
       * This is to avoid overwhelming the serial buffer
       * and to ensure that the Arduino has time to process the command
       * and send a response back */
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  });

  // Input handlers
  stepSizeInput.addEventListener("input", async (e) => {
    vgStep = Math.abs(parseFloat(e.target.value)) || 0.03;
    await sleep(500);
    for (const sample in gateAnalysiss) {
      const gateAnalysis = gateAnalysiss[sample];
      gateAnalysis.vg_step = vgStep;
    }
    log(`Step size set to ${vgStep}`, "info");
  });

  vgMinInput.addEventListener("input", async (e) => {
    if (e.target.value === "") {
      vgMin = -0.5;
    } else {
      vgMin = parseFloat(e.target.value);
    }
    await sleep(500);
    for (const sample in gateAnalysiss) {
      const gateAnalysis = gateAnalysiss[sample];
      gateAnalysis.vg_min = vgMin;
    }
    log(`Vg min set to ${vgMin}`, "info");
  });

  vgMaxInput.addEventListener("input", async (e) => {
    if (e.target.value === "") {
      vgMax = 0.5;
    } else {
      vgMax = parseFloat(e.target.value);
    }
    await sleep(500);
    for (const sample in gateAnalysiss) {
      const gateAnalysis = gateAnalysiss[sample];
      gateAnalysis.vg_max = vgMax;
    }
    log(`Vg max set to ${vgMax}`, "info");
  });

  gateVInput.addEventListener("input", async (e) => {
    if (e.target.value === "") {
      vg = 1;
    } else {
      vg = parseFloat(e.target.value);
    }
    await sleep(500);
    for (const sample in timeAnalysiss) {
      const timeAnalysis = timeAnalysiss[sample];
      timeAnalysis.vg = vg;
    }
    log(`Vg set to ${vg}`, "info");
  });

  delayInput.addEventListener("input", async (e) => {
    delay = parseFloat(e.target.value);
    await sleep(500);
    for (const sample in timeAnalysiss) {
      const timeAnalysis = timeAnalysiss[sample];
      timeAnalysis.delay = delay;
    }
    log(`Delay set to ${delay}`, "info");
  });

  // Channel selection
  for (const channel of channels) {
    channel.addEventListener("click", () => toggleChannel(channel));
  }

  function toggleChannel(channel) {
    const channelId = channel.id;
    const index = channelsArr.indexOf(channelId);
    if (index === -1) {
      channelsArr.push(channelId);
      channel.className = channel.className + " pressed";
    } else {
      channelsArr.splice(index, 1);
      channel.className = channel.className.replace(" pressed", "");
    }
  }

  function save() {
    if (Object.keys(gateAnalysiss).length > 0) {
      for (const sample in gateAnalysiss) {
        const gateSummary = gateAnalysiss[sample].summary;
        saveGateToTxt(gateSummary, `sample, ${sample}_Gate_analysis`);
      }
    } else if (Object.keys(timeAnalysiss).length > 0) {
      for (const sample in timeAnalysiss) {
        const timeSummary = timeAnalysiss[sample].summary;
        saveTimeToTxt(timeSummary, `sample, ${sample}_Time_analysis`);
      }
    }
  }

  function open_requirements_file() {
    window.open(
      "https://layerlogic.github.io/ui-v-2/requirements.txt",
      "_blank"
    );
  }

  saveDataButton.addEventListener("click", save);
  infoCommandsButton.addEventListener("click", open_requirements_file);
});
