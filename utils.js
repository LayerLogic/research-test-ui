export const log = (message, type = "info") => {
  const logEntry = document.createElement("div");
  logEntry.textContent = `[${type}] ${message}`;
  logEntry.style.color = color(type);

  const consoleElement = document.getElementById("console");
  consoleElement.appendChild(logEntry);
  consoleElement.scrollTop = consoleElement.scrollHeight;
};

function color(type) {
  switch (type) {
    case "error":
      return "red";
    case "success":
      return "green";
    case "warning":
      return "orange";
    case "info":
      return "blue";
    default:
      return "black";
  }
}

const formatFileNumber = (value, digits = 6) =>
  value.toFixed(digits).toString().replace(".", ",");

const formatMetadataValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(".", ",");
};

export const saveGateToTxt = (data, file_name) => {
  if (data.length === 0) {
    log("No data to save!", "error");
    return;
  }

  let textContent = "Vg (V)\t\tX (mV)\t\tY (mV)\t\tI (uA)\t\tf (Hz)\n";

  for (let i = 0; i < data.length; i += 1) {
    textContent += `${data[i]["Vg"]
      .toFixed(2)
      .toString()
      .replace(".", ",")}\t\t${formatFileNumber(data[i]["X"])}\t\t${formatFileNumber(
      data[i]["Y"],
    )}\t\t${formatFileNumber(data[i]["I"])}\t\t${formatFileNumber(data[i]["F"])}\n`;
  }

  const blob = new Blob([textContent], {
    type: "text/plain;charset=utf-8",
  });
  const link = document.createElement("a");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${file_name}_${timestamp}.txt`;

  if (window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveBlob(blob, filename);
  } else {
    const url = window.URL.createObjectURL(blob);
    link.href = url;
    link.style.display = "none";
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  log(`Data saved as ${filename}`, "success");
};

export const saveTimeToTxt = (data, file_name, metadata = {}) => {
  if (data.length === 0) {
    log("No data to save!", "error");
    return;
  }

  const baseline = metadata.baseline || {
    stableAtSeconds: null,
    windowPoints: 5,
    x0: 1,
    y0: 1,
  };

  let textContent = "";
  textContent += `Analysis Run ID:\t${metadata.analysisRunId || ""}\n`;
  textContent += `Stable At (s):\t${formatMetadataValue(baseline.stableAtSeconds)}\n`;
  textContent += `X0:\t${formatMetadataValue(baseline.x0)}\n`;
  textContent += `Y0:\t${formatMetadataValue(baseline.y0)}\n`;
  textContent += `Window Points:\t${formatMetadataValue(baseline.windowPoints || 5)}\n\n`;
  textContent += "Time (s)\t\tX (mV)\t\tY (mV)\t\tI (uA)\t\tf (Hz)\n";

  for (let i = 0; i < data.length; i += 1) {
    textContent += `${data[i]["t"]
      .toFixed(2)
      .toString()
      .replace(".", ",")}\t\t${formatFileNumber(data[i]["X"])}\t\t${formatFileNumber(
      data[i]["Y"],
    )}\t\t${formatFileNumber(data[i]["I"])}\t\t${formatFileNumber(data[i]["F"])}\n`;
  }

  const blob = new Blob([textContent], {
    type: "text/plain;charset=utf-8",
  });
  const link = document.createElement("a");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${file_name}_${timestamp}.txt`;

  if (window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveBlob(blob, filename);
  } else {
    const url = window.URL.createObjectURL(blob);
    link.href = url;
    link.style.display = "none";
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  log(`Data saved as ${filename}`, "success");
};

export const generateAnalysisRunId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const parseResponse = (response) => {
  if (!response) {
    log("No response recieved.", "warning");
    return;
  }

  const values = response.split(",").map((v) => parseFloat(v.trim()));
  const [x_gain, y_gain, current_AC, frequency] = values;

  const resistance_left = x_gain / current_AC;
  const resistance_right = y_gain / current_AC;

  return {
    resistance_left,
    resistance_right,
    x_gain,
    y_gain,
    current_AC,
    frequency,
  };
};

export const parseGateSummary = (summary) => {
  if (!summary.length > 0) {
    log("No response recieved.", "warning");
    return;
  }

  return summary.map((item) => {
    const { Vg, X, Y, I, F } = item;
    return {
      gateV: Vg,
      voltageX: X,
      voltageY: Y,
      current: I,
      frequency: F,
    };
  });
};

export const parseTimeSummary = (summary) => {
  if (!summary.length > 0) {
    log("No response recieved.", "warning");
    return;
  }

  return summary.map((item) => {
    const { t, X, Y, I, F } = item;
    return {
      time: t,
      voltageX: X,
      voltageY: Y,
      current: I,
      frequency: F,
    };
  });
};
