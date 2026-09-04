var ToggledMenu3 = false
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

function openLink() {
  window.open('https://discord.gg/DzKRSntb87', '_blank')
  localStorage.setItem('discordnotee', 'true')
}

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

if (isMobile) {
  document.getElementById('SETTINGSMENU1v').style.display = 'none'
} else {
  document.getElementById('SETTINGSMENU1v').style.display = 'block'
}

document.getElementById('TEST3').addEventListener('click', function () {
  searchHandleLoad()
  window.scroll({
    top: document.body.scrollHeight,
    left: 0,
    behavior: 'smooth',
  })
})
document.getElementById('SCROLLUP').addEventListener('click', function () {
  window.scroll({
    top: 0,
    left: 0,
    behavior: 'smooth',
  })
})

var Isscrolledf = false
window.addEventListener('scroll', function () {
  if (window.pageYOffset > 350) {
    if (Isscrolledf === false) {
      document.getElementById('SCROLLUP').style.display = 'block'
      document.getElementById('SCROLLUP').style.opacity = 1

      document.getElementById('SCROLLUP').style.transform = 'scale(1.0)'
      Isscrolledf = true
      //console.log("its false")
    } else {
      Isscrolledf = true
    }
  } else if (window.pageYOffset < 350) {
    if (Isscrolledf === true) {
      //console.log("its true")
      document.getElementById('SCROLLUP').style.transform = 'scale(0.3)'
      document.getElementById('SCROLLUP').style.opacity = 0
      setTimeout(() => {
        document.getElementById('SCROLLUP').style.display = 'none'
      }, 500)
      Isscrolledf = false
    } else {
      Isscrolledf = false
    }
  }
})

function randomGamelol() {
  const gameItems = document.querySelectorAll('#games .box')

  if (gameItems.length > 0) {
    const randomIndex = Math.floor(Math.random() * gameItems.length)

    const randomGame = gameItems[randomIndex]

    const anchorTag = randomGame.querySelector('a')

    const gameUrl = anchorTag.href

    window.location.href = gameUrl
  } else {
    console.error('No game items found in the #games container.')
  }
}

// Catalogue cards and their image URLs are delivered in the initial HTML. Native
// `loading="lazy"` defers only off-screen image bytes; it does not hide cards from
// crawlers, non-JavaScript users, or keyboard navigation.
function handleScroll() {
  document.querySelectorAll('.box').forEach((card) => card.classList.add('show'))
}

function searchHandleLoad() {
  // Kept for existing search/filter callers. Images no longer need JavaScript source
  // swapping, which previously made below-the-fold covers dependent on scrolling.
  handleScroll()
}

window.addEventListener('scroll', handleScroll)

document.addEventListener('DOMContentLoaded', handleScroll)

handleScroll()

///--------
var elements = document.getElementById('games').getElementsByTagName('div')
var selectedCategory = 'No Filter'

function filterByCategory(selected) {
  searchHandleLoad()
  selectedCategory = selected

  for (var i = 0, len = elements.length; i < len; i++) {
    var element = elements[i]
    var categories = element.getAttribute('data-category') || element.getAttribute('category')

    if (categories) {
      var categoryArray = categories.toUpperCase().split(' ')

      if (selectedCategory === 'No Filter') {
        element.style.display = ''
      } else {
        if (categoryArray.includes(selectedCategory.toUpperCase())) {
          element.style.display = ''
        } else {
          element.style.display = 'none'
        }
      }
    }
  }
}

function handleRadioChange(event) {
  const selectedOption = event.target
  const label = document.querySelector(`label[for="${selectedOption.id}"]`)
  const selectedCategory = label.getAttribute('data-txt')

  console.log(`Selected category: ${selectedCategory}`)

  if (selectedOption.id === 'all') {
    filterByCategory('No Filter')
  } else {
    filterByCategory(selectedCategory)
  }
}

const radioButtons = document.querySelectorAll('.options input[type="radio"]')
radioButtons.forEach((radio) => {
  radio.addEventListener('change', handleRadioChange)
})

//Search Below

var input = document.getElementById('SearchBox')
var elements = document.getElementById('games').getElementsByTagName('div')

var noMatches = document.getElementById('nonefound')

