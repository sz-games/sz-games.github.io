console.log('Script.js loaded')
// ==========================================================================
// Global Variables
// ==========================================================================
var ToggledMenu3 = false
var Isscrolledf = false
var PageHasLoaded = false // Note: This seems to be set to false and never used as true
var preloaded = false
var selectedCategory = 'No Filter'
var usingLoad = false // Note: Seems related to an incomplete function
var setscreen = false // Note: Set to false, might be for temporary disabling
var isMENU = false

// ==========================================================================
// DOM Element References (Consider grouping these if they grow)
// ==========================================================================
const imageContainer = document.getElementById('games')
const images = imageContainer.getElementsByTagName('img')
const container = document.getElementById('games') // Duplicate of imageContainer?
const boxes = document.querySelectorAll('.box')
var input = document.getElementById('SearchBox')
var elements = document.getElementById('games').getElementsByTagName('div') // Duplicate or more specific than elements?
var noMatches = document.getElementById('nonefound')

// ==========================================================================
// Utility Functions
// ==========================================================================

function debounce(func, delay) {
  let debounceTimer
  return function () {
    const context = this
    const args = arguments
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => func.apply(context, args), delay)
  }
}

function levenshteinDistance(a, b) {
  var matrix = []
  var i, j

  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1))
      }
    }
  }

  return matrix[b.length][a.length]
}

function isElementInViewport(element) {
  const rect = element.getBoundingClientRect()
  return (
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight + 400 || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

function isElementNotInViewport(element) {
  const rect = element.getBoundingClientRect()
  return (
    rect.bottom < 0 ||
    rect.top > (window.innerHeight + 400 || document.documentElement.clientHeight) ||
    rect.right < 0 ||
    rect.left > (window.innerWidth || document.documentElement.clientWidth)
  )
}

function getCookie(cname) {
  let name = cname + '='
  let decodedCookie = decodeURIComponent(document.cookie)
  let ca = decodedCookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) == ' ') {
      c = c.substring(1)
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length)
    }
  }
  return ''
}

function setCookie(cname, cvalue, exdays) {
  const d = new Date()
  d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000)
  let expires = 'expires=' + d.toUTCString()
  document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/'
}

// ==========================================================================
// UI Interaction Functions (Menus, Notifications, Scroll)
// ==========================================================================

function ToggleMenuBig() {
  if (ToggledMenu3 === false) {
    document.getElementById('SideMenuBigScreen').style.display = 'block'
    document.getElementById('SideMenuBigScreen').style.opacity = 1

    document.getElementById('MMenuBig').style.display = 'block'
    document.getElementById('MMenuBig').classList.add('SlSlideIn')

    setTimeout(() => {
      document.getElementById('MMenuBig').classList.remove('SlSlideIn')
      ToggledMenu3 = true
    }, 500)
  } else if (ToggledMenu3 === true) {
    ToggledMenu3 = false

    document.getElementById('SideMenuBigScreen').style.opacity = 0
    document.getElementById('MMenuBig').classList.add('SlSlide')

    setTimeout(() => {
      document.getElementById('MMenuBig').classList.remove('SlSlide')
      document.getElementById('MMenuBig').style.display = 'none'
      document.getElementById('SideMenuBigScreen').style.display = 'none'
    }, 500)
  }
}

function toggleMENU107() {
  var menuElement = document.getElementById('MENU107')
  if (isMENU === false) {
    // Fade in
    menuElement.style.visibility = 'visible'
    menuElement.style.opacity = 1
    isMENU = true
  } else if (isMENU === true) {
    // Fade out
    menuElement.style.opacity = 0
    setTimeout(() => {
      menuElement.style.visibility = 'hidden'
    }, 500) // Match transition duration
    isMENU = false
  }
  // Reset iframe src (consider if this should always happen on toggle)
  document.getElementById('URLIFRAME').src = './index.html'
}

function updateScrollButtonVisibility() {
  const scrollButton = document.getElementById('SCROLLUP')
  if (window.pageYOffset > 350) {
    if (Isscrolledf === false) {
      scrollButton.style.display = 'block'
      // Trigger reflow before changing opacity/transform for transition
      scrollButton.offsetHeight
      scrollButton.style.opacity = 1
      scrollButton.style.transform = 'scale(1.0)'
      Isscrolledf = true
    }
  } else {
    if (Isscrolledf === true) {
      scrollButton.style.transform = 'scale(0.3)'
      scrollButton.style.opacity = 0
      setTimeout(() => {
        scrollButton.style.display = 'none'
      }, 500) // Match transition duration
      Isscrolledf = false
    }
  }
}

