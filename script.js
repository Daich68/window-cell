const FILTERS = [
  'grayscale(100%) contrast(200%)',
  'grayscale(100%) brightness(150%) contrast(150%)',
  'grayscale(100%) invert(100%)',
  'grayscale(100%) sepia(50%) contrast(150%)',
  'grayscale(100%) brightness(50%) contrast(300%)'
];

async function loadFaceAPI() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
    script.async = true;
    script.onload = async () => {
      try {
        // Используем модели напрямую из CDN
        await faceapi.nets.tinyFaceDetector.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');
        console.log("Модели загружены");
        resolve(true);
      } catch (e) {
        reject(e);
      }
    };
    script.onerror = (e) => {
      console.error("Ошибка загрузки face-api.js:", e);
      reject(e);
    };
    document.head.appendChild(script);
  });
}

async function main() {
  try {
    await loadFaceAPI();
    
    // Получаем видео-поток
    const video = document.getElementById("video");
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    video.addEventListener("play", () => {
      console.log("Видео запущено");
      // Дождемся, пока видео будет готово
      if (video.readyState >= 2) {
        startFaceDetection(video);
      } else {
        video.addEventListener('loadeddata', () => startFaceDetection(video));
      }
    });
  } catch (e) {
    console.error("Ошибка при инициализации:", e);
  }
}

// Запускаем main() после загрузки страницы
document.addEventListener('DOMContentLoaded', main);

