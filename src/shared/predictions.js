// predictions.js

const PredictionsPage = (() => {

  const state = {
    currentUser: null,
    lastPrediction: null,
    lastCausalEffect: null,
    lastCausalConfidence: null
  };

  let dom = {};

  function resolveDOM() {
    dom = {
      authLock:         document.getElementById('authLockSection'),
      activeInterface:  document.getElementById('activeInterfaceSection'),
      
      // Predict form
      predictForm:      document.getElementById('predictiveForm'),
      pBuildingId:      document.getElementById('pBuildingId'),
      pMeter:           document.getElementById('pMeter'),
      pSiteId:          document.getElementById('pSiteId'),
      pAirTemp:         document.getElementById('pAirTemp'),
      pDewTemp:         document.getElementById('pDewTemp'),
      pCloudCoverage:   document.getElementById('pCloudCoverage'),
      pPrecip:          document.getElementById('pPrecip'),
      pPressure:        document.getElementById('pPressure'),
      pWindDir:         document.getElementById('pWindDir'),
      pWindSpeed:       document.getElementById('pWindSpeed'),
      predictBtn:       document.getElementById('predictBtn'),
      
      // Causal form
      causalForm:       document.getElementById('causalForm'),
      cBuildingId:      document.getElementById('cBuildingId'),
      cMeter:           document.getElementById('cMeter'),
      cAirTemp:         document.getElementById('cAirTemp'),
      cDewTemp:         document.getElementById('cDewTemp'),
      cWindSpeed:       document.getElementById('cWindSpeed'),
      causalBtn:        document.getElementById('causalBtn'),
      
      // Sliders label badges
      lblAirTemp:       document.getElementById('lblAirTemp'),
      lblDewTemp:       document.getElementById('lblDewTemp'),
      lblCloud:         document.getElementById('lblCloud'),
      lblPrecip:        document.getElementById('lblPrecip'),
      lblPressure:      document.getElementById('lblPressure'),
      lblWindDir:       document.getElementById('lblWindDir'),
      lblWindSpeed:     document.getElementById('lblWindSpeed'),
      
      lblCAirTemp:      document.getElementById('lblCAirTemp'),
      lblCDewTemp:      document.getElementById('lblCDewTemp'),
      lblCWindSpeed:    document.getElementById('lblCWindSpeed'),
      
      // Outputs
      predictVal:       document.getElementById('predictVal'),
      predictTime:      document.getElementById('predictTime'),
      
      causalVal:        document.getElementById('causalVal'),
      causalMahal:      document.getElementById('causalMahal'),
      causalConf:       document.getElementById('causalConf'),
      
      recCard:          document.getElementById('recResultCard'),
      recText:          document.getElementById('recText')
    };
  }

  async function init() {
    resolveDOM();
    
    // Auth Check
    try {
      state.currentUser = await CampusEnergyAPI.getCurrentUser();
    } catch {
      state.currentUser = null;
    }

    if (!state.currentUser) {
      dom.authLock.style.display = 'block';
      dom.activeInterface.style.display = 'none';
      return;
    }

    dom.authLock.style.display = 'none';
    dom.activeInterface.style.display = 'block';

    bindSliderUpdates();
    bindEvents();
  }

  function bindSliderUpdates() {
    // Prediction Form Sliders
    dom.pAirTemp.addEventListener('input', () => { dom.lblAirTemp.textContent = parseFloat(dom.pAirTemp.value).toFixed(1) + '°C'; });
    dom.pDewTemp.addEventListener('input', () => { dom.lblDewTemp.textContent = parseFloat(dom.pDewTemp.value).toFixed(1) + '°C'; });
    dom.pCloudCoverage.addEventListener('input', () => { dom.lblCloud.textContent = dom.pCloudCoverage.value + '/8'; });
    dom.pPrecip.addEventListener('input', () => { dom.lblPrecip.textContent = parseFloat(dom.pPrecip.value).toFixed(1) + ' mm'; });
    dom.pPressure.addEventListener('input', () => { dom.lblPressure.textContent = parseFloat(dom.pPressure.value).toFixed(1) + ' hPa'; });
    dom.pWindDir.addEventListener('input', () => { dom.lblWindDir.textContent = dom.pWindDir.value + '°'; });
    dom.pWindSpeed.addEventListener('input', () => { dom.lblWindSpeed.textContent = parseFloat(dom.pWindSpeed.value).toFixed(1) + ' m/s'; });

    // Causal Form Sliders
    dom.cAirTemp.addEventListener('input', () => { dom.lblCAirTemp.textContent = parseFloat(dom.cAirTemp.value).toFixed(1) + '°C'; });
    dom.cDewTemp.addEventListener('input', () => { dom.lblCDewTemp.textContent = parseFloat(dom.cDewTemp.value).toFixed(1) + '°C'; });
    dom.cWindSpeed.addEventListener('input', () => { dom.lblCWindSpeed.textContent = parseFloat(dom.cWindSpeed.value).toFixed(1) + ' m/s'; });
  }

  function bindEvents() {
    dom.predictForm.addEventListener('submit', handlePredictSubmit);
    dom.causalForm.addEventListener('submit', handleCausalSubmit);
  }

  async function handlePredictSubmit(e) {
    e.preventDefault();
    CE.setButtonLoading(dom.predictBtn, true);

    const payload = {
      building_id: parseInt(dom.pBuildingId.value),
      meter: parseInt(dom.pMeter.value),
      site_id: parseInt(dom.pSiteId.value),
      air_temperature: parseFloat(dom.pAirTemp.value),
      cloud_coverage: parseFloat(dom.pCloudCoverage.value),
      dew_temperature: parseFloat(dom.pDewTemp.value),
      precip_depth_1_hr: parseFloat(dom.pPrecip.value),
      sea_level_pressure: parseFloat(dom.pPressure.value),
      wind_direction: parseFloat(dom.pWindDir.value),
      wind_speed: parseFloat(dom.pWindSpeed.value)
    };

    const startTime = performance.now();
    try {
      const res = await CampusEnergyAPI.predict(payload);
      const elapsed = Math.round(performance.now() - startTime);

      state.lastPrediction = res.prediction;
      dom.predictVal.textContent = res.prediction.toFixed(2);
      dom.predictTime.textContent = elapsed + ' ms';
      
      CE.toast('Prediction completed successfully!', 'success');
      checkRunRecommendation();
    } catch (err) {
      CE.toast(err.message || 'Prediction failed.', 'error');
    } finally {
      CE.setButtonLoading(dom.predictBtn, false);
    }
  }

  async function handleCausalSubmit(e) {
    e.preventDefault();
    CE.setButtonLoading(dom.causalBtn, true);

    const payload = {
      building_id: parseInt(dom.cBuildingId.value),
      meter: parseFloat(dom.cMeter.value),
      air_temperature: parseFloat(dom.cAirTemp.value),
      dew_temperature: parseFloat(dom.cDewTemp.value),
      wind_speed: parseFloat(dom.cWindSpeed.value)
    };

    try {
      const res = await CampusEnergyAPI.causalPredict(payload);

      state.lastCausalEffect = res.causal_prediction;
      state.lastCausalConfidence = res.confidence || 0.95;

      dom.causalVal.textContent = res.causal_prediction ? res.causal_prediction.toFixed(2) : '--';
      dom.causalMahal.textContent = res.mahalanobis_distance ? res.mahalanobis_distance.toFixed(3) : 'N/A';
      dom.causalConf.textContent = (state.lastCausalConfidence * 100).toFixed(1) + '%';

      CE.toast('Causal effect estimated successfully!', 'success');
      checkRunRecommendation();
    } catch (err) {
      CE.toast(err.message || 'Causal calculation failed.', 'error');
    } finally {
      CE.setButtonLoading(dom.causalBtn, false);
    }
  }

  async function checkRunRecommendation() {
    if (state.lastPrediction === null || state.lastCausalEffect === null) return;
    
    dom.recCard.style.display = 'block';
    dom.recText.textContent = 'Analyzing metrics and generating smart recommendation...';

    const payload = {
      prediction: state.lastPrediction,
      causal_effect: state.lastCausalEffect,
      confidence: state.lastCausalConfidence || 0.95,
      retrieved_docs: [
        "ASHRAE Standard 55-2020: Thermal Environmental Conditions for Human Occupancy.",
        "Campus Building Climate Policy (2025 rev): Recommends temperature settings of 21-23°C for energy optimization."
      ]
    };

    try {
      const res = await CampusEnergyAPI.recommend(payload);
      dom.recText.innerHTML = `<strong>Smart Advisor recommendation:</strong> ${res.recommendation}`;
    } catch (err) {
      dom.recText.textContent = 'Recommendation engine failed: ' + err.message;
    }
  }

  return { init };
})();

CE.initAll({ topbar: { active: 'predictions' }, onReady: PredictionsPage.init });