// ==========================================================================
// Image Loading & Handling
// ==========================================================================

// Function to load all images immediately (e.g., for search activation)
function searchHandleLoad() {
  if (preloaded) {
    console.log('Already Loaded')
    return
  }

  const hiddenDivs = document.querySelectorAll('.box')
  const lazyImages = document.querySelectorAll('.ImageForGame')

  lazyImages.forEach((image) => loadImageWithRetries(image, true)) // Force load immediate=true
  hiddenDivs.forEach((div) => div.classList.add('show'))

  console.log('Loaded all images due to search/interaction.')
  preloaded = true
}

// Handles lazy loading on scroll
function handleScroll() {
  // This check for PageHasLoaded seems reversed? Usually you load *after* page load.
  // If canLoadImages logic is complex, it should be defined elsewhere. Assuming true for now.
  // if (PageHasLoaded === false) { // Or maybe check !PageHasLoaded?
  //   canLoadImages = true; // Where is canLoadImages defined? Assuming global for now.
  // }

  if (preloaded) return // Don't lazy load if everything is already loaded

  const hiddenDivs = document.querySelectorAll('.box')
  const lazyImages = document.querySelectorAll('.ImageForGame')

  lazyImages.forEach((image) => {
    if (isElementInViewport(image) && !image.src) {
      loadImageWithRetries(image)
    }
  })

  hiddenDivs.forEach((div) => {
    if (isElementInViewport(div)) {
      div.classList.add('show')
    }
    // Note: Removed the 'else if (isElementNotInViewport(div))' block
    // as removing the 'show' class might cause unwanted hiding when scrolling quickly.
    // Consider if elements should *stay* visible once loaded.
  })
}

// Refactored image loading logic with retries
function loadImageWithRetries(image, immediate = false) {
  let retries = 0
  const maxRetries = 3
  const src = image.getAttribute('data-src')

  if (!src || image.src) return // No data-src or already loaded

  function attemptLoad() {
    image.src = src

    image.onload = () => {
      image.classList.add('showIMG')
      // console.log(`Loaded: ${src}`);
      retries = 0 // Reset on success
    }

    image.onerror = () => {
      retries++
      console.warn(`Failed to load image: ${src}, attempt ${retries}`)
      if (retries < maxRetries) {
        // Optional: Add a small delay before retrying
        setTimeout(attemptLoad, 500) // Retry after 500ms
      } else {
        console.error(`Max retries reached for image: ${src}. Using fallback.`)
        image.classList.add('showIMG') // Show fallback container
        image.src = './fallback.png' // Ensure fallback exists
      }
    }
  }

  if (immediate || isElementInViewport(image)) {
    attemptLoad()
  }
}

// ==========================================================================
// Filtering Logic
// ==========================================================================

function filterByCategory(category) {
  const gameElements = document.querySelectorAll('.game-card')
  let found = false

  gameElements.forEach((element) => {
    const categoryAttr = element.getAttribute('category')

    if (!categoryAttr) return

    if (category === 'No Filter' || categoryAttr.toUpperCase().includes(category.toUpperCase())) {
      element.style.display = ''
      found = true
    } else {
      element.style.display = 'none'
    }
  })

  // Show a message if no games match the current filter
  const noMatchesElement = document.getElementById('nonefound')
  if (noMatchesElement) {
    noMatchesElement.style.display = found ? 'none' : 'block'
  }
}

function handleRadioChange(event) {
  const selectedOption = event.target
  // Find the associated label to get the category text
  const label = document.querySelector(`label[for="${selectedOption.id}"]`)
  if (!label) {
    console.error('Could not find label for radio button:', selectedOption.id)
    return
  }
  const category = label.getAttribute('data-txt')

  console.log(`Selected category: ${category}`)

  if (selectedOption.id === 'all') {
    // Assuming 'all' is the ID for "No Filter"
    filterByCategory('No Filter')
  } else {
    filterByCategory(category)
  }
}

// ==========================================================================
// Search Logic
// ==========================================================================

