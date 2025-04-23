function getCookie(name) {
  const cookieName = name + '='
  const cookies = document.cookie.split(';')
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i]
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1)
    }
    if (cookie.indexOf(cookieName) === 0) {
      return cookie.substring(cookieName.length, cookie.length)
    }
  }
  return ''
}

//alert('hi')
let Setting14b = getCookie('PagePrevent')

function checkPageClose(event) {
  event.returnValue = 'Prevent Page Close Is Active, You Can Click Off Of This'
}
function checkPageClose2() {
  if (Setting14b === 'true') {
    window.onbeforeunload = function (event) {
      // return a string to prevent the page from closing
      event.preventDefault()
      return 'Prevent Page Close Is Active, You Can Click Off Of This'
    }
    window.addEventListener('beforeunload', checkPageClose)
  }
  if (Setting14b === 'false') {
  }
}
console.log('CookiePAGE Value: ' + Setting14b + 'SzGames-Scripts Loaded')
checkPageClose2()

//CLOAK

let tabData = {}
const tab = localStorage.getItem('tab')

if (tab) {
  try {
    tabData = JSON.parse(tab)
  } catch (e) {
    console.log('Error parsing tab data from localStorage', e)
  }
} else {
}

const settingsDefaultTab = {
  title: 'Settings - Sz Games',
  icon: 'https://github.com/sz-games/home/blob/main/G.png?raw=true',
}

const setTitle = (title = '') => {
  document.title = title || settingsDefaultTab.title
  if (title) {
    tabData.title = title
  } else {
    delete tabData.title
  }
  localStorage.setItem('tab', JSON.stringify(tabData))
}

