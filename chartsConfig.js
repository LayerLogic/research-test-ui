const hiddenLabelScale = {
  ticks: {},
  title: {
    display: false,
  },
};

export const gateChartConfig = (sample) => ({
  type: "line",
  data: {
    labels: ["Gate"],
    datasets: [
      {
        label: "R (kΩ)",
        data: [],
        borderColor: "rgba(0, 0, 255, 1)",
        borderWidth: 2,
        fill: false,
        yAxisID: "y",
        pointStyle: "circle", // Add this line
        pointRadius: 1, // Optional: controls point size
        pointHoverRadius: 8,
      },
      {
        label: "R (kΩ)",
        data: [],
        borderColor: "rgba(255, 0, 0, 1)",
        borderWidth: 2,
        fill: false,
        yAxisID: "y1",
        pointStyle: "circle", // Add this line
        pointRadius: 1, // Optional: controls point size
        pointHoverRadius: 8,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: "y",
        },
      },
      tooltip: {
        usePointStyle: true,
      },
      legend: {
        display: false,
      },
      title: {
        display: false,
        text: `Channel: ${sample}`,
        font: {
          size: 16,
          weight: "bold",
        },
      },
    },
    scales: {
      x: {
        type: "linear",
        stacked: true,
        ...hiddenLabelScale,
      },
      y: {
        type: "linear",
        display: true,
        position: "left",
        stacked: true,
        ...hiddenLabelScale,
        grid: {
          drawOnChartArea: false,
        },
      },
      y1: {
        type: "linear",
        display: true,
        position: "right",
        stacked: true,
        ...hiddenLabelScale,
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  },
});

export const timeChartConfig = (sample) => ({
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "R (kΩ)",
        data: [],
        borderColor: "rgba(0, 0, 255, 1)",
        borderWidth: 2,
        fill: false,
        yAxisID: "y",
        pointStyle: "circle", // Add this line
        pointRadius: 1, // Optional: controls point size
        pointHoverRadius: 8,
      },
      {
        label: "R (kΩ)",
        data: [],
        borderColor: "rgba(255, 0, 0, 1)",
        borderWidth: 2,
        fill: false,
        yAxisID: "y1",
        pointStyle: "circle", // Add this line
        pointRadius: 1, // Optional: controls point size
        pointHoverRadius: 8,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: "y",
        },
      },
      tooltip: {
        usePointStyle: true,
      },
      legend: {
        display: false,
      },
      title: {
        display: false,
        text: `Channel: ${sample}`,
        font: {
          size: 16,
          weight: "bold",
        },
      },
    },
    scales: {
      x: {
        type: "linear",
        ...hiddenLabelScale,
      },
      y: {
        type: "linear",
        display: true,
        position: "left",
        ...hiddenLabelScale,
        grid: {
          drawOnChartArea: false,
        },
      },
      y1: {
        type: "linear",
        display: true,
        position: "right",
        stacked: true,
        ...hiddenLabelScale,
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  },
});
