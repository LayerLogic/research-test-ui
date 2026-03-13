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

export const saveGateToTxt = (data, file_name) => {
  if (data.length === 0) {
    log("No data to save!", "error");
    return;
  }

  let textContent = "Vg (V)\t\tX (mV)\t\tY (mV)\t\tI (uA)\t\tf (Hz)\n"; // Headers with tab separation

  // Add data rows with proper formatting
  for (let i = 0; i < data.length; i++) {
    textContent += `${data[i]["Vg"]
      .toFixed(2)
      .toString()
      .replace(".", ",")}\t\t${data[i]["X"]
      .toFixed(6)
      .toString()
      .replace(".", ",")}\t\t${data[i]["Y"]
      .toFixed(6)
      .toString()
      .replace(".", ",")}\t\t${data[i]["I"]
      .toFixed(6)
      .toString()
      .replace(".", ",")}\t\t${data[i]["F"]
      .toFixed(6)
      .toString()
      .replace(".", ",")}\n`;
  }

  // Create blob and download link
  const blob = new Blob([textContent], {
    type: "text/plain;charset=utf-8",
  });
  const link = document.createElement("a");

  // Create filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${file_name}_${timestamp}.txt`;

  // Trigger download
  if (window.navigator.msSaveOrOpenBlob) {
    // For IE
    window.navigator.msSaveBlob(blob, filename);
  } else {
    // For other browsers
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

export const saveTimeToTxt = (data, file_name) => {
  if (data.length === 0) {
    log("No data to save!", "error");
    return;
  }

  // Create text content with consistent spacing
  let textContent = "Time (s)\t\tX (mV)\t\tY (mV)\t\tI (uA)\t\tf (Hz)\n";

  // Add data rows with proper formatting
  for (let i = 0; i < data.length; i++) {
    textContent += `${data[i]["t"]
      .toFixed(2)
      .toString()
      .replace(".", ",")}\t\t${data[i]["X"]
      .toFixed(6)
      .toString()
      .replace(".", ",")}\t\t${data[i]["Y"]
      .toFixed(6)
      .toString()
      .replace(".", ",")}\t\t${data[i]["I"]
      .toFixed(6)
      .toString()
      .replace(".", ",")}\t\t${data[i]["F"]
      .toFixed(6)
      .toString()
      .replace(".", ",")}\n`;
  }

  // Create blob and download link
  const blob = new Blob([textContent], {
    type: "text/plain;charset=utf-8",
  });
  const link = document.createElement("a");

  // Create filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${file_name}_${timestamp}.txt`;

  // Trigger download
  if (window.navigator.msSaveOrOpenBlob) {
    // For IE
    window.navigator.msSaveBlob(blob, filename);
  } else {
    // For other browsers
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
  const parsedSummary = summary.map((item) => {
    const { Vg, X, Y, I, F } = item;
    return {
      gateV: Vg,
      voltageX: X,
      voltageY: Y,
      current: I,
      frequency: F,
    };
  });

  return parsedSummary;
};

export const parseTimeSummary = (summary) => {
  if (!summary.length > 0) {
    log("No response recieved.", "warning");
    return;
  }
  const parsedSummary = summary.map((item) => {
    const { t, X, Y, I, F } = item;
    return {
      time: t,
      voltageX: X,
      voltageY: Y,
      current: I,
      frequency: F,
    };
  });

  return parsedSummary;
};
