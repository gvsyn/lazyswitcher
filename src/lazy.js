var streamingStatus = false;
var currentScene = '';
var antiflap = 0;

window.addEventListener('onWidgetLoad', function (obj) {
  fieldData = obj.detail.fieldData;

  setInterval(function() {
    getStats(fieldData);
  }, 1000);
    
});
/* NB these things WILL NOT work through streamelements
   but they will if the page is local, or say from the ingest server.
   This would need to be a first class citizen.
window.addEventListener('obsRecordingStarted', function(event) {
  console.log("RECORDING START");
  streamingStatus = true;
});
window.addEventListener('obsRecordingStopped', function(event) {
  console.log("RECORDING STOP");
  streamingStatus = false;
});
window.addEventListener('obsSceneChanged', function(event) {
  currentScene = event.detail.name;
  console.log(`SCENE CHANGE, IT SEEMS ${currentScene}`);
});
*/
function setScene(scene) {
  if (streamingStatus == false || scene == currentScene) {
    return;
  }
  window.obsstudio.setCurrentScene(scene);
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
    currentScene = scene.name.toString();
  });
  window.obsstudio.getStatus(function (status) {
    // use status.recording for testing
    streamingStatus = status.streaming || status.recording;
  });
//    document.querySelector("#pseudolog").innerHTML = `${streamingStatus} ${currentScene}`;
  try {
    const response = await fetchWithTimeout(`https://${fieldData.ingestHost}/stats?publisher=${fieldData.srtPublisher}`, {
      timeout: 2000
    });
    const ingest = await response.json();
	if (antiflap < 20) {
		antiflap++;
	}
	if (ingest.status === "error" && currentScene !== fieldData.starting && currentScene !== fieldData.privacy) {
      document.querySelector("#bitbox").innerHTML = "offline";
    } else if (streamingStatus) {
        if (ingest.bitrate >= 350 && ingest.rtt < 5000 && antiflap > 9) {
          antiflap = antiflap - 8;
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
