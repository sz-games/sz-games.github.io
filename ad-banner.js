;(function () {
  'use strict'

  // Check if GPT is already loaded
  let gptLoaded = !!window.googletag

  // Get ad slot from script tag data attribute
  const currentScript =
    document.currentScript ||
    (() => {
      const scripts = document.getElementsByTagName('script')
      return scripts[scripts.length - 1]
    })()

  const adSlot = currentScript.getAttribute('data-slot')

  if (!adSlot) {
    console.error('Ad banner script requires data-slot attribute')
    return
  }

  let bannerContainer = null
  let adTimeout = null

  // Generate random ID for ad unit
  function generateRandomId() {
    return 'div-gpt-ad-' + Date.now() + '-' + Math.floor(Math.random() * 1000000)
  }

  // Inject GPT scripts if not already loaded
  function injectGPTScripts() {
    if (gptLoaded) return Promise.resolve()

    return new Promise((resolve) => {
      // Load GPT library
      const gptScript = document.createElement('script')
      gptScript.async = true
      gptScript.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
      gptScript.crossOrigin = 'anonymous'
      document.head.appendChild(gptScript)

      // Initialize GPT
      const initScript = document.createElement('script')
      initScript.textContent = `
        window.googletag = window.googletag || {cmd: []};
        googletag.cmd.push(function() {
          googletag.pubads().enableSingleRequest();
          googletag.enableServices();
        });
      `
      document.head.appendChild(initScript)

      gptLoaded = true
      resolve()
    })
  }

  // Create and show ad banner
  function createAdBanner() {
    const adId = generateRandomId()

    // Create container
    bannerContainer = document.createElement('div')
    bannerContainer.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 10px;
      width: 300px;
      height: 250px;
      z-index: 99999999999;
      background: transparent;
    `

    // Create close button
    const closeButton = document.createElement('button')
    closeButton.innerHTML = '×'
    closeButton.style.cssText = `
      position: absolute;
      top: -10px;
      right: -10px;
      background: #ffffff;
      border: 1px solid #ccc;
      border-radius: 50%;
      font-size: 20px;
      font-weight: bold;
      color: #666;
      cursor: pointer;
      z-index: 999999999999;
      line-height: 1;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    `

    closeButton.addEventListener('click', closeAndRecreate)

    // Create ad div
    const adDiv = document.createElement('div')
    adDiv.id = adId
    adDiv.style.cssText = 'min-width: 300px; min-height: 250px;'

    bannerContainer.appendChild(closeButton)
    bannerContainer.appendChild(adDiv)
    document.body.appendChild(bannerContainer)

    // Define and display the ad
    window.googletag.cmd.push(function () {
      googletag.defineSlot(adSlot, [300, 250], adId).addService(googletag.pubads())
      googletag.display(adId)
    })
  }

  // Close current banner and create new one after 10 seconds
  function closeAndRecreate() {
    if (bannerContainer) {
      bannerContainer.remove()
      bannerContainer = null
    }

    // Clear any existing timeout
    if (adTimeout) {
      clearTimeout(adTimeout)
    }

    // Create new banner after 10 seconds
    adTimeout = setTimeout(() => {
      createAdBanner()
    }, 10000)
  }

  // Initialize the ad banner system
  function init() {
    injectGPTScripts().then(() => {
      // Wait a bit for GPT to be ready, then create the first banner
      setTimeout(createAdBanner, 500)
    })
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
