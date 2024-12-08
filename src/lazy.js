const obs = new OBSWebSocket();

var streamingStatus = false;
var currentScene = '';

window.addEventListener('onWidgetLoad', function (obj) {
  fieldData = obj.detail.fieldData;
  // A complete example
try {
  const {
    obsWebSocketVersion,
    negotiatedRpcVersion
  } = obs.connect('ws://127.0.0.1:4455', undefined, {
    rpcVersion: 1
  });
  console.log(`Connected to server ${obsWebSocketVersion} (using RPC ${negotiatedRpcVersion})`);
} catch (error) {
  console.error('Failed to connect ',error.code, error.message);
}

  setInterval(function() {
    getStats(fieldData);
  }, 1000);
  
});



function setScene(scene) {
  if (streamingStatus == false || scene == currentScene) {
    return;
  }
  await obs.call('SetCurrentProgramScene', {sceneName: scene});
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
  window.obsstudio.getCurrentScene(function(scene) {
    //document.querySelector("#pseudolog").innerHTML(scene)
    currentScene = scene.name;
  });
  window.obsstudio.getStatus(function (status) {
    // use status.recording for testing
    streamingStatus = status.streaming || status.recording;
  });
    document.querySelector("#pseudolog").innerHTML = `${streamingStatus} ${currentScene}`;

  try {
    const response = await fetchWithTimeout(`https://${fieldData.ingestHost}/stats?publisher=${fieldData.srtPublisher}`, {
      timeout: 2000
    });
    const ingest = await response.json();
    if (ingest.status === "error" && currentScene !== fieldData.starting && currentScene !== fieldData.privacy) {
      document.querySelector("#bitbox").innerHTML = "offline";
    } else if (streamingStatus) {
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
