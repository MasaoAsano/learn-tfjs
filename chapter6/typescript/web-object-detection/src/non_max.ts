import * as tf from "@tensorflow/tfjs";
import "core-js/stable";
import "regenerator-runtime/runtime";
import { CLASSES } from "./labels.js";

async function performDetections() {
  await tf.ready();
  const modelPath =
    "https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1";

  const model = await tf.loadGraphModel(modelPath, { fromTFHub: true });
  const mysteryImage = document.getElementById("mystery") as HTMLImageElement;
  const myTensor = tf.browser.fromPixels(mysteryImage);
  // SSD Mobilenet single batch
  const readyfied = tf.expandDims(myTensor, 0);
  const results = await model.executeAsync(readyfied);
  // Prep Canvas
  const detection = document.getElementById("detection") as HTMLCanvasElement;
  const ctx = detection.getContext("2d");
  const imgWidth = mysteryImage.width;
  const imgHeight = mysteryImage.height;
  detection.width = imgWidth;
  detection.height = imgHeight;

  // Get a clean tensor of top indices
  const detectionThreshold = 0.4;
  const iouThreshold = 0.5;
  const maxBoxes = 20;
  const prominentDetection = tf.topk(results[0]);
  const justBoxes = results[1].squeeze();
  const justValues = prominentDetection.values.squeeze();

  // Move results back to JavaScript in parallel
  const [maxIndices, scores, boxes] = await Promise.all([
    prominentDetection.indices.data(),
    justValues.array(),
    justBoxes.array(),
  ]);

  // https://arxiv.org/pdf/1704.04503.pdf, use Async to keep visuals
  const nmsDetections = await tf.image.nonMaxSuppressionWithScoreAsync(
    justBoxes, // [numBoxes, 4]
    justValues, // [numBoxes]
    maxBoxes,
    iouThreshold,
    detectionThreshold,
    1 // 0 is normal NMS, 1 is max Soft-NMS for overlapping support
  );

  const chosen = await nmsDetections.selectedIndices.data();
  // Mega Clean
  tf.dispose([
    results[0],
    results[1],
    model,
    nmsDetections.selectedIndices,
    nmsDetections.selectedScores,
    prominentDetection.indices,
    prominentDetection.values,
    myTensor,
    readyfied,
    justBoxes,
    justValues,
  ]);

  chosen.forEach((detection) => {
    ctx.strokeStyle = "#0F0";
    ctx.lineWidth = 4;
    const detectedIndex = maxIndices[detection];
    const detectedClass = CLASSES[detectedIndex];
    const detectedScore = scores[detection];
    const dBox = boxes[detection];
    console.log(detectedClass, detectedScore);

    // No negative values for start positions
    const startY = dBox[0] > 0 ? dBox[0] * imgHeight : 0;
    const startX = dBox[1] > 0 ? dBox[1] * imgWidth : 0;
    const height = (dBox[2] - dBox[0]) * imgHeight;
    const width = (dBox[3] - dBox[1]) * imgWidth;
    ctx.strokeRect(startX, startY, width, height);
  });

  console.log("Tensor Memory Status:", tf.memory().numTensors);
}

performDetections();