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

const imageContainer = document.getElementById('games')

const images = imageContainer.getElementsByTagName('img')

for (let i = 0; i < images.length; i++) {
  images[i].addEventListener('error', function () {
    console.log(`Image ${i + 1} failed to load!`)

    setTimeout(function () {
      images[i].src = images[i].src
    }, 3000)
  })
  console.log('code: 9B')
}

const container = document.getElementById('games')
const boxes = document.querySelectorAll('.box')

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
function errorimgshow() {
  var errormsgimg = document.getElementById('errorcontmsg')
  if (errormsgimg.getAttribute('style', 'display') === 'block') {
  } else {
    errormsgimg.style.display = 'block'
    errormsgimg.style.animation = 'showalert 0.8s'

    setTimeout(() => {
      errormsgimg.style.animation = 'hidealert 0.5s'
      setTimeout(() => {
        errormsgimg.style.display = 'none'
      }, 450)
    }, 8000)
  }
}

function handleScroll() {
  const hiddenDivs = document.querySelectorAll('.box')
  const lazyImages = document.querySelectorAll('.ImageForGame')

  if ((canLoadImages = true)) {
    lazyImages.forEach((image) => {
      let retries = 0

      function loadImage() {
        if (isElementInViewport(image) && !image.src) {
          image.src = image.getAttribute('data-src')

          image.onload = function () {
            image.classList.add('showIMG')
            retries = 0
          }

          image.onerror = function () {
            retries++
            if (retries < 3) {
              loadImage()
            } else {
              image.classList.add('showIMG')

              image.src = './fallback.png'
              errorimgshow()
            }
          }
        }
      }

      loadImage()
    })

    hiddenDivs.forEach((div) => {
      if (isElementInViewport(div)) {
        div.classList.add('show')
        //console.log('Loaded ' + div.id)
      } else if (isElementNotInViewport(div)) {
        //div.classList.remove('show')
      }
    })
  }
}

var PageHasLoaded = false

window.addEventListener('load', function (event) {
  if ((PageHasLoaded = false)) {
    canLoadImages = true
    console.log('E-2')

    handleScroll()
  }
  console.log('E-1')
})

var preloaded = false
function searchHandleLoad() {
  const hiddenDivs = document.querySelectorAll('.box')
  const lazyImages = document.querySelectorAll('.ImageForGame')
  if (preloaded === false) {
    lazyImages.forEach((image) => {
      let retries = 0

      function loadImage() {
        image.src = image.getAttribute('data-src')

        image.onload = function () {
          image.classList.add('showIMG')
          retries = 0
        }

        image.onerror = function () {
          retries++
          if (retries < 3) {
            loadImage()
          } else {
            image.classList.add('showIMG')

            image.src = './fallback.png'
          }
        }
      }

      loadImage()
    })
    hiddenDivs.forEach((div) => {
      div.classList.add('show')
    })
    console.log('Loaded')
    preloaded = true
  } else if (preloaded === true) {
    console.log('Already Loaded')
  }
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
    var categories = element.getAttribute('category')

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
      var filter = input.value.trim().toUpperCase()
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
            var idUpper = id.toUpperCase()
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
