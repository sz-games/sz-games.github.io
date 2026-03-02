;(function () {
  console.log('DOMContentLoaded')
  const containerId = 'div-gpt-ad-1744679821427-0'
  const container = document.getElementById(containerId)
  const key = '5ee99841a6801f0f3742958ab80c87bb'
  const width = 728
  const height = 90

  if (!container) return

  let injected = false

  function injectAd() {
    if (injected) return
    injected = true

    container.innerHTML = '' // Clear existing content (remove AdX banner if present)
    container.style.width = `${width}px`
    container.style.height = `${height}px`

    const iframe = document.createElement('iframe')
    iframe.width = width
    iframe.height = height
    iframe.frameBorder = '0'
    iframe.scrolling = 'no'
    iframe.style.border = 'none'
    iframe.style.display = 'block'
    iframe.style.margin = '0 auto'
    iframe.style.padding = '0'

    const srcdoc = `
              <style>body { margin: 0; padding: 0; overflow: hidden; }</style>
              <script type='text/javascript'>
                atOptions = {
                  key: '${key}',
                  format: 'iframe',
                  height: ${height},
                  width: ${width},
                  params: {}
                };
              </script>
              <script type='text/javascript' src='https://cutleryneighbouringpurpose.com/${key}/invoke.js'></script>`

    iframe.srcdoc = srcdoc
    container.appendChild(iframe)
  }

  // Check after 3 seconds
  setTimeout(() => {
    // Check if an iframe exists inside the container or if it's collapsed
    const hasIframe = container.querySelector('iframe')
    const isCollapsed = container.offsetHeight === 0

    if (!hasIframe || isCollapsed) {
      console.log('No ad iframe found or collapsed, injecting fallback...')
      injectAd()
    }
  }, 3000)

  // Force inject after 10 seconds
  setTimeout(() => {
    injectAd()
  }, 10000)
})()