async function startFaceDetection(video) {
  const options = new faceapi.TinyFaceDetectorOptions();
  const activeWindows = new Map();
  const MAX_WINDOWS = 10;
  const WINDOW_LIFETIME = 10000;

  window.video = video;

  function bringWindowsToFront() {
    const currentTime = Date.now();
    for (const [windowId, creationTime] of activeWindows) {
      const win = window[windowId];
      if (currentTime - creationTime > WINDOW_LIFETIME) {
        if (win && !win.closed) {
          win.close();
        }
        activeWindows.delete(windowId);
        delete window[windowId];
      }
    }
  }

  setInterval(bringWindowsToFront, 1000);

  function calculateMosaicPositions(videoRect) {
    const mosaicUnit = 150;
    
    const screenX = window.screenX + videoRect.left;
    const screenY = window.screenY + videoRect.top;
    const centerX = screenX + videoRect.width / 2;
    const centerY = screenY + videoRect.height / 2;

    return {
      leftEyebrow: {
        x: centerX - mosaicUnit * 1.5,
        y: centerY - mosaicUnit * 1.2,
        width: mosaicUnit,
        height: mosaicUnit * 0.4
      },
      rightEyebrow: {
        x: centerX + mosaicUnit * 0.5,
        y: centerY - mosaicUnit * 1.2,
        width: mosaicUnit,
        height: mosaicUnit * 0.4
      },
      leftEye: {
        x: centerX - mosaicUnit * 1.5,
        y: centerY - mosaicUnit * 0.7,
        width: mosaicUnit,
        height: mosaicUnit * 0.6
      },
      rightEye: {
        x: centerX + mosaicUnit * 0.5,
        y: centerY - mosaicUnit * 0.7,
        width: mosaicUnit,
        height: mosaicUnit * 0.6
      },
      nose: {
        x: centerX - mosaicUnit * 0.5,
        y: centerY - mosaicUnit * 0.5,
        width: mosaicUnit,
        height: mosaicUnit * 1.2
      },
      mouth: {
        x: centerX - mosaicUnit,
        y: centerY + mosaicUnit * 0.7,
        width: mosaicUnit * 2,
        height: mosaicUnit * 0.6
      },
      leftEar: {
        x: centerX - mosaicUnit * 2.5,
        y: centerY,
        width: mosaicUnit * 0.8,
        height: mosaicUnit * 1.2
      },
      rightEar: {
        x: centerX + mosaicUnit * 1.7,
        y: centerY,
        width: mosaicUnit * 0.8,
        height: mosaicUnit * 1.2
      },
      chin: {
        x: centerX - mosaicUnit * 0.8,
        y: centerY + mosaicUnit * 1.5,
        width: mosaicUnit * 1.6,
        height: mosaicUnit * 0.8
      }
    };
  }

  function createOrUpdateWindow(id, partData, width, height) {
    try {
      let win = window[id];
      const videoRect = video.getBoundingClientRect();
      const partName = id.split('_')[1];
      
      const mosaicLayout = calculateMosaicPositions(videoRect);
      const position = mosaicLayout[partName];

      if (!win || win.closed) {
        const features = [
          `width=${position.width}`,
          `height=${position.height}`,
          `left=${position.x}`,
          `top=${position.y}`,
          'resizable=no',
          'minimizable=no',
          'alwaysOnTop=yes',
          'toolbar=no',
          'location=no',
          'status=no',
          'menubar=no'
        ].join(',');

        win = window.open("", id, features);
        if (!win) return false;

        window[id] = win;
        
        win.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { 
                  margin: 0;
                  overflow: hidden;
                  background: black;
                }
                canvas {
                  display: block;
                  width: 100%;
                  height: 100%;
                }
              </style>
            </head>
            <body>
              <canvas id="canvas"></canvas>
            </body>
          </html>
        `);
        win.document.close();
      }

      const canvas = win.document.getElementById("canvas");
      if (!canvas) return false;

      canvas.width = position.width;
      canvas.height = position.height;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.filter = 'grayscale(100%) contrast(150%)';

      const points = partData.points;
      const bounds = {
        left: Math.min(...points.map(p => p.x)),
        top: Math.min(...points.map(p => p.y)),
        right: Math.max(...points.map(p => p.x)),
        bottom: Math.max(...points.map(p => p.y))
      };

      const padding = 20;
      const sourceWidth = bounds.right - bounds.left + padding * 2;
      const sourceHeight = bounds.bottom - bounds.top + padding * 2;

      try {
        ctx.drawImage(
          video,
          bounds.left - padding,
          bounds.top - padding,
          sourceWidth,
          sourceHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );
      } catch (e) {
        console.log("Ошибка при отрисовке изображения:", e);
      }

      return true;
    } catch (e) {
      console.log(`Ошибка в createOrUpdateWindow для ${id}:`, e);
      return false;
    }
  }

  setInterval(async () => {
    const detections = await faceapi.detectSingleFace(video, options).withFaceLandmarks(true);
    if (!detections) return;

    const { landmarks } = detections;
    const parts = {
      leftEyebrow: { points: landmarks.getLeftEyeBrow() },
      rightEyebrow: { points: landmarks.getRightEyeBrow() },
      leftEye: { points: landmarks.getLeftEye() },
      rightEye: { points: landmarks.getRightEye() },
      nose: { points: landmarks.getNose() },
      mouth: { points: landmarks.getMouth() },
      leftEar: { points: landmarks.getJawOutline().slice(0, 3) },
      rightEar: { points: landmarks.getJawOutline().slice(-3) },
      chin: { points: landmarks.getJawOutline().slice(6, 11) }
    };

    const currentTime = Date.now();
    
    // Обновляем все существующие окна
    for (const [windowId, creationTime] of activeWindows) {
      const partName = windowId.split('_')[1];
      if (parts[partName]) {
        const win = window[windowId];
        if (win && !win.closed) {
          createOrUpdateWindow(
            windowId,
            parts[partName],
            getPartSize(partName).width,
            getPartSize(partName).height
          );
        }
      }
    }

    // Создаем новые окна, если нужно
    for (const [partName, partData] of Object.entries(parts)) {
      const windowId = `face_${partName}`;
      if (!activeWindows.has(windowId) && activeWindows.size < MAX_WINDOWS) {
        if (createOrUpdateWindow(windowId, partData, getPartSize(partName).width, getPartSize(partName).height)) {
          activeWindows.set(windowId, currentTime);
        }
      }
    }
  }, 100); // Уменьшим интервал для более плавного обновления
}

function getPartSize(partName) {
  const sizes = {
    leftEyebrow: { width: 120, height: 50 },   // Уменьшили высоту
    rightEyebrow: { width: 120, height: 50 },
    leftEye: { width: 120, height: 70 },       // Стандартизировали размеры глаз
    rightEye: { width: 120, height: 70 },
    nose: { width: 100, height: 120 },         // Оптимизировали высоту
    mouth: { width: 200, height: 70 }          // Расширили для лучшего покрытия
  };
  return sizes[partName] || { width: 100, height: 100 };
}