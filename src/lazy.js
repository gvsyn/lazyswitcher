const obs = new OBSWebSocket();

// Declare some events to listen for.
obs.on('ConnectionOpened', () => {
  console.log('Connection Opened');
});

obs.on('Identified', () => {
  console.log('Identified, good to go!')
});

obs.connect();

var streamingStatus = false;
var currentScene = '';

window.addEventListener('onWidgetLoad', function (obj) {
fieldData = obj.detail.fieldData;
	setInterval(function() {
		getStats(fieldData);
	}, 1000);
  
});

async function setScene(scene) {
  if (streamingStatus == false || scene == currentScene) {
    return;
  }
  await obs.call('SetCurrentProgramScene', {sceneName: scene});
}

async function getScene() {
	const {scene} = await obs.call('GetCurrentProgramScene');
	return scene;
}

async function getStreamOrRecordingStatus() {
	const streaming = await obs.call('GetStreamStatus');
	const recording = await obs.call('GetRecordStatus');
	return streaming.outputActive || recording.outputActive;
}

async function fetchWithTimeout(resource, options) {
  const { timeout = 2000 } = options;
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const response = await fetch(resource, {
    ...options,
    signal: controller.signal  
  });

  clearTimeout(id);
  return response;
}

async function getStats(fieldData) {
	currentSceneObj = await obs.call('GetCurrentProgramScene');
	currentScene = currentSceneObj.currentProgramSceneName;
	streamingStatus = await getStreamOrRecordingStatus();

  try {
    const response = await fetchWithTimeout(`https://${fieldData.ingestHost}/stats?publisher=${fieldData.srtPublisher}`, {
      timeout: 2000
    });
    const ingest = await response.json();
    if (ingest.status === "error" && currentScene !== fieldData.starting && currentScene !== fieldData.privacy) {
      document.querySelector("#bitbox").innerHTML = "offline";
    } else if (streamingStatus && (currentScene === fieldData.starting || currentScene === fieldData.brb || currentScene === fieldData.live)) {
        if (ingest.bitrate >= 350 && ingest.rtt < 5000) {
          setScene(fieldData.live);
        } else if (currentScene === fieldData.live) {
          setScene(fieldData.brb);
        }
    }
    document.querySelector("#bitbox").innerHTML = `${ingest.bitrate}k ${ingest.rtt.toFixed(0)}ms`;
  } catch (error) {
    document.querySelector("#bitbox").innerHTML = "offline";
    if (streamingStatus && currentScene === fieldData.live) {
      setScene(fieldData.brb);
    }
  }
}