function Search() {
  const searchInput = document.getElementById('SearchBox')
  if (!searchInput) return

  searchInput.addEventListener(
    'input',
    debounce(function () {
      const filter = searchInput.value.trim().toUpperCase()
      const gameElements = document.querySelectorAll('.game-card')
      let found = false

      // Fun easter egg
      if (searchInput.value.toLowerCase() === 'hawk tuah') {
        gameElements.forEach((element) => {
          const img = element.querySelector('img')
          if (img) img.src = './hawkt.gif'
        })
      }

      // Filter the games
      if (filter.length > 0) {
        gameElements.forEach((element) => {
          const id = element.id || ''
          const title = element.querySelector('h3')?.textContent || ''

          if (id.toUpperCase().includes(filter) || title.toUpperCase().includes(filter)) {
            element.style.display = ''
            found = true
          } else {
            element.style.display = 'none'
          }
        })
      } else {
        // If search is empty, show all games
        gameElements.forEach((element) => {
          element.style.display = ''
        })
        found = true
      }

      // Show no matches message if needed
      const noMatchesElement = document.getElementById('nonefound')
      if (noMatchesElement) {
        noMatchesElement.style.display = found ? 'none' : 'block'
      }
    }, 300)
  )
}

// ==========================================================================
// Game Logic (Random, Loading - Incomplete)
// ==========================================================================

function randomGamelol() {
  const gameCards = document.querySelectorAll('.game-card')

  if (gameCards.length > 0) {
    const randomIndex = Math.floor(Math.random() * gameCards.length)
    const randomGame = gameCards[randomIndex]
    const gameLink = randomGame.querySelector('a')

    if (gameLink && gameLink.href) {
      window.location.href = gameLink.href
    }
  }
}

// Incomplete function - Placeholder
function loadGame() {
  if (usingLoad === true) {
    // Logic for loading a specific game? Needs implementation.
    console.log('loadGame function called but is incomplete.')
  }
}

// ==========================================================================
// Game Rendering
// ==========================================================================
function renderGames(gamesArray) {
  console.log('renderGames', gamesArray)
  const gamesContainer = document.getElementById('games')
  if (!gamesContainer) {
    console.error('Game container #games not found.')
    return
  }

  gamesContainer.innerHTML = '' // Clear existing content

  gamesArray.forEach((game) => {
    // Use the new game card creator function
    const gameCard = createGameElement({
      id: game.id,
      title: game.name,
      url: game.url,
      imgSrc: game.imgSrc,
      categories: game.categories,
      isPopular: game.isPopular || false,
    })

    gamesContainer.appendChild(gameCard)
  })

  // After rendering, check for initially visible games
  handleScroll()
  console.log('Games rendered successfully.')
}

// ==========================================================================
// Initialization and Event Listeners
// ==========================================================================

// Initial setup based on 'setscreen' flag (likely for maintenance mode)
if (setscreen === true) {
  const bgVid = document.getElementById('BGVIDSOM1')
  if (bgVid) {
    bgVid.src = 'https://sz-games.github.io/BGVIDLOW.mp4' // Consider preloading this?
  }
  const maintenanceScreen = document.getElementById('WeWillBeBackScreen')
  if (maintenanceScreen) {
    maintenanceScreen.style.display = 'block'
  }
  document.body.style.overflowX = 'hidden' // Prevent horizontal scroll during maintenance
  console.warn('Site is potentially in maintenance mode (setscreen=true).')
}

// Set IFrame height based on window size
function adjustIframeHeight() {
  const iframe = document.getElementById('URLIFRAME')
  if (iframe) {
    iframe.style.height = window.innerHeight - 200 + 'px' // Adjust 200 based on surrounding UI
  }
}

// Scroll Button Click Listener
document.getElementById('SCROLLUP')?.addEventListener('click', () => {
  window.scroll({ top: 0, left: 0, behavior: 'smooth' })
})

// Scroll Event Listener (for scroll-to-top button visibility and lazy loading)
window.addEventListener('scroll', () => {
  updateScrollButtonVisibility()
  handleScroll() // Trigger lazy loading check on scroll
})

// Filter Radio Button Listeners
const radioButtons = document.querySelectorAll('.options input[type="radio"]')
radioButtons.forEach((radio) => {
  radio.addEventListener('change', handleRadioChange)
})

// Initialize Search Functionality
Search() // Sets up the input listener

// Initial call to handle elements visible on load
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Loaded. Initializing...')
  adjustIframeHeight()

  // Check if gamesData exists (it should if games.js loaded correctly)
  if (typeof gamesData !== 'undefined' && Array.isArray(gamesData)) {
    renderGames(gamesData)
  } else {
    console.error('gamesData is not available. Ensure games.js is loaded before script.js and gamesData is defined.')
  }

  updateScrollButtonVisibility() // Set initial state of scroll button

  // Example: Check for a cookie on load
  let userPref = getCookie('userPreference')
  if (userPref) {
    console.log('User preference found:', userPref)
    // Apply preference if needed
  } else {
    console.log('No user preference cookie found.')
    // Maybe set a default cookie?
    // setCookie("userPreference", "default", 30);
  }
})

