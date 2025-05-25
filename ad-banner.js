;(function () {
  'use strict'

  let gptLoaded = !!window.googletag

  var mediumUnit

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

  function generateRandomId() {
    return 'div-gpt-ad-' + Date.now() + '-' + Math.floor(Math.random() * 1000000)
  }

  function injectGPTScripts() {
    if (gptLoaded) return Promise.resolve()

    return new Promise((resolve) => {
      const gptScript = document.createElement('script')
      gptScript.async = true
      gptScript.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
      gptScript.crossOrigin = 'anonymous'
      document.head.appendChild(gptScript)

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

  function createAdBanner() {
    const adId = generateRandomId()

    bannerContainer = document.createElement('div')
    bannerContainer.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 10px;
      width: 300px;
      height: 250px;
      z-index: 99999999999;
      background: transparent;
      transform: translateY(100%);
      transition: transform 0.3s ease-out;
    `

    const closeButton = document.createElement('button')
    closeButton.innerHTML = '×'
    closeButton.style.cssText = `
      position: absolute;
      top: -22px;
      right: 0;
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

    const adDiv = document.createElement('div')
    adDiv.id = adId
    adDiv.style.cssText = 'min-width: 300px; min-height: 250px;'

    bannerContainer.appendChild(closeButton)
    bannerContainer.appendChild(adDiv)
    document.body.appendChild(bannerContainer)

    setTimeout(() => {
      bannerContainer.style.transform = 'translateY(0)'
    }, 50)

    window.googletag.cmd.push(function () {
      mediumUnit = googletag.defineSlot(adSlot, [300, 250], adId)
      mediumUnit.addService(googletag.pubads())
    })

    window.googletag.cmd.push(function () {
      googletag.display(adId)
    })
  }

  function closeAndRecreate() {
    if (bannerContainer) {
      bannerContainer.style.transform = 'translateY(100%)'

      setTimeout(() => {
        if (bannerContainer) {
          bannerContainer.remove()
          bannerContainer = null
        }
      }, 300)
    }

    if (adTimeout) {
      clearTimeout(adTimeout)
    }

    adTimeout = setTimeout(() => {
      createAdBanner()
    }, 10000)
  }

  function init() {
    injectGPTScripts().then(() => {
      setTimeout(createAdBanner, 500)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
})()
