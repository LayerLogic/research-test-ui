import {
  generateAnalysisRunId,
  log,
  parseGateSummary,
  parseTimeSummary,
  saveGateToTxt,
  saveTimeToTxt,
  sleep,
} from "./utils.js";
import { gateChartConfig, timeChartConfig } from "./chartsConfig.js";
import { SerialCommunication } from "./SerialCommunication.js";
import { GateAnalysis } from "./GateAnalysis.js";
import { TimeAnalysis } from "./TimeAnalysis.js";

document.addEventListener("DOMContentLoaded", async () => {
  const apiUrl = window.env.API_URL;
  const loginOverlay = document.getElementById("loginOverlay");
  const loginButton = document.getElementById("loginSubmitButton");

  if (!userIsLoggedIn()) {
    loginOverlay.style.display = "flex";
  } else {
    loginOverlay.style.display = "none";
  }

  loginButton.addEventListener("click", async () => {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    if (username === "" || password === "") {
      log("Please enter a username and password", "error");
      return;
    }

    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email: username,
        password,
      }),
    });

    if (res.status === 200) {
      const data = await res.json();
      if (data.user) {
        document.cookie = `ui_Auth_x=${data.user.token}; path=/; max-age=43200; Secure; SameSite=Strict`;
        document.cookie = `ui_user_id=${data.user.id}; path=/; max-age=43200; Secure; SameSite=Strict`;
        loginOverlay.style.display = "none";
      } else {
        log("Login failed", "error");
      }
    } else {
      log("Login failed", "error");
    }
  });

  function userIsLoggedIn() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    const userId = document.cookie
      ?.split("; ")
      ?.find((row) => row.startsWith("ui_user_id="))
      ?.split("=")[1];
    const token = document.cookie
      ?.split("; ")
      ?.find((row) => row.startsWith("ui_Auth_x="))
      ?.split("=")[1];

    return Boolean(id && userId && token);
  }

  let vg = parseFloat(document.getElementById("gateV").value);
  let delay = parseFloat(document.getElementById("delay").value);
  let vgStep = parseFloat(document.getElementById("stepSize").value);
  let vgMin = parseFloat(document.getElementById("vgMin").value);
  let vgMax = parseFloat(document.getElementById("vgMax").value);
  let currentAnalysisType = null;

  const channelsArr = [];
  const serialComm = new SerialCommunication();

  const connectButton = document.getElementById("connectButton");
  const resetZoomButton = document.getElementById("resetZoomButton");
  const stopButton = document.getElementById("stopButton");
  const startGateAnalysisButton = document.getElementById(
    "startGateAnalysisButton",
  );
  const startTimeAnalysisButton = document.getElementById(
    "startTimeAnalysisButton",
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
  const markStableButton = document.getElementById("markStableButton");
  const stableStatus = document.getElementById("stableStatus");
  const channels = document.getElementById("channels").children;

  sendCommandsButton.disabled = true;
  startGateAnalysisButton.disabled = true;
  startTimeAnalysisButton.disabled = true;

  let isRunning = false;
  const gateAnalysiss = {};
  const timeAnalysiss = {};

  const getTimeAnalyses = () => Object.entries(timeAnalysiss);

  const getSaveContext = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return {
      trialId: urlParams.get("id"),
      userId: document.cookie
        ?.split("; ")
        ?.find((row) => row.startsWith("ui_user_id="))
        ?.split("=")[1],
      token: document.cookie
        ?.split("; ")
        ?.find((row) => row.startsWith("ui_Auth_x="))
        ?.split("=")[1],
    };
  };

  const syncStableCaptureControls = () => {
    if (!markStableButton) {
      return;
    }

    const hasTimeAnalysis = getTimeAnalyses().length > 0;
    const canCapture =
      isRunning && currentAnalysisType === "time" && hasTimeAnalysis;
    markStableButton.disabled = !canCapture;
  };

  const renderStableSummary = () => {
    if (!stableStatus) {
      return;
    }

    const capturedBaselines = getTimeAnalyses()
      .map(([sample, analysis]) => ({ sample, baseline: analysis.baseline }))
      .filter(({ baseline }) => baseline?.stableAtSeconds !== null);

    if (!capturedBaselines.length) {
      stableStatus.innerHTML = "<p>No stable point captured yet.</p>";
      return;
    }

    const rows = capturedBaselines
      .sort((left, right) => Number(left.sample) - Number(right.sample))
      .map(({ sample, baseline }) => {
        const stableAt = Number(baseline.stableAtSeconds).toLocaleString(
          undefined,
          {
            maximumFractionDigits: 2,
          },
        );
        const x0 = Number(baseline.x0).toLocaleString(undefined, {
          maximumFractionDigits: 8,
        });
        const y0 = Number(baseline.y0).toLocaleString(undefined, {
          maximumFractionDigits: 8,
        });

        return `
          <div class="stable-status-row">
            <strong>Ch ${sample}</strong>
            <span>t = ${stableAt} s</span>
            <span>X0 = ${x0}</span>
            <span>Y0 = ${y0}</span>
          </div>
        `;
      })
      .join("");

    stableStatus.innerHTML = `
      <p><strong>Stable point captured</strong></p>
      ${rows}
    `;
  };

  const captureStableBaselines = () => {
    if (!isRunning || currentAnalysisType !== "time") {
      log(
        "Stable capture is only available while a time analysis is running",
        "warning",
      );
      return;
    }

    const analyses = getTimeAnalyses();
    if (!analyses.length) {
      log("No active time analyses found", "warning");
      return;
    }

    const referenceTimestamp = Date.now();
    let capturedCount = 0;

    for (const [sample, analysis] of analyses) {
      try {
        analysis.captureBaseline(referenceTimestamp);
        capturedCount += 1;
      } catch (error) {
        log(`Channel ${sample}: ${error.message}`, "warning");
      }
    }

    renderStableSummary();

    if (capturedCount > 0) {
      log(
        `Captured stable baseline for ${capturedCount} channel(s)`,
        "success",
      );
    }
  };

  const postTestToDatabase = async (trialId, token, payload) => {
    const response = await fetch(
      `${apiUrl}/api/researcher/trials/${trialId}/testsResearcherTestUi`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || data.message || "Failed to save test");
    }

    return data;
  };

  const saveGateAnalyses = async (notes, shouldSaveToDatabase, saveContext) => {
    for (const sample in gateAnalysiss) {
      const gateSummary = gateAnalysiss[sample].summary;
      saveGateToTxt(gateSummary, `sample, ${sample}_Gate_analysis`);

      if (!shouldSaveToDatabase) {
        continue;
      }

      const payload = {
        channel: sample,
        commands: commandsTextArea.value,
        type: "gate",
        measurements: parseGateSummary(gateSummary),
        notes,
        settings: { vgMin, vgMax, gateStep: vgStep },
      };

      try {
        const data = await postTestToDatabase(
          saveContext.trialId,
          saveContext.token,
          payload,
        );
        log(
          data.message || `Saved gate analysis for channel ${sample}`,
          "success",
        );
      } catch (error) {
        log(`Channel ${sample}: ${error.message}`, "error");
      }
    }
  };

  const saveTimeAnalyses = async (notes, shouldSaveToDatabase, saveContext) => {
    const analysisRunId = generateAnalysisRunId();

    for (const sample in timeAnalysiss) {
      const analysis = timeAnalysiss[sample];
      const timeSummary = analysis.summary;
      const baseline = analysis.baseline || {
        stableAtSeconds: null,
        windowPoints: 5,
        x0: 1,
        y0: 1,
      };

      saveTimeToTxt(timeSummary, `sample, ${sample}_Time_analysis`, {
        analysisRunId,
        baseline,
      });

      if (!shouldSaveToDatabase) {
        continue;
      }

      const payload = {
        channel: sample,
        commands: commandsTextArea.value,
        type: "time",
        measurements: parseTimeSummary(timeSummary),
        notes,
        settings: { gateV: vg, delay },
        analysisRunId,
        baseline: {
          stableAtSeconds: baseline.stableAtSeconds,
          windowPoints: baseline.windowPoints,
        },
      };

      try {
        const data = await postTestToDatabase(
          saveContext.trialId,
          saveContext.token,
          payload,
        );
        log(
          data.message || `Saved time analysis for channel ${sample}`,
          "success",
        );
      } catch (error) {
        log(`Channel ${sample}: ${error.message}`, "error");
      }
    }
  };

  // Try to auto-connect if previously connected
  if (serialComm.autoConnect) {
    log("Attempting to reconnect...", "info");
    const connected = await serialComm.connect(false);
    if (connected) {
      log("Reconnected successfully!", "success");
    } else {
      log(
        "Could not automatically reconnect. Please connect manually.",
        "warning",
      );
    }
  }

  /**** EVENT LISTENERS ****/
  connectButton.addEventListener("click", () => serialComm.connect(true));

  if (serialComm.isConnected) {
    connectButton.disabled = true;
    connectButton.innerText = "Connected";
  } else {
    connectButton.disabled = false;
    connectButton.innerText = "Connect";
  }

  resetZoomButton.addEventListener("click", () => {
    if (Object.keys(gateAnalysiss).length > 0) {
      for (const sample in gateAnalysiss) {
        gateAnalysiss[sample].chart.resetZoom();
      }
    } else if (Object.keys(timeAnalysiss).length > 0) {
      for (const sample in timeAnalysiss) {
        timeAnalysiss[sample].chart.resetZoom();
      }
    }
  });

  stopButton.addEventListener("click", () => {
    isRunning = false;
    currentAnalysisType = null;
    syncStableCaptureControls();
  });

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

    currentAnalysisType = "gate";
    renderStableSummary();
    syncStableCaptureControls();

    document.getElementById("chart-container").replaceChildren();

    for (const sample of channelsArr) {
      const canvas = document.createElement("canvas");
      canvas.id = sample;
      canvas.style.border = "1px solid #ddd";
      document.getElementById("chart-container").appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const gateChart = new Chart(ctx, gateChartConfig(sample));

      gateAnalysiss[sample] = new GateAnalysis(
        serialComm,
        sample,
        gateChart,
        vgStep,
        vgMin,
        vgMax,
      );
    }

    startGateAnalysisButton.disabled = true;
    startTimeAnalysisButton.disabled = true;

    let index = 0;
    isRunning = true;
    syncStableCaptureControls();

    while (isRunning) {
      const currentIdx = index % channelsArr.length;
      const channelName = channelsArr[currentIdx];
      const gateAnalysis = gateAnalysiss[channelName];
      await gateAnalysis.run();
      index += 1;
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

    currentAnalysisType = "time";
    renderStableSummary();

    document.getElementById("chart-container").replaceChildren();

    for (const sample of channelsArr) {
      const canvas = document.createElement("canvas");
      canvas.id = sample;
      canvas.style.border = "1px solid #ddd";
      document.getElementById("chart-container").appendChild(canvas);
      const ctx = canvas.getContext("2d");
      const timeChart = new Chart(ctx, timeChartConfig(sample));
      timeAnalysiss[sample] = new TimeAnalysis(
        serialComm,
        sample,
        timeChart,
        vg,
        delay,
      );
    }

    startGateAnalysisButton.disabled = true;
    startTimeAnalysisButton.disabled = true;

    for (const sample of channelsArr) {
      await timeAnalysiss[sample].setup();
    }

    let index = 0;
    isRunning = true;
    syncStableCaptureControls();

    while (isRunning) {
      const currentIdx = index % channelsArr.length;
      const channelName = channelsArr[currentIdx];
      await timeAnalysiss[channelName].run();
      index += 1;
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
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    startGateAnalysisButton.disabled = false;
    startTimeAnalysisButton.disabled = false;
  });

  stepSizeInput.addEventListener("input", async (e) => {
    vgStep = Math.abs(parseFloat(e.target.value)) || 0.03;
    await sleep(500);
    for (const sample in gateAnalysiss) {
      gateAnalysiss[sample].vg_step = vgStep;
    }
    log(`Step size set to ${vgStep}`, "info");
  });

  vgMinInput.addEventListener("input", async (e) => {
    vgMin = e.target.value === "" ? -0.5 : parseFloat(e.target.value);
    await sleep(500);
    for (const sample in gateAnalysiss) {
      gateAnalysiss[sample].vg_min = vgMin;
    }
    log(`Vg min set to ${vgMin}`, "info");
  });

  vgMaxInput.addEventListener("input", async (e) => {
    vgMax = e.target.value === "" ? 0.5 : parseFloat(e.target.value);
    await sleep(500);
    for (const sample in gateAnalysiss) {
      gateAnalysiss[sample].vg_max = vgMax;
    }
    log(`Vg max set to ${vgMax}`, "info");
  });

  gateVInput.addEventListener("input", async (e) => {
    vg = e.target.value === "" ? 1 : parseFloat(e.target.value);
    await sleep(500);
    for (const sample in timeAnalysiss) {
      timeAnalysiss[sample].vg = vg;
    }
    log(`Vg set to ${vg}`, "info");
  });

  delayInput.addEventListener("input", async (e) => {
    delay = parseFloat(e.target.value) || 0;
    await sleep(500);
    for (const sample in timeAnalysiss) {
      timeAnalysiss[sample].delay = delay;
    }
    log(`Delay set to ${delay}`, "info");
  });

  for (const channel of channels) {
    channel.addEventListener("click", () => toggleChannel(channel));
  }

  markStableButton.addEventListener("click", captureStableBaselines);

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
    sendCommandsButton.disabled = channelsArr.length === 0;
  }

  async function save() {
    const notes = document.getElementById("testNotes").value.trim();
    const hasGateAnalyses = Object.keys(gateAnalysiss).length > 0;
    const hasTimeAnalyses = Object.keys(timeAnalysiss).length > 0;

    if (!hasGateAnalyses && !hasTimeAnalyses) {
      log("No analysis data to save", "warning");
      return;
    }

    const shouldSaveToDatabase = confirm(
      "Do you want to save the file to the database?",
    );
    const saveContext = getSaveContext();

    if (
      shouldSaveToDatabase &&
      !(saveContext.trialId && saveContext.userId && saveContext.token)
    ) {
      log("Please login to save the file", "error");
      return;
    }

    if (hasGateAnalyses) {
      await saveGateAnalyses(notes, shouldSaveToDatabase, saveContext);
    } else if (hasTimeAnalyses) {
      await saveTimeAnalyses(notes, shouldSaveToDatabase, saveContext);
    }
  }

  function openRequirementsFile() {
    window.open(
      "https://layerlogic.github.io/ui-v-2/requirements.txt",
      "_blank",
    );
  }

  renderStableSummary();
  syncStableCaptureControls();

  saveDataButton.addEventListener("click", save);
  infoCommandsButton.addEventListener("click", openRequirementsFile);
});
