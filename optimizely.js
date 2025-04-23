setTimeout(function () {
  if (!document.querySelector('script[src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"]')) {
    const gptScript = document.createElement('script')
    gptScript.async = true
    gptScript.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
    document.head.appendChild(gptScript)
  }

  const gptInitScript = document.createElement('script')
  gptInitScript.innerHTML = `
    window.googletag = window.googletag || { cmd: [] };
    var bannerSlot300x600;
    googletag.cmd.push(function () {
      bannerSlot300x600 = googletag
        .defineSlot(
          '/22921845643/SZ_Games_Right_Sidebar_300x600',
          [
            [160, 600],
            [120, 600],
            [300, 250],
            [300, 300],
            [300, 600],
          ],
          'div-gpt-ad-1744674311666-0'
        )
        .addService(googletag.pubads());

      googletag.pubads().enableSingleRequest();
      googletag.enableServices();

      setInterval(function () {
        googletag.pubads().refresh([bannerSlot300x600]);
      }, 30000);
    });
  `
  document.head.appendChild(gptInitScript)

  const sidebarElement = document.querySelector('.sidebar')
  if (sidebarElement) {
    const adSenseElement = sidebarElement.querySelector('.adsbygoogle')
    const adSenseScript = adSenseElement?.nextElementSibling

    if (adSenseElement) {
      adSenseElement.remove()
    }
    if (adSenseScript && adSenseScript.tagName === 'SCRIPT') {
      adSenseScript.remove()
    }

    const gptAdElement = document.createElement('div')
    gptAdElement.id = 'div-gpt-ad-1744674311666-0'
    gptAdElement.style.minWidth = '300px'
    gptAdElement.style.minHeight = '600px'

    const gptScript = document.createElement('script')
    gptScript.innerHTML = `
      googletag.cmd.push(function () {
        googletag.display(bannerSlot300x600);
      });
    `

    gptAdElement.appendChild(gptScript)
    sidebarElement.insertBefore(gptAdElement, sidebarElement.firstChild)
  }
}, 30000)