function Search() {
  searchHandleLoad()

  input.addEventListener(
    'input',
    debounce(function () {
      var filter = input.value.trim().toUpperCase().replace(/[-_]+/g, ' ')
      var found = false
      if (input.value.toLowerCase() === 'hawk tuah') {
        const hiddenDivs = document.querySelectorAll('.box')
        const lazyImages = document.querySelectorAll('.ImageForGame')
        lazyImages.forEach((image) => {
          image.src = './hawkt.gif'

          image.onload = function () {
            image.classList.add('showIMG')
          }

          image.onerror = function () {
            image.classList.add('showIMG')

            image.src = './fallback.png'
          }
        })
      }

      if (filter.length > 0) {
        for (var i = 0, len = elements.length; i < len; i++) {
          var element = elements[i]
          var id = element.getAttribute('id')

          if (id) {
            var idUpper = id.toUpperCase().replace(/[-_]+/g, ' ')
            var shouldExclude = element.classList.contains('textover')

            if (!shouldExclude) {
              if (isExactMatch(idUpper, filter) || isPartialMatch(idUpper, filter) || isSimilar(idUpper, filter)) {
                element.style.display = ''
                found = true
              } else {
                element.style.display = 'none'
              }
            }
          }
        }
      } else {
        //empty
        for (var i = 0, len = elements.length; i < len; i++) {
          if (!elements[i].classList.contains('textover')) {
            elements[i].style.display = 'block'
          }
        }
        found = true
      }

      if (!found) {
        noMatches.style.display = 'block'
      } else {
        noMatches.style.display = 'none'
      }
    }, 300)
  )
}

function isExactMatch(idUpper, filter) {
  return idUpper === filter || idUpper.startsWith(filter)
}

function isPartialMatch(idUpper, filter) {
  return idUpper.includes(filter)
}

function isSimilar(idUpper, filter) {
  return levenshteinDistance(idUpper, filter) <= 1
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

function debounce(func, delay) {
  let debounceTimer
  return function () {
    const context = this
    const args = arguments
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => func.apply(context, args), delay)
  }
}

var usingLoad = false

function loadGame() {
  if (usingLoad === true) {
  }
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

var isMENU = false

function toggleMENU107() {
  if (isMENU === false) {
    document.getElementById('MENU107').style.opacity = 0

    document.getElementById('MENU107').style.visibility = 'visible'
    document.getElementById('MENU107').style.opacity = 1
    isMENU = true
  } else if (isMENU === true) {
    document.getElementById('MENU107').style.opacity = 0
    setTimeout(() => {
      document.getElementById('MENU107').style.visibility = 'hidden'
    }, 500)
    isMENU = false
  }
  var ITEM890 = document.getElementById('MENU107SUB')

  document.getElementById('URLIFRAME').src = './index.html'
}
document.getElementById('URLIFRAME').style.height = window.innerHeight - 200 + 'px'

// --- propose.md cleanup: delegated click handlers (replaces inline onclick, same behavior) ---
function closeNotice(event) {
  if (event) {
    if (event.preventDefault) event.preventDefault()
    if (event.stopPropagation) event.stopPropagation()
  }
  var box = document.getElementById('noticeBoxWrapper') || document.getElementById('noticeBox')
  if (box) box.style.display = 'none'
  try {
    localStorage.setItem('discordnotee', 'true')
  } catch (e) {}
}

document.addEventListener('click', function (event) {
  var t = event.target.closest ? event.target.closest('[data-action]') : null
  if (!t) return
  var action = t.getAttribute('data-action')
  if (action === 'toggle-menu') ToggleMenuBig()
  else if (action === 'open-link') openLink()
  else if (action === 'close-notice') closeNotice(event)
  else if (action === 'toggle-iframe-menu') toggleMENU107()
  else if (action === 'random-game') randomGamelol()
  else if (action === 'open-settings') window.location = 'https://sz-games.github.io/settings.html'
})

// keyboard access for notice banner (role=link + tabindex added in HTML)
document.addEventListener('keydown', function (event) {
  if ((event.key === 'Enter' || event.key === ' ') && event.target && event.target.getAttribute) {
    if (event.target.getAttribute('data-action') === 'open-link') {
      event.preventDefault()
      openLink()
    }
  }
})