// Window Load Listener (Consider if needed beyond DOMContentLoaded)
window.addEventListener('load', () => {
  // PageHasLoaded logic seems unused/incorrectly implemented, removing for now.
  // Original: if ((PageHasLoaded = false)) { ... } - This assigns false, then checks truthiness (always false)
  console.log('Window fully loaded (images, etc.).')
  // If there are actions that *must* wait for all images, put them here.
  // handleScroll(); // Already called on DOMContentLoaded, usually sufficient.
})

// Window Resize Listener (Example: Adjust layout elements like iframe)
window.addEventListener('resize', debounce(adjustIframeHeight, 250)) // Debounced adjustment

console.log('SZ Games Script Initialized (vX.Y)') // Add a version/log marker

// Update the category filter for our new chip-style categories
document.addEventListener('DOMContentLoaded', function () {
  const categoryChips = document.querySelectorAll('.category-chip')

  categoryChips.forEach((chip) => {
    chip.addEventListener('click', function () {
      // Remove active class from all chips
      categoryChips.forEach((c) => c.classList.remove('active'))

      // Add active class to clicked chip
      this.classList.add('active')

      // Get category value from data attribute
      const category = this.getAttribute('data-category')

      // Apply filter
      filterByCategory(category)
    })
  })
})

// Create a game card element with Roblox-style design
function createGameElement(game) {
  const gameElement = document.createElement('div')
  gameElement.className = 'game-card'
  gameElement.id = game.id || game.title.toLowerCase().replace(/\s+/g, '-')

  if (game.categories) {
    gameElement.setAttribute('category', Array.isArray(game.categories) ? game.categories.join(' ') : game.categories)
  }

  const gameLink = document.createElement('a')
  gameLink.href = game.url

  // Create thumbnail container
  const thumbnailContainer = document.createElement('div')
  thumbnailContainer.className = 'thumbnail-container'

  // Create image
  const gameImg = document.createElement('img')
  gameImg.src = game.thumbnailUrl || game.imgSrc
  gameImg.alt = game.title || game.name

  // Add image to thumbnail container
  thumbnailContainer.appendChild(gameImg)

  // Create info section
  const gameInfo = document.createElement('div')
  gameInfo.className = 'game-info'

  // Create title
  const gameTitle = document.createElement('h3')
  gameTitle.textContent = game.title || game.name
  gameInfo.appendChild(gameTitle)

  // Add all elements to the link
  gameLink.appendChild(thumbnailContainer)
  gameLink.appendChild(gameInfo)
  gameElement.appendChild(gameLink)

  return gameElement
}

// Filter by category function - updated to work with new card structure
function filterByCategory(category) {
  const gameElements = document.querySelectorAll('.game-card')
  let found = false

  gameElements.forEach((element) => {
    const categoryAttr = element.getAttribute('category')

    if (!categoryAttr) return

    if (category === 'No Filter' || categoryAttr.toUpperCase().includes(category.toUpperCase())) {
      element.style.display = ''
      found = true
    } else {
      element.style.display = 'none'
    }
  })

  // Show a message if no games match the current filter
  const noMatchesElement = document.getElementById('nonefound')
  if (noMatchesElement) {
    noMatchesElement.style.display = found ? 'none' : 'block'
  }
}

// Add mobile menu toggle functionality
document.addEventListener('DOMContentLoaded', function () {
  const menuToggle = document.querySelector('.mobile-menu-toggle')
  const sidebar = document.querySelector('.youtube-sidebar')

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', function () {
      sidebar.classList.toggle('show')
    })

    // Close sidebar when clicking outside of it
    document.addEventListener('click', function (event) {
      const isClickInside = sidebar.contains(event.target) || menuToggle.contains(event.target)

      if (!isClickInside && sidebar.classList.contains('show')) {
        sidebar.classList.remove('show')
      }
    })
  }
})

// Manage sticky header appearance on scroll
document.addEventListener('DOMContentLoaded', function () {
  const stickyHeader = document.querySelector('.sticky-header')

  if (stickyHeader) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 10) {
        stickyHeader.classList.add('scrolled')
      } else {
        stickyHeader.classList.remove('scrolled')
      }
    })

    // Check initial scroll position
    if (window.scrollY > 10) {
      stickyHeader.classList.add('scrolled')
    }
  }
})