const setFavicon = (url) => {
  const faviconLink = document.querySelector("link[rel='icon']")

  // Try to load the URL as an image
  const img = new Image()
  img.src = url
  img.onload = () => {
    faviconLink.href = url
    if (url) {
      tabData.icon = url
    } else {
      delete tabData.icon
    }
    localStorage.setItem('tab', JSON.stringify(tabData))
  }

  img.onerror = () => {
    // If the URL is not an image, use Google's Favicon API
    const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${url}`
    faviconLink.href = faviconUrl || settingsDefaultTab.icon
    if (url) {
      tabData.icon = faviconUrl
    } else {
      delete tabData.icon
    }
    localStorage.setItem('tab', JSON.stringify(tabData))
  }
}

const resetTab = () => {
  setTitle()
  setFavicon()

  localStorage.setItem('tab', JSON.stringify({}))
}

if (tabData.title) {
  document.title = tabData.title
}

if (tabData.icon) {
  const faviconLink = document.querySelector("link[rel='icon']")
  faviconLink.href = tabData.icon
}

//PANIC
let PANIC = localStorage.getItem('panic')

if (PANIC) {
  document.addEventListener('keydown', function (event) {
    if (event.key === '\\') {
      // Backslash key was pressed
      console.log('PANIC')
      window.location = PANIC
    }
  })
} else {
  console.log('clear')
}

function panicURL() {
  let URL3 = document.getElementById('url-target2').value

  if (URL3.includes('https://')) {
    localStorage.setItem('panic', URL3)

    PANIC = localStorage.getItem('panic')
  } else {
    localStorage.setItem('panic', 'https://' + URL3)

    PANIC = localStorage.getItem('panic')
  }
}

function clearPANIC() {
  localStorage.clear('panic')
  console.log('clear')
  PANIC = localStorage.getItem('panic')
}

// Security checks
const blacklistedDomains = ['szgames.net', 'szgames.github.io']

function checkDomainSecurity() {
  try {
    // Check if loaded in iframe
    if (window.top !== window.self) {
      const currentDomain = new URL(document.referrer).hostname
      if (blacklistedDomains.some((domain) => currentDomain.includes(domain))) {
        showSecurityWarning()
        return false
      }
    }
    return true
  } catch (error) {
    console.error('Error checking domain security:', error)
    return true // Allow access if check fails
  }
}

function showSecurityWarning() {
  document.body.innerHTML = ''
  const warning = document.createElement('h1')
  warning.textContent = 'You Are Accessing Sz Games From A Blacklisted Domain (A Fake Sz Games Site)'
  document.body.appendChild(warning)

  const button = document.createElement('button')
  button.textContent = 'Go To Sz Games'
  button.onclick = () => window.open('https://sz-games.github.io', '_blank')
  document.body.appendChild(button)
}

// Run security check on page load
document.addEventListener('DOMContentLoaded', checkDomainSecurity)

function restrictsmoothanimations() {
  const style = document.createElement('style')
  style.innerHTML = `
      * {
          animation: none !important;
          transition: none !important;
      }
  `
  document.head.appendChild(style)

  const stopAnimationsOnElement = (el) => {
    const computedStyle = getComputedStyle(el)
    if (computedStyle.animationName !== 'none') {
      el.style.animation = 'none'
    }
    if (computedStyle.transition !== 'all 0s ease 0s') {
      el.style.transition = 'none'
    }
  }

  // Apply to existing elements
  if (document.body) {
    document.querySelectorAll('*').forEach(stopAnimationsOnElement)
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            stopAnimationsOnElement(node)
            node.querySelectorAll('*').forEach(stopAnimationsOnElement)
          }
        })
      } else if (mutation.type === 'attributes' && mutation.target) {
        stopAnimationsOnElement(mutation.target)
      }
    })
  })

  // Only observe if body exists
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      attributes: true,
      subtree: true,
    })
  } else {
    // If body doesn't exist yet, wait for it
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('*').forEach(stopAnimationsOnElement)
      observer.observe(document.body, {
        childList: true,
        attributes: true,
        subtree: true,
      })
    })
  }

  document.addEventListener('animationstart', (e) => {
    e.target.style.animation = 'none'
  })

  document.addEventListener('transitionstart', (e) => {
    e.target.style.transition = 'none'
  })
}

let ResSmooAni = getCookie('RestrictSmooth')

function checkdissmooth() {
  if (ResSmooAni === 'true') {
    restrictsmoothanimations()
    console.log('Disabled Smooth Animations [✅]')
  }
  if (ResSmooAni === 'false') {
    console.log('Disabled Smooth Animations [❌]')
  }
}

checkdissmooth()

function performanceMode() {
  // Blocklist of domains to skip compression
  const blocklist = ['github.com']

  // Function to check if an image's domain is blocked
  const isBlockedDomain = (url) => {
    try {
      const parsedUrl = new URL(url)
      return blocklist.includes(parsedUrl.hostname)
    } catch (err) {
      console.error('Invalid URL:', url)
      return true // Treat invalid URLs as blocked
    }
  }

  // Function to compress an image
  const compressImage = (imageElement, quality = 0.3) => {
    // Skip if the image has already been compressed
    if (imageElement.dataset.compressed === 'true') {
      return
    }

    // Check if the image's domain is blocked
    if (isBlockedDomain(imageElement.src)) {
      console.warn('Skipping compression for blocked domain:', imageElement.src)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous' // Allow CORS if possible
    img.src = imageElement.src

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          const blobUrl = URL.createObjectURL(blob)
          imageElement.src = blobUrl // Replace the original image with the compressed version
          imageElement.dataset.compressed = 'true' // Mark as compressed
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      console.error('Failed to load image for compression:', imageElement.src)
    }
  }

  // Function to monitor images being added to the DOM and start compressing them
  const monitorImages = (quality = 0.3) => {
    // Use a MutationObserver to detect dynamically added `<img>` elements
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.tagName === 'IMG') {
            // Attach load event listener to dynamically added image
            node.addEventListener('load', () => compressImage(node, quality))
          }
        })
      })
    })

    // Start observing the body for newly added elements
    observer.observe(document.body, { childList: true, subtree: true })

    // Attach load event listeners to existing images
    document.querySelectorAll('img').forEach((img) => {
      if (img.complete) {
        // Compress already loaded images
        compressImage(img, quality)
      } else {
        // Attach load event listener to compress after they load
        img.addEventListener('load', () => compressImage(img, quality))
      }
    })
  }

  // Start monitoring images globally
  monitorImages(0.08) // Compress images to 50% quality
  ;(function removeFancyCSS() {
    // Create a new style element to override existing styles
    const style = document.createElement('style')
    style.innerHTML = `
                /* Reset all elements to minimal styling */
                * {
                    all: unset !important; /* Reset all inherited and applied styles */
                    box-sizing: border-box !important; /* Ensure consistent box-sizing */
                }
                
                body {
                    background: rgb(35, 35, 35);
                    

                    background-repeat: no-repeat;
                    background-size: cover;
                    background-attachment: fixed;
                    font-family: Arial, Helvetica, sans-serif;
                    overflow-x: hidden;

                  }

                a {
                    cursor: pointer !important;
                }
        
                img {
                }
        
                button, input, select, textarea {
                    font: inherit !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: 1px solid #ccc !important;
                    background: white !important;
                }
        
                table {
                    border-collapse: collapse !important;
                    width: 100% !important;
                }
                
                th, td {
                    border: 1px solid #ddd !important;
                    padding: 8px !important;
                }
            `

    // Append the style element to the document head
    document.head.appendChild(style)

    // Remove all existing stylesheets
    const stylesheets = document.querySelectorAll('style')
    stylesheets.forEach((sheet) => sheet.remove())

    const style2 = document.createElement('style')
    style2.innerHTML = `
              body {
                    background: rgb(35, 35, 35) !important;
                    
                  
                    font-family: Arial, Helvetica, sans-serif;
                    overflow-x: hidden;

                  }

                  #TopMenu {
                                border-radius: 0 !important;
                                box-shadow: none !important;

                  }
                  .featgameit {
                                border-radius: 0 !important;
                                box-shadow: none !important;
                  }

                  #TEST3 {
                                border-radius: 0 !important;
                                box-shadow: none !important;
                  }

                  input {
                    border-radius: 0 !important;
                                box-shadow: none !important;
                  }

                  a {
                  color: white !important; 
                    cursor: pointer !important;
                    }

                  .ImageForGame  {
                    width: 180px;
                    height: 180px;
                  }

            `
    document.head.appendChild(style2)

    console.log('Fancy CSS has been removed and replaced with minimal styles.')
  })()
}

let PerforM = getCookie('PerforMode')

function checkperform() {
  if (PerforM === 'true') {
    performanceMode()
    console.log('Performance Mode [✅]')
  }
  if (PerforM === 'false') {
    console.log('Performance Mode [❌]')
  }
}

checkperform()
