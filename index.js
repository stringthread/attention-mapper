// https://qiita.com/kerupani129/items/3d26fef39e0e44101aad
const repaint = async () => {
  for (let i = 0; i < 2; i++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
};

// fabric.js settings
let canvas;
const setBrush = (canvas) => {
  canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
  if (canvas.freeDrawingBrush) {
    const brush = canvas.freeDrawingBrush;
    brush.color = "white";
    if (brush.getPatternSrc) {
      brush.source = brush.getPatternSrc.call(brush); // 設定を反映
    }
    brush.width = 10;
  }
};
const resetCanvas = () => {
  canvas.remove(...canvas.getObjects());
};

// opencv.js processes
const PROCESSING_IMAGE_SIZE = 2000;

function onOpenCvReady() {
  document.getElementById("status").innerHTML = "OpenCV.js is ready.";
}
function toEdge(src) {
  let clone = src.clone();
  cv.cvtColor(clone, clone, cv.COLOR_RGB2GRAY, 0);
  let x = new cv.Mat();
  let y = new cv.Mat();
  cv.Sobel(clone, x, cv.CV_8U, 1, 0);
  cv.Sobel(clone, y, cv.CV_8U, 0, 1);
  clone.delete();
  let dst = new cv.Mat();
  cv.add(x, y, dst);
  x.delete();
  y.delete();
  cv.bitwise_not(dst, dst);
  cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA, 0);
  return dst;
}
function toMask(src) {
  let clone = src.clone();
  cv.cvtColor(clone, clone, cv.COLOR_RGB2GRAY, 0);
  cv.threshold(clone, clone, 128, 255, cv.THRESH_BINARY);
  let blurred = new cv.Mat();
  const radius = Math.floor(Math.min(clone.cols, clone.rows) / 20) * 2 - 1;
  let ksize = new cv.Size(radius, radius);
  cv.GaussianBlur(clone, blurred, ksize, 0);
  cv.subtract(blurred, clone, blurred);
  let bright_blur = new cv.Mat();
  cv.equalizeHist(blurred, bright_blur);
  blurred.delete();
  let dst = new cv.Mat();
  cv.add(clone, bright_blur, dst);
  clone.delete();
  bright_blur.delete();
  // dst.convertTo(dst, -1, 1, -Math.floor(255 * 0.3));
  return dst;
}
function toAttentionFig(src, inputMask) {
  const edge = toEdge(src);
  let mask = toMask(inputMask);
  cv.cvtColor(mask, mask, cv.COLOR_GRAY2RGBA, 0);
  let maskedSrc = new cv.Mat();
  let maskedEdge = new cv.Mat();
  let maskNega = new cv.Mat();
  cv.bitwise_not(mask, maskNega);
  cv.subtract(src, maskNega, maskedSrc);
  cv.subtract(edge, maskNega, maskedEdge);
  maskNega.delete();
  let dst = new cv.Mat();
  cv.subtract(edge, mask, dst);
  mask.delete();
  edge.delete();
  let afterMask = new cv.Mat();
  cv.addWeighted(maskedEdge, 0.1, maskedSrc, 0.9, 0, afterMask);
  maskedSrc.delete();
  maskedEdge.delete();
  cv.add(dst, afterMask, dst);
  afterMask.delete();
  return dst;
}
function attentionEndToEnd() {
  (async () => {
    const src = cv.imread("imageSrc");
    const dsize = new cv.Size(
      PROCESSING_IMAGE_SIZE,
      Math.floor((PROCESSING_IMAGE_SIZE * src.rows) / src.cols)
    );
    let resized = new cv.Mat();
    cv.resize(src, resized, dsize);
    src.delete();
    canvas.setBackgroundColor("black");
    document.getElementById("dummy-input-mask").src = canvas.toDataURL({
      format: "png",
    });
    await repaint();
    const mask = cv.imread("dummy-input-mask");
    let resizedMask = new cv.Mat();
    cv.resize(mask, resizedMask, dsize);
    mask.delete();
    canvas.setBackgroundColor("transparent");
    const dst = toAttentionFig(resized, resizedMask);
    resized.delete();
    resizedMask.delete();
    cv.imshow("imageDst", dst);
    dst.delete();
  })();
}

window.onload = () => {
  canvas = new fabric.Canvas("canvas", {
    isDrawingMode: true, // 手書き入力ON
  });
  setBrush(canvas);
  const imgElement = document.getElementById("imageSrc");
  const inputElement = document.getElementById("fileInput");
  const canvasElement = document.getElementById("canvas");
  inputElement.addEventListener(
    "change",
    async (e) => {
      imgElement.src = URL.createObjectURL(e.target.files[0]);
      await new Promise((resolve) => setTimeout(resolve, 500)); // HACK: 画像読み込みのタイミング調整
      await repaint();
      canvas.setHeight(imgElement.clientHeight);
      canvas.setWidth(imgElement.clientWidth);
      canvas.renderAll();
    },
    false
  );
};
