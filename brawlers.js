// --- DOM Elements ---
const svgPreview = document.getElementById('brawlerPreviewSVG')
const selects = {} // To store all select elements
const colorInputs = {} // To store all color inputs
const brawlerNameInput = document.getElementById('brawlerName')
const generateNameBtn = document.getElementById('generateNameBtn')
const randomizeAllBtn = document.getElementById('randomizeAllBtn')
const randomizeFeaturesBtn = document.getElementById('randomizeFeaturesBtn')
const createdBrawlerDisplay = document.getElementById('createdBrawlerDisplay')
const downloadPngBtn = document.getElementById('downloadPngBtn')
const discordBanner = document.getElementById('discordBanner')
const discordAvatarSVG = document.getElementById('discordAvatarSVG') // The SVG inside the avatar circle
const discordAvatarContainer = document.getElementById('discordAvatarContainer') // Avatar container
const avatarOverlay = document.getElementById('avatarOverlay') // The overlay container
const darkOverlay = document.getElementById('darkOverlay') // Dark background overlay
const closeOverlayBtn = document.getElementById('closeOverlayBtn') // Close button
const largeAvatarSVG = document.getElementById('largeAvatarSVG') // The larger SVG in the overlay
const overlayDownloadBtn = document.getElementById('overlayDownloadBtn') // Download button in overlay
const overlayBrawlerName = document.getElementById('overlayBrawlerName') // Brawler name in overlay
const discordDisplayName = document.getElementById('discordDisplayName')
const discordUsername = document.getElementById('discordUsername')
const bannerColorInput = document.getElementById('bannerColor')

if (downloadPngBtn) {
  downloadPngBtn.addEventListener('click', () => {
    const svgElement = document.getElementById('brawlerPreviewSVG')
    if (!svgElement) {
      console.error('SVG element not found for download.')
      return
    }

    const brawlerName = brawlerNameInput.value.trim() || 'MyBrawler'
    // Sanitize filename: replace spaces and special characters
    const fileName = brawlerName.replace(/[^a-z0-9_]+/gi, '_').replace(/^_|_$/g, '') + '.png'

    // Options for saveSvgAsPng
    const options = {
      scale: 3, // Increase scale for higher resolution PNG (e.g., 3x the SVG's display size)
      backgroundColor: '#2d3748', // Set background color for the PNG (same as your preview bg)
      // Or make it transparent: null or 'transparent' if SVG has no bg
      encoderOptions: 0.92, // For PNG, this is compression level (0-1, where 1 is less compression, larger file)
      // For JPEG, it's quality (0-1)
      // You can also specify width and height directly if needed:
      // width: 500, // desired width in pixels
      // height: 500, // desired height in pixels
      // The library will try to respect aspect ratio.
    }

    // The library is available globally as `svgAsPngUri` or `saveSvgAsPng`
    // `saveSvgAsPng` directly triggers download.
    // `svgAsPngUri` returns a data URI if you want to display it first.
    saveSvgAsPng(svgElement, fileName, options)
      .then(() => {
        console.log('PNG download initiated for:', fileName)
      })
      .catch((error) => {
        console.error('Error saving SVG as PNG:', error)
        alert('Sorry, there was an error generating the PNG. Please try again or check the console.')
      })
  })
}

// --- SVG ASSET DEFINITIONS ---
// (Paths should be designed for a 100x100 viewBox)
const SVG_ASSETS = {
  hairBack: {
    none: '',
    poofyLarge: '<path d="M10 40 Q50 10 90 40 L85 90 Q50 100 15 90 Z" class="hair-back-el"/>',
    spikyLayered:
      '<path d="M15 35 L50 10 L85 35 L80 50 L50 30 L20 50Z M10 60 L50 40 L90 60 L80 90 Q50 100 20 90Z" class="hair-back-el"/>',
    longStraight:
      '<path d="M20 35 C15 60, 15 90, 25 95 L75 95 C85 90, 85 60, 80 35 Q50 50 20 35Z" class="hair-back-el"/>',
    bunHigh:
      '<path d="M40 10 C30 15, 30 30, 40 35 L60 35 C70 30, 70 15, 60 10 Z M20 40 Q50 20 80 40 L75 80 Q50 90 25 80Z" class="hair-back-el"/>', // Bun + base
  },
  clothingHint: {
    none: '',
    shouldersUp: '<path d="M20 75 Q50 90 80 75 L90 100 H10 Z" class="clothing-el"/>',
    simpleCollar: '<path d="M30 80 C40 85, 60 85, 70 80 L75 95 H25Z" class="clothing-el"/>',
    vNeck: '<path d="M40 80 L50 90 L60 80 L75 100 H25Z" class="clothing-el"/>',
    hoodieUpHint: '<path d="M25 70 Q50 60 75 70 L85 95 Q50 105 15 95 Z" class="clothing-el headwear-el"/>', // Can double as headwear base
  },
  headShape: {
    ovalTilt: '<path d="M25,30 Q50,0 75,30 T78,70 Q50,100 22,70 T25,30 Z" class="skin-el head-el"/>',
    roundishFull: '<path d="M15,45 C15,15 85,15 85,45 S80,95 50,95 S15,75 15,45 Z" class="skin-el head-el"/>',
    dynamicJaw: '<path d="M20 35 C30 10 70 10 80 35 L85 65 Q50 95 15 65 Z" class="skin-el head-el"/>',
    softSquare: '<path d="M20 25 C20 10, 80 10, 80 25 L85 70 Q50 95 15 70 Z" class="skin-el head-el"/>',
    heartShape:
      '<path d="M50 15 C30 10, 20 30, 20 45 C20 65, 40 80, 50 95 C60 80, 80 65, 80 45 C80 30, 70 10, 50 15 Z" class="skin-el head-el"/>',
  },
  ears: {
    none: '',
    pointedSide:
      '<g><path d="M18 40 C5 45, 5 60, 18 65" class="skin-el ear-el" fill="none"/><path d="M80 45 C90 50, 90 60, 80 62" class="skin-el ear-el" fill="none"/></g>',
    roundSmall:
      '<g><path d="M19 42 C15 42, 12 50, 19 55" class="skin-el ear-el" fill="none"/><path d="M81 42 C85 42, 88 50, 81 55" class="skin-el ear-el" fill="none"/></g>',
    elfEars:
      '<g><path d="M18 35 C0 45, 5 65, 20 70" class="skin-el ear-el" fill="none"/><path d="M82 35 C100 45, 95 65, 80 70" class="skin-el ear-el" fill="none"/></g>',
  },
  hairFront: {
    none: '',
    dynamicSpikes: '<path d="M20 10 L40 5 L50 15 L60 5 L80 10 L70 35 Q50 25 30 35 Z" class="hair-front-el"/>',
    sweepingBangs: '<path d="M15 15 Q60 0 85 30 L75 45 Q40 20 15 15 Z" class="hair-front-el"/>',
    fullVolume: '<path d="M10 10 Q50 -10 90 10 C95 40, 50 30, 5 40 Z" class="hair-front-el"/>',
    curtainBangs:
      '<path d="M20 15 Q35 5 50 15 L45 40 Q30 30 20 40 Z M80 15 Q65 5 50 15 L55 40 Q70 30 80 40 Z" class="hair-front-el"/>',
    shortMessy:
      '<path d="M25 15 L30 10 L35 18 L40 12 L45 20 L50 10 L55 20 L60 12 L65 18 L70 10 L75 15 L70 30 H30Z" class="hair-front-el"/>',
    mohawkStrip: '<path d="M40 5 L45 0 L55 0 L60 5 L55 30 L45 30Z" class="hair-front-el"/>',
  },
  eyeShape: {
    largeExpressive: `<g><ellipse cx="33" cy="45" rx="12" ry="15" transform="rotate(-10 33 45)" class="eye-sclera-el"/><ellipse cx="67" cy="48" rx="11" ry="14" transform="rotate(5 67 48)" class="eye-sclera-el"/></g>`,
    animeAlmond: `<g><path d="M20 40 C30 30, 45 30, 50 42 C45 52, 30 52, 20 40 Z" class="eye-sclera-el"/><path d="M55 42 C65 32, 80 32, 85 44 C80 54, 65 54, 55 42 Z" class="eye-sclera-el"/></g>`,
    surprisedRound: `<g><circle cx="35" cy="45" r="13" class="eye-sclera-el"/><circle cx="65" cy="45" r="13" class="eye-sclera-el"/></g>`,
    slyHalfMoon: `<g><path d="M25 50 Q35 35 45 50Z" class="eye-sclera-el"/><path d="M55 50 Q65 35 75 50Z" class="eye-sclera-el"/></g>`, // Top half open
    determinedSlim: `<g><path d="M22 40 L48 43 L47 48 L23 45 Z" class="eye-sclera-el"/><path d="M52 43 L78 40 L77 45 L53 48 Z" class="eye-sclera-el"/></g>`,
  },
  pupilShape: {
    smallDotWithHighlight: `<g><circle cx="33" cy="47" r="3.5" class="pupil-el"/><circle cx="34" cy="45" r="1" class="eye-highlight-el"/> <circle cx="67" cy="50" r="3.2" class="pupil-el"/><circle cx="68" cy="48" r="0.9" class="eye-highlight-el"/></g>`,
    ovalVerticalHighlight: `<g><ellipse cx="33" cy="47" rx="2.5" ry="4" class="pupil-el"/><ellipse cx="33" cy="45" rx="0.8" ry="1.5" class="eye-highlight-el"/> <ellipse cx="67" cy="50" rx="2.3" ry="3.8" class="pupil-el"/><ellipse cx="67" cy="48" rx="0.7" ry="1.4" class="eye-highlight-el"/></g>`,
    largeRoundCenteredHighlight: `<g><circle cx="35" cy="45" r="5" class="pupil-el"/><circle cx="37" cy="43" r="1.5" class="eye-highlight-el"/> <circle cx="65" cy="45" r="5" class="pupil-el"/><circle cx="67" cy="43" r="1.5" class="eye-highlight-el"/></g>`,
    catSlit: `<g><ellipse cx="35" cy="45" rx="1.5" ry="6" class="pupil-el"/><ellipse cx="65" cy="45" rx="1.5" ry="6" class="pupil-el"/></g>`, // No highlight example, add if needed
    tinyPinpoint: `<g><circle cx="35" cy="45" r="1.5" class="pupil-el"/><circle cx="65" cy="45" r="1.5" class="pupil-el"/></g>`,
  },
  eyebrowShape: {
    none: '',
    expressiveArched:
      '<g><path d="M22,32 Q35,25 45,33" class="eyebrow-el" fill="none"/><path d="M55,35 Q68,28 78,36" class="eyebrow-el" fill="none"/></g>',
    determinedStraight:
      '<g><path d="M23,30 L43,34" class="eyebrow-el" fill="none"/><path d="M57,36 L77,32" class="eyebrow-el" fill="none"/></g>',
    sadSloped:
      '<g><path d="M25,35 Q35,40 45,35" class="eyebrow-el" fill="none"/><path d="M55,35 Q65,40 75,35" class="eyebrow-el" fill="none"/></g>',
    raisedSurprised:
      '<g><path d="M25,25 Q35,18 45,25" class="eyebrow-el" fill="none"/><path d="M55,25 Q65,18 75,25" class="eyebrow-el" fill="none"/></g>',
    thickBlocky: '<path d="M23 28 H43 V32 H23 Z M57 28 H77 V32 H57 Z" class="eyebrow-el"/>', // Fillable
  },
  noseShape: {
    none: '',
    subtleShade:
      '<g class="nose-group"><path d="M47,54 C49,58 52,58 53,54" class="nose-outline-el" stroke="#000000" stroke-width="1.5" fill="none"/><path d="M48,55 C49,58 51,58 52,55" class="nose-el skin-el" stroke="none" opacity="0.9" fill="#F5D5A9" stroke-width="0" stroke-linejoin="round"/></g>',
    simpleAngled:
      '<path d="M47,53 L50,58 L53,54" class="nose-el" fill="none" stroke="#000000" stroke-width="1.5" stroke-linecap="round"/>',
    buttonSmall:
      '<g class="nose-group"><circle cx="50" cy="57" r="3.5" class="nose-outline-el" stroke="#000000" stroke-width="1.5" fill="none"/><circle cx="50" cy="57" r="2.5" class="nose-el skin-el" stroke="none" fill="#F5D5A9" stroke-width="0" stroke-linejoin="round"/></g>',
    pointedMedium:
      '<g class="nose-group"><path d="M47,51 L50,61 L53,51 Z" class="nose-outline-el" stroke="#000000" stroke-width="1.5" fill="none"/><path d="M48,52 L50,60 L52,52 Z" class="nose-el skin-el" stroke="none" fill="#F5D5A9" stroke-width="0" stroke-linejoin="round"/></g>',
    vShapeLine:
      '<path d="M47,55 L50,58 L53,55" class="nose-el" fill="none" stroke="#000000" stroke-width="1.5" stroke-linecap="round"/>',
  },
  mouthShape: {
    toothyGrin: `<g class="mouth-group"><path d="M35,65 Q50,80 65,65 L60,82 H40 Z" class="mouth-interior-el"/><path d="M40,68 L43,64 L46,68 L49,64 L52,68 L55,64 L58,68" class="teeth-el" stroke-linejoin="round"/></g>`,
    openShout: `<g class="mouth-group"><path d="M30,60 Q50,85 70,60 Q50,95 30,60 Z" class="mouth-interior-el"/><path d="M35,65 L38,60 L41,65 L44,60 L47,65 L50,60 L53,65 L56,60 L59,65 L62,60 L65,65" class="teeth-el"/><path d="M38,85 L41,90 L44,85 L47,90 L50,85 L53,90 L56,85" class="teeth-el" transform="translate(0, -5)"/></g>`,
    smirkLine: '<path d="M38,70 Q48,73 60,68" class="mouth-el" fill="none"/>',
    neutralLine: '<line x1="40" y1="72" x2="60" y2="72" class="mouth-el"/>',
    smallOh: `<g class="mouth-group"><ellipse cx="50" cy="70" rx="5" ry="7" class="mouth-interior-el"/></g>`, // Can add teeth if needed
    wobblyConcern: '<path d="M38 70 Q43 67, 48 70 Q52 73, 57 70" class="mouth-el" fill="none"/>',
    laughingOpen: `<g class="mouth-group"><path d="M30 60 C35 80, 65 80, 70 60 Q50 90 30 60Z" class="mouth-interior-el"/><path d="M35,65 C40 60, 60 60, 65 65" class="teeth-el" fill="none"/></g>`, // Upper teeth as a line
  },
  headwear: {
    none: '',
    dynamicBeanie: '<path d="M15 5 Q50 -5 85 5 L80 35 C70 25, 30 25, 20 35 Z" class="headwear-el clothing-el"/>',
    wideCap: '<path d="M10 15 Q50 0 90 15 L 85 30 H15Z M80 30 Q100 30 85 18" class="headwear-el clothing-el"/>', // Cap + brim
    headbandSimple: '<path d="M15 20 L85 20 L80 28 L20 28Z" class="headwear-el clothing-el"/>',
    crownSpiky:
      '<path d="M20 10 L30 25 L40 10 L50 25 L60 10 L70 25 L80 10 L75 30 H25Z" class="headwear-el clothing-el"/>',
    helmetBasic: '<path d="M15 10 Q50 -5 85 10 L90 50 Q50 60 10 50 Z" class="headwear-el clothing-el"/>',
  },
}

const DRAW_ORDER = [
  'clothingHint',
  'ears',
  'headShape',
  'hairFront',
  'eyeShape',
  'pupilShape',
  'noseShape',
  'mouthShape',
  'eyebrowShape',
  'headwear',
]

function populateSelects() {
  for (const category in SVG_ASSETS) {
    const selectElement = document.getElementById(category) || document.createElement('select') // Handle if not in HTML yet
    if (!selectElement.id) selectElement.id = category // Assign ID if created
    selects[category] = selectElement

    if (selectElement.options.length === 0) {
      // Populate only if empty
      Object.keys(SVG_ASSETS[category]).forEach((styleName) => {
        const option = new Option(
          styleName.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
          styleName
        )
        selectElement.add(option)
      })
    }
    selectElement.addEventListener('change', updateBrawlerPreview)
  }

  colorInputs.skinTone = document.getElementById('skinTone')
  colorInputs.hairColor = document.getElementById('hairColor')
  colorInputs.eyeColor = document.getElementById('eyeColor')
  colorInputs.clothingColor1 = document.getElementById('clothingColor1')
  colorInputs.outlineColor = document.getElementById('outlineColor')
  colorInputs.outlineWidth = document.getElementById('outlineWidth')

  for (const ci in colorInputs) {
    if (colorInputs[ci]) {
      colorInputs[ci].addEventListener('input', updateBrawlerPreview)
    }
  }
}

function createSVGElement(svgString) {
  const svgNS = 'http://www.w3.org/2000/svg'
  const parser = new DOMParser()
  // Wrap the svgString in a root <svg> element for the parser,
  // because DOMParser.parseFromString expects a full document.
  // Ensure the SVG namespace is declared on this wrapper.
  const doc = parser.parseFromString(`<svg xmlns="${svgNS}">${svgString.trim()}</svg>`, 'image/svg+xml')

  // Check for parser errors, which browsers often insert as a <parsererror> element
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    console.error('Error parsing SVG string:', svgString)
    console.error('Parser error details:', parserError.textContent)
    return null // Or handle the error as appropriate
  }

  // The actual element we want is the first child of the root <svg> element we created.
  if (doc.documentElement && doc.documentElement.firstChild) {
    return doc.documentElement.firstChild
  } else {
    // This might happen if svgString was empty or just whitespace
    // console.warn("Parsed SVG string resulted in no element:", svgString);
    return null
  }
}

// --- Avatar overlay functionality ---
if (discordAvatarContainer && avatarOverlay) {
  // Open overlay when clicking on the Discord avatar
  discordAvatarContainer.addEventListener('click', () => {
    // Make sure the large SVG is updated with the current avatar SVG content
    if (largeAvatarSVG && discordAvatarSVG) {
      largeAvatarSVG.innerHTML = discordAvatarSVG.innerHTML
    }

    // Update the brawler name in the overlay
    if (overlayBrawlerName && discordDisplayName) {
      overlayBrawlerName.textContent = discordDisplayName.textContent + ' Avatar'
    }

    // Show the overlay
    avatarOverlay.classList.remove('hidden')

    // Prevent scrolling of the body while overlay is open
    document.body.style.overflow = 'hidden'
  })

  // Close overlay when clicking the close button
  if (closeOverlayBtn) {
    closeOverlayBtn.addEventListener('click', () => {
      avatarOverlay.classList.add('hidden')
      document.body.style.overflow = ''
    })
  }

  // Close overlay when clicking the dark background
  if (darkOverlay) {
    darkOverlay.addEventListener('click', () => {
      avatarOverlay.classList.add('hidden')
      document.body.style.overflow = ''
    })
  }

  // Close overlay when pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !avatarOverlay.classList.contains('hidden')) {
      avatarOverlay.classList.add('hidden')
      document.body.style.overflow = ''
    }
  })
}

// --- Function to update the Discord Profile Preview ---
function updateDiscordProfilePreview(brawlerNameValue, currentBrawlerSVGString) {
  if (!discordCard.style.display || discordCard.style.display === 'none') {
    // If you choose to hide the card initially, show it now.
    // document.getElementById('discordProfilePreviewContainer').style.display = 'block';
  }

  // Update Display Name
  discordDisplayName.textContent = brawlerNameValue || 'Brawler'

  // Update Username
  const username = (brawlerNameValue || 'brawler')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
  discordUsername.textContent = username || 'sz_brawler'

  // Update Avatar SVG
  if (discordAvatarSVG && currentBrawlerSVGString) {
    discordAvatarSVG.innerHTML = currentBrawlerSVGString
  }

  // Update Large Avatar SVG in overlay
  if (largeAvatarSVG && currentBrawlerSVGString) {
    largeAvatarSVG.innerHTML = currentBrawlerSVGString
  }

  // Update overlay brawler name
  if (overlayBrawlerName) {
    overlayBrawlerName.textContent = (brawlerNameValue || 'Brawler') + ' Avatar'
  }

  // Banner color is handled by its own event listener
}

// --- Event Listener for Banner Color Picker ---
if (bannerColorInput && discordBanner) {
  bannerColorInput.addEventListener('input', (event) => {
    discordBanner.style.backgroundColor = event.target.value
  })
}

function updateBrawlerPreview() {
  if (!svgPreview) return
  svgPreview.innerHTML = '' // Clear previous SVG

  // Create a root group for all brawler parts for easier transformation
  const brawlerRoot = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  brawlerRoot.setAttribute('id', 'brawlerRoot')
  // Apply base transform for pose, zoom, and framing. TUNE THESE VALUES!
  // Example: Scale up, slight rotation, shift to center the "action"
  brawlerRoot.setAttribute('transform', 'scale(1.25) rotate(-6 50 55) translate(-12, -5)')
  brawlerRoot.classList.add('animated') // Add class for CSS animation
  svgPreview.appendChild(brawlerRoot)

  const selectedColors = {
    skin: colorInputs.skinTone.value,
    hair: colorInputs.hairColor.value,
    eyes: colorInputs.eyeColor.value, // Pupil/iris color
    clothing1: colorInputs.clothingColor1.value,
    outline: colorInputs.outlineColor.value,
    mouthInterior: '#B71C1C', // A common dark red for mouth interior
    teeth: '#FFFFFF',
  }
  const outlineWidthValue = colorInputs.outlineWidth.value + 'px'
  const teethOutlineWidth = Math.max(0.3, parseFloat(colorInputs.outlineWidth.value) * 0.5) + 'px' // Thinner outline for teeth

  DRAW_ORDER.forEach((category) => {
    if (selects[category] && SVG_ASSETS[category]) {
      const selectedStyleName = selects[category].value
      const svgPartStringOrGroup = SVG_ASSETS[category][selectedStyleName]

      if (svgPartStringOrGroup) {
        // Handle cases where an asset might be a group string (like new mouths)
        // or a single path string. createSVGElement should handle it.
        const partOrGroupElement = createSVGElement(svgPartStringOrGroup)

        if (partOrGroupElement) {
          // If it's a group (e.g., for mouth with teeth), iterate its children
          const elementsToStyle =
            partOrGroupElement.tagName.toLowerCase() === 'g'
              ? Array.from(partOrGroupElement.childNodes).filter((node) => node.nodeType === 1) // Only element nodes
              : [partOrGroupElement]

          elementsToStyle.forEach((el) => {
            // Specific styling based on classes
            if (el.classList.contains('skin-el')) {
              el.style.fill = selectedColors.skin
              el.style.stroke = selectedColors.outline
              el.style.strokeWidth = outlineWidthValue
            } else if (el.classList.contains('hair-front-el') || el.classList.contains('hair-back-el')) {
              el.style.fill = selectedColors.hair
              el.style.stroke = selectedColors.outline
              el.style.strokeWidth = outlineWidthValue
            } else if (el.classList.contains('eyebrow-el')) {
              el.style.fill = 'none' // Eyebrows are usually strokes
              el.style.stroke = selectedColors.hair // Match hair color
              el.style.strokeWidth = Math.max(1.5, parseFloat(outlineWidthValue)) + 'px' // Minimum 1.5px width
              el.style.strokeLinecap = 'round'
            } else if (el.classList.contains('eye-sclera-el')) {
              el.style.fill = 'white'
              el.style.stroke = selectedColors.outline
              el.style.strokeWidth = outlineWidthValue
            } else if (el.classList.contains('pupil-el')) {
              el.style.fill = selectedColors.eyes
              el.style.stroke = selectedColors.outline // Pupils can have a thin outline
              el.style.strokeWidth = Math.max(0.2, parseFloat(outlineWidthValue) * 0.3) + 'px'
            } else if (el.classList.contains('eye-highlight-el')) {
              el.style.fill = 'white'
              el.style.stroke = 'none' // No stroke for highlights
            } else if (el.classList.contains('mouth-interior-el')) {
              el.style.fill = selectedColors.mouthInterior
              el.style.stroke = 'none' // No stroke for mouth interior
            } else if (el.classList.contains('teeth-el')) {
              el.style.fill = selectedColors.teeth
              el.style.stroke = selectedColors.outline
              el.style.strokeWidth = teethOutlineWidth
              el.style.strokeLinejoin = 'round'
            } else if (el.classList.contains('mouth-el')) {
              // For simple line mouths
              el.style.fill = 'none'
              el.style.stroke = selectedColors.outline
              el.style.strokeWidth = Math.max(1.5, parseFloat(outlineWidthValue)) + 'px' // Minimum 1.5px width
              el.style.strokeLinecap = 'round'
            } else if (el.classList.contains('nose-el') || el.classList.contains('nose-outline-el')) {
              if (el.classList.contains('nose-outline-el')) {
                // For outline elements, use a darker skin tone
                const skinColor = selectedColors.skin
                const r = parseInt(skinColor.slice(1, 3), 16)
                const g = parseInt(skinColor.slice(3, 5), 16)
                const b = parseInt(skinColor.slice(5, 7), 16)
                const darkerSkin = `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`

                // Set outline color
                el.setAttribute('stroke', darkerSkin)
                el.style.stroke = darkerSkin

                // Ensure outline width is at least 1.5px
                const minWidth = 1.5
                const finalWidth = Math.max(minWidth, parseFloat(outlineWidthValue))
                el.setAttribute('stroke-width', finalWidth)
                el.style.strokeWidth = `${finalWidth}px`

                // Make sure it has no fill
                el.setAttribute('fill', 'none')
                el.style.fill = 'none'
              } else if (el.classList.contains('skin-el')) {
                // For skin elements, just use the skin color
                el.style.fill = selectedColors.skin
                el.setAttribute('fill', selectedColors.skin)

                // No stroke on the inner element
                el.style.stroke = 'none'
                el.setAttribute('stroke', 'none')

                // Make fully visible
                el.style.opacity = '1'
                el.setAttribute('opacity', '1')
              } else {
                // For regular nose lines
                el.style.fill = 'none'
                el.setAttribute('fill', 'none')
                el.style.stroke = selectedColors.outline
                el.setAttribute('stroke', selectedColors.outline)

                // Ensure stroke width
                const minWidth = 1.5
                const finalWidth = Math.max(minWidth, parseFloat(outlineWidthValue))
                el.setAttribute('stroke-width', finalWidth)
                el.style.strokeWidth = `${finalWidth}px`

                // Round line caps
                el.style.strokeLinecap = 'round'
                el.setAttribute('stroke-linecap', 'round')
              }
            } else if (el.classList.contains('clothing-el') || el.classList.contains('headwear-el')) {
              el.style.fill = selectedColors.clothing1
              el.style.stroke = selectedColors.outline
              el.style.strokeWidth = outlineWidthValue
            } else if (el.classList.contains('facial-feature-el')) {
              if (el.classList.contains('blush-el')) {
                el.style.fill = '#FF8A80' // A pinkish blush color
                el.style.stroke = 'none'
              } else if (el.classList.contains('scar-el')) {
                el.style.fill = 'none'
                el.style.stroke = selectedColors.skin // Often a slightly darker skin tone or outline color
                el.style.filter = 'brightness(0.8)' // Make it look like a scar on skin
                el.style.strokeLinecap = 'round'
              } else if (el.classList.contains('freckle-el')) {
                el.style.fill = selectedColors.skin // Skin color, but darker
                el.style.filter = 'brightness(0.6)'
                el.style.stroke = 'none'
              } else if (el.classList.contains('paint-el')) {
                el.style.fill = selectedColors.clothing1 // Or a dedicated paint color
                el.style.stroke = selectedColors.outline
                el.style.strokeWidth = Math.max(0.2, parseFloat(outlineWidthValue) * 0.4) + 'px'
              }
            } else if (el.classList.contains('accessory-el')) {
              if (el.classList.contains('glasses-el')) {
                // Children of glasses group are already paths/circles
                el.querySelectorAll('*').forEach((glassPart) => {
                  glassPart.style.stroke = selectedColors.outline // Or a specific glasses frame color
                  // glassPart.style.fill = 'rgba(173, 216, 230, 0.3)'; // Optional lens tint
                })
              } else if (el.classList.contains('earring-el') || el.classList.contains('choker-el')) {
                el.style.fill = selectedColors.clothing1 // Or a metallic color for earrings
                if (
                  el.classList.contains('earring-el') &&
                  el.tagName.toLowerCase() === 'circle' &&
                  el.getAttribute('fill') === 'none'
                ) {
                  // for hoop earrings
                  el.style.stroke = selectedColors.clothing1 // Or metallic
                } else {
                  el.style.stroke = selectedColors.outline
                }
                el.style.strokeWidth = Math.max(0.3, parseFloat(outlineWidthValue) * 0.6) + 'px'
              }
            } else {
              // Default for any unclassified filled paths
              if (el.style.fill !== 'none' && el.getAttribute('d') /* only apply to paths */) {
                el.style.stroke = selectedColors.outline
                el.style.strokeWidth = outlineWidthValue
              }
            }
            // Ensure stroke-linejoin for softer corners on main parts
            if (el.style.stroke !== 'none' && el.style.stroke !== selectedColors.hair /* not eyebrows */) {
              el.style.strokeLinejoin = 'round'
            }
          })
          brawlerRoot.appendChild(partOrGroupElement)
        }
      }
    }
  })
  const currentBrawlerName = brawlerNameInput.value.trim()
  const currentBrawlerIconSVG = svgPreview.innerHTML // The content of the main preview
  updateDiscordProfilePreview(currentBrawlerName, currentBrawlerIconSVG)
}
// Name Generation (same as before)
const namePrefixes = [
  'Shadow',
  'Nitro',
  'Cyber',
  'Omega',
  'General',
  'Captain',
  'Doctor',
  'Agent',
  'King',
  'Queen',
  'Atomic',
  'Cosmic',
  'Dynamo',
]
const nameMiddles = [
  'Strike',
  'Bolt',
  'Fang',
  'Heart',
  'Nova',
  'Blade',
  'Spark',
  'Rage',
  'Gale',
  'Doom',
  'Fury',
  'Storm',
  'Blast',
]
const nameSuffixes = ['X', 'Prime', 'Zero', 'MKII', 'Elite', 'Bot', 'Jr.', 'Sr.', 'Max', 'Pro', 'Star']

generateNameBtn.addEventListener('click', () => {
  const prefix = namePrefixes[Math.floor(Math.random() * namePrefixes.length)]
  const middle = nameMiddles[Math.floor(Math.random() * nameMiddles.length)]
  const suffix = Math.random() > 0.6 ? ' ' + nameSuffixes[Math.floor(Math.random() * nameSuffixes.length)] : ''
  brawlerNameInput.value = `${prefix} ${middle}${suffix}`

  // Update Discord profile preview with the new name
  const currentBrawlerName = brawlerNameInput.value.trim()
  const currentBrawlerIconSVG = svgPreview.innerHTML
  updateDiscordProfilePreview(currentBrawlerName, currentBrawlerIconSVG)
})

randomizeAllBtn.addEventListener('click', () => {
  for (const category in selects) {
    const select = selects[category]
    if (select.options.length > 0) {
      select.selectedIndex = Math.floor(Math.random() * select.options.length)
    }
  }
  // Randomize colors too
  Object.values(colorInputs).forEach((input) => {
    if (input.type === 'color') {
      input.value =
        '#' +
        Math.floor(Math.random() * 16777215)
          .toString(16)
          .padStart(6, '0')
    }
  })
  generateNameBtn.click() // Generate a random name
  updateBrawlerPreview()

  // Update visual selectors to match new values
  updateVisualSelectors()

  // NOW, update the Discord profile preview after main preview is updated
  const currentBrawlerName = brawlerNameInput.value.trim()
  const currentBrawlerIconSVG = svgPreview.innerHTML
  updateDiscordProfilePreview(currentBrawlerName, currentBrawlerIconSVG)
})

// Add event listener for the randomize features button
if (randomizeFeaturesBtn) {
  randomizeFeaturesBtn.addEventListener('click', () => {
    // Randomize all feature selections
    for (const category in selects) {
      const select = selects[category]
      if (select.options.length > 0) {
        select.selectedIndex = Math.floor(Math.random() * select.options.length)
      }
    }

    // Randomize colors
    Object.values(colorInputs).forEach((input) => {
      if (input.type === 'color') {
        input.value =
          '#' +
          Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, '0')
      }
    })

    // Update the preview (without changing the name)
    updateBrawlerPreview()

    // Update visual selectors to match new values
    updateVisualSelectors()

    // Update the Discord profile preview with current name and new SVG
    const currentBrawlerName = brawlerNameInput.value.trim()
    const currentBrawlerIconSVG = svgPreview.innerHTML
    updateDiscordProfilePreview(currentBrawlerName, currentBrawlerIconSVG)
  })
}

function displayBrawlerCard(data) {
  createdBrawlerDisplay.innerHTML = `
       <div class="brawl-card p-6 rounded-lg mt-8 text-center relative overflow-hidden">
           <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brawl-blue to-brawl-purple"></div>
           <h3 class="text-2xl font-bold text-brawl-yellow mb-4">${data.name}</h3>
           <div class="brawler-svg-preview mx-auto mb-5" style="width:180px; height:180px;">
               <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">${data.svgString}</svg>
           </div>
           <div class="inline-flex items-center justify-center bg-opacity-50 bg-black px-4 py-2 rounded-lg">
               <span class="text-sm text-gray-300">Skin: ${data.skinTone} | Hair: ${data.hairColor}</span>
           </div>
       </div>
   `
  createdBrawlerDisplay.scrollIntoView({ behavior: 'smooth' })
}

// --- Initialization ---
populateSelects()
updateBrawlerPreview() // Initial render

// --- INITIALIZATION ---
// Call updateDiscordProfilePreview once on load if you want it to show something initially.
// Or, you might prefer to only show/update it after the first brawler creation.
document.addEventListener('DOMContentLoaded', () => {
  // Initial update of the Discord preview with default/placeholder values
  // Get initial values or use placeholders
  const initialName = brawlerNameInput.value.trim() || 'Brawler Example'
  const initialIconSVG = svgPreview.innerHTML // This will be the initial state of the main preview
  updateDiscordProfilePreview(initialName, initialIconSVG)

  // Create visual selectors after populating the select elements
  createVisualSelectors()
  // Initialize the animated avatar background
  initAvatarBackground()
})

// Animated Avatar Background
function initAvatarBackground() {
  const avatarImages = [
    'Agent Doom Star Avatar.png',
    'Agent Storm Avatar.png',
    'Atomic Blade Avatar.png',
    'Atomic Spark Avatar.png',
    'Captain Doom Avatar.png',
    'Captain Fury Avatar.png',
    'Cosmic Bolt Avatar.png',
    'Cosmic Strike Avatar.png',
    'Doctor Nova Avatar.png',
    'Doctor Spark Avatar.png',
    'King Fang Elite Avatar.png',
    'Omega Spark Avatar.png',
    'Queen Nova Avatar.png',
    'Queen Spark Avatar.png',
    'Queen Spark Prime Avatar.png',
    'Shadow Heart Star Avatar.png',
  ]

  const avatarContainer = document.querySelector('.avatar-background')
  const numAvatars = Math.min(20, avatarImages.length + 4) // Use each image at least once

  for (let i = 0; i < numAvatars; i++) {
    // Get an image, ensuring each is used at least once before repeating
    const imageIndex = i < avatarImages.length ? i : Math.floor(Math.random() * avatarImages.length)
    const imageName = avatarImages[imageIndex]
    const imagePath = `./images/${imageName}`

    // Create the avatar element
    const avatar = document.createElement('div')
    avatar.className = `avatar-float layer${Math.floor(Math.random() * 3) + 1}`

    // Random positioning
    const size = 80 + Math.random() * 120 // 80px to 200px
    const rotation = -10 + Math.random() * 20 // -10deg to +10deg
    const left = Math.random() * 100 // 0% to 100%
    const top = Math.random() * 100 // 0% to 100%
    const delay = -Math.random() * 30 // Random start in animation

    avatar.style.width = `${size}px`
    avatar.style.height = `${size}px`
    avatar.style.setProperty('--rotation', `${rotation}deg`)
    avatar.style.left = `${left}%`
    avatar.style.top = `${top}%`
    avatar.style.backgroundImage = `url('${imagePath}')`
    avatar.style.animationDelay = `${delay}s`
    avatar.style.zIndex = Math.floor(Math.random() * 3) - 1

    // Add fallback for image loading
    const img = new Image()
    img.onload = () => {
      avatar.style.backgroundImage = `url('${imagePath}')`
    }
    img.onerror = () => {
      // Try relative path as fallback
      const fallbackPath = `/images/${imageName}`
      avatar.style.backgroundImage = `url('${fallbackPath}')`

      // If still doesn't load, use a placeholder color
      const fallbackImg = new Image()
      fallbackImg.onload = () => {
        avatar.style.backgroundImage = `url('${fallbackPath}')`
      }
      fallbackImg.onerror = () => {
        // Use a random color from our brawl theme
        const colors = ['#1099E7', '#FFD86B', '#9B3CFF', '#F32757', '#5FAF26']
        const randomColor = colors[Math.floor(Math.random() * colors.length)]
        avatar.style.backgroundImage = 'none'
        avatar.style.backgroundColor = randomColor
      }
      fallbackImg.src = fallbackPath
    }
    img.src = imagePath

    avatarContainer.appendChild(avatar)
  }

  // Add mouse movement effect
  document.addEventListener('mousemove', (e) => {
    document.body.classList.add('moving-mouse')

    // Get mouse position
    const mouseX = e.clientX / window.innerWidth - 0.5
    const mouseY = e.clientY / window.innerHeight - 0.5

    // Apply subtle parallax effect to avatars
    document.querySelectorAll('.avatar-float').forEach((avatar) => {
      const depthFactor = parseFloat(avatar.style.zIndex) * 4 + 8
      const moveX = mouseX * depthFactor
      const moveY = mouseY * depthFactor
      avatar.style.transform = `translate(${moveX}px, ${moveY}px) rotate(var(--rotation))`
    })
  })

  // Reset avatars position when mouse stops moving
  let mouseTimer
  document.addEventListener('mousemove', () => {
    clearTimeout(mouseTimer)
    mouseTimer = setTimeout(() => {
      document.body.classList.remove('moving-mouse')
      document.querySelectorAll('.avatar-float').forEach((avatar) => {
        avatar.style.transform = ''
      })
    }, 500)
  })
}

// Add event listener for the outline width slider to update the display value
if (colorInputs.outlineWidth) {
  const outlineWidthValueDisplay = document.getElementById('outlineWidthValue')
  const outlineSlider = colorInputs.outlineWidth

  function updateSliderFill() {
    const value = parseFloat(outlineSlider.value)
    const min = parseFloat(outlineSlider.min)
    const max = parseFloat(outlineSlider.max)
    const percentage = ((value - min) / (max - min)) * 100

    // Update the background gradient to show fill
    outlineSlider.style.background = `linear-gradient(to right, var(--brawl-yellow) 0%, var(--brawl-yellow) ${percentage}%, var(--card-bg-light) ${percentage}%, var(--card-bg-light) 100%)`
  }

  outlineSlider.addEventListener('input', function () {
    outlineWidthValueDisplay.textContent = this.value
    updateBrawlerPreview()
    updateSliderFill()
  })

  // Initialize display value and slider fill
  outlineWidthValueDisplay.textContent = outlineSlider.value
  updateSliderFill()

  // Update on window resize
  window.addEventListener('resize', updateSliderFill)
}

function createVisualSelectors() {
  // Create visual selector for head shapes
  createVisualSelector('headShape', {
    customStyling: (el, svgContainer) => {
      if (el.classList.contains('skin-el')) {
        el.style.fill = '#F5D5A9' // Default skin tone
        el.style.stroke = '#000000'
        el.style.strokeWidth = '1px'
      }
    },
  })

  // Create visual selector for hair
  createVisualSelector('hairFront', {
    customStyling: (el, svgContainer) => {
      if (el.classList.contains('hair-front-el')) {
        el.style.fill = '#5D4037' // Default hair color
        el.style.stroke = '#000000'
        el.style.strokeWidth = '1px'
      }

      // Add a head shape behind the hair for context
      if (svgContainer && !svgContainer.querySelector('.head-context')) {
        const headContext = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        headContext.setAttribute('d', 'M15,45 C15,15 85,15 85,45 S80,95 50,95 S15,75 15,45 Z')
        headContext.classList.add('head-context')
        headContext.style.fill = '#F5D5A9'
        headContext.style.opacity = '0.3'
        headContext.style.stroke = 'none'
        svgContainer.insertBefore(headContext, svgContainer.firstChild)
      }
    },
  })

  // Create visual selector for eye shapes
  createVisualSelector('eyeShape', {
    customStyling: (el, svgContainer) => {
      if (el.classList.contains('eye-sclera-el')) {
        el.style.fill = 'white'
        el.style.stroke = '#000000'
        el.style.strokeWidth = '1px'
      }
      // Add a head shape behind the eyes for context
      if (svgContainer && !svgContainer.querySelector('.head-context')) {
        const headContext = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        headContext.setAttribute('d', 'M15,45 C15,15 85,15 85,45 S80,95 50,95 S15,75 15,45 Z')
        headContext.classList.add('head-context')
        headContext.style.fill = '#F5D5A9'
        headContext.style.opacity = '0.3'
        headContext.style.stroke = 'none'
        svgContainer.insertBefore(headContext, svgContainer.firstChild)
      }
    },
  })

  // Create visual selector for pupil shapes
  createVisualSelector('pupilShape', {
    customStyling: (el, svgContainer) => {
      if (el.classList.contains('pupil-el')) {
        el.style.fill = '#3E2723' // Dark brown
        el.style.stroke = '#000000'
        el.style.strokeWidth = '0.5px'
      }

      // Add a head shape and eye sclera behind the pupils for context
      if (svgContainer && !svgContainer.querySelector('.head-context')) {
        // Add head context first
        const headContext = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        headContext.setAttribute('d', 'M15,45 C15,15 85,15 85,45 S80,95 50,95 S15,75 15,45 Z')
        headContext.classList.add('head-context')
        headContext.style.fill = '#F5D5A9'
        headContext.style.opacity = '0.3'
        headContext.style.stroke = 'none'
        svgContainer.insertBefore(headContext, svgContainer.firstChild)

        // Add eye sclera after the head context
        const eyeScleraContext = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        eyeScleraContext.classList.add('eye-sclera-context')
        eyeScleraContext.innerHTML = `<ellipse cx="33" cy="47" rx="8" ry="10" fill="white" stroke="#000000" stroke-width="0.5" opacity="0.7" /><ellipse cx="67" cy="47" rx="8" ry="10" fill="white" stroke="#000000" stroke-width="0.5" opacity="0.7" />`
        svgContainer.insertBefore(eyeScleraContext, svgContainer.firstChild.nextSibling)
      }
    },
  })

  createVisualSelector('eyebrowShape', {
    customStyling: (el, svgContainer) => {
      if (el.classList.contains('eyebrow-el')) {
        if (el.getAttribute('fill') !== 'none') {
          el.style.fill = '#5D4037' // Default hair color for filled eyebrows
          el.setAttribute('fill', '#5D4037')
        }
        el.style.stroke = '#5D4037' // Default hair color
        el.style.strokeWidth = '1.5px' // Set to minimum 1.5px for consistency
        el.style.strokeLinecap = 'round'
        el.setAttribute('stroke', '#5D4037')
        el.setAttribute('stroke-width', '1.5')
        el.setAttribute('stroke-linecap', 'round')
      }

      // Add a head shape and eyes behind the eyebrows for context
      if (svgContainer && !svgContainer.querySelector('.head-context')) {
        // Add head shape first
        const headContext = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        headContext.setAttribute('d', 'M15,45 C15,15 85,15 85,45 S80,95 50,95 S15,75 15,45 Z')
        headContext.classList.add('head-context')
        headContext.style.fill = '#F5D5A9'
        headContext.style.opacity = '0.3'
        headContext.style.stroke = 'none'
        svgContainer.insertBefore(headContext, svgContainer.firstChild)

        // Add eye sclera after the head shape
        const eyeContext = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        eyeContext.classList.add('eye-context')
        eyeContext.innerHTML = `<ellipse cx="33" cy="47" rx="8" ry="10" fill="white" stroke="#000000" stroke-width="0.5" opacity="0.5" /><ellipse cx="67" cy="47" rx="8" ry="10" fill="white" stroke="#000000" stroke-width="0.5" opacity="0.5" />`
        svgContainer.insertBefore(eyeContext, headContext.nextSibling)
      }
    },
  })

  // Create visual selector for nose shapes
  createVisualSelector('noseShape', {
    customStyling: (el, svgContainer) => {
      if (el.classList.contains('nose-el')) {
        // For skin elements
        if (el.classList.contains('skin-el')) {
          el.style.fill = '#F5D5A9' // Default skin tone
          el.setAttribute('fill', '#F5D5A9')

          // No stroke on inner elements
          el.style.stroke = 'none'
          el.setAttribute('stroke', 'none')

          // Make sure opacity is set to 1
          el.style.opacity = '1'
          el.setAttribute('opacity', '1')
        } else {
          // For line noses
          el.style.fill = 'none'
          el.setAttribute('fill', 'none')
          el.style.stroke = '#000000'
          el.setAttribute('stroke', '#000000')
          el.style.strokeWidth = '1.5px'
          el.setAttribute('stroke-width', '1.5')
          el.style.strokeLinecap = 'round'
          el.setAttribute('stroke-linecap', 'round')
        }
      } else if (el.classList.contains('nose-outline-el')) {
        // For outline elements, use a darker skin tone
        const darkerSkin = '#D0B48C' // Darker version of the skin color for visual selector

        // Set outline styling
        el.style.fill = 'none'
        el.setAttribute('fill', 'none')
        el.style.stroke = darkerSkin
        el.setAttribute('stroke', darkerSkin)
        el.style.strokeWidth = '1.5px'
        el.setAttribute('stroke-width', '1.5')
      }

      // Add a head shape behind the nose for context
      if (svgContainer && !svgContainer.querySelector('.head-context')) {
        const headContext = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        headContext.setAttribute('d', 'M15,45 C15,15 85,15 85,45 S80,95 50,95 S15,75 15,45 Z')
        headContext.classList.add('head-context')
        headContext.style.fill = '#F5D5A9'
        headContext.style.opacity = '0.3'
        headContext.style.stroke = 'none'
        svgContainer.insertBefore(headContext, svgContainer.firstChild)
      }
    },
  })

  // Create visual selector for mouth shapes
  createVisualSelector('mouthShape', {
    customStyling: (el, svgContainer) => {
      if (el.classList.contains('mouth-interior-el')) {
        el.style.fill = '#B71C1C' // Dark red
        el.style.stroke = 'none'
      } else if (el.classList.contains('teeth-el')) {
        el.style.fill = 'white'
        el.style.stroke = '#000000'
        el.style.strokeWidth = '0.5px'
      } else if (el.classList.contains('mouth-el')) {
        el.style.fill = 'none'
        el.style.stroke = '#000000'
        el.style.strokeWidth = '1.5px' // Set to minimum 1.5px for consistency
        el.style.strokeLinecap = 'round'
      }

      // Add a head shape behind the mouth for context
      if (svgContainer && !svgContainer.querySelector('.head-context')) {
        const headContext = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        headContext.setAttribute('d', 'M15,45 C15,15 85,15 85,45 S80,95 50,95 S15,75 15,45 Z')
        headContext.classList.add('head-context')
        headContext.style.fill = '#F5D5A9'
        headContext.style.opacity = '0.3'
        headContext.style.stroke = 'none'
        svgContainer.insertBefore(headContext, svgContainer.firstChild)
      }
    },
  })

  // Create visual selector for facial features
  createVisualSelector('facialFeatures', {
    customStyling: (el, svgContainer) => {
      if (el.classList.contains('blush-el')) {
        el.style.fill = '#FF9E80' // Peachy blush color
        el.style.stroke = 'none'
      } else if (el.classList.contains('freckle-el')) {
        el.style.fill = '#D0B48C' // Darker skin tone
        el.style.stroke = 'none'
      } else if (el.classList.contains('scar-el')) {
        el.style.fill = 'none'
        el.style.stroke = '#D0B48C' // Darker skin tone
        el.style.strokeWidth = '1.5px'
      } else if (el.classList.contains('paint-el')) {
        el.style.fill = '#5B6ABF' // Default clothing color for war paint
        el.style.stroke = '#000000'
        el.style.strokeWidth = '0.5px'
      }

      // Add a head shape behind the facial features for context
      if (svgContainer && !svgContainer.querySelector('.head-context')) {
        const headContext = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        headContext.setAttribute('d', 'M15,45 C15,15 85,15 85,45 S80,95 50,95 S15,75 15,45 Z')
        headContext.classList.add('head-context')
        headContext.style.fill = '#F5D5A9'
        headContext.style.opacity = '0.3'
        headContext.style.stroke = 'none'
        svgContainer.insertBefore(headContext, svgContainer.firstChild)
      }
    },
  })

  // Create visual selector for accessories
  createVisualSelector('accessories', {
    customStyling: (el, svgContainer) => {
      if (el.classList.contains('glasses-el') || el.classList.contains('earring-el')) {
        el.style.fill = el.getAttribute('fill') || 'none'
        el.style.stroke = '#404040' // Dark gray for most accessories
        el.style.strokeWidth = el.getAttribute('stroke-width') || '1.5px'
      } else if (el.classList.contains('choker-el')) {
        el.style.fill = '#5B6ABF' // Default clothing color
        el.style.stroke = '#000000'
        el.style.strokeWidth = '0.5px'
      }

      // Add a head shape behind the accessories for context
      if (svgContainer && !svgContainer.querySelector('.head-context')) {
        const headContext = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        headContext.setAttribute('d', 'M15,45 C15,15 85,15 85,45 S80,95 50,95 S15,75 15,45 Z')
        headContext.classList.add('head-context')
        headContext.style.fill = '#F5D5A9'
        headContext.style.opacity = '0.3'
        headContext.style.stroke = 'none'
        svgContainer.insertBefore(headContext, svgContainer.firstChild)
      }
    },
  })

  // Create visual selector for headwear
  createVisualSelector('headwear', {
    customStyling: (el, svgContainer) => {
      if (el.classList.contains('headwear-el') || el.classList.contains('clothing-el')) {
        el.style.fill = '#5B6ABF' // Default clothing color for headwear
        el.style.stroke = '#000000'
        el.style.strokeWidth = '1px'
      }

      // Add a head shape behind the headwear for context
      if (svgContainer && !svgContainer.querySelector('.head-context')) {
        // Add head shape first
        const headContext = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        headContext.setAttribute('d', 'M15,45 C15,15 85,15 85,45 S80,95 50,95 S15,75 15,45 Z')
        headContext.classList.add('head-context')
        headContext.style.fill = '#F5D5A9'
        headContext.style.opacity = '0.3'
        headContext.style.stroke = 'none'
        svgContainer.insertBefore(headContext, svgContainer.firstChild)

        // Add hair for better context with headwear
        const hairContext = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        hairContext.classList.add('hair-context')
        // Use shortMessy hair style
        hairContext.innerHTML =
          '<path d="M25 15 L30 10 L35 18 L40 12 L45 20 L50 10 L55 20 L60 12 L65 18 L70 10 L75 15 L70 30 H30Z" class="hair-front-el"/>'

        // Style the hair
        const hairEl = hairContext.querySelector('.hair-front-el')
        if (hairEl) {
          hairEl.style.fill = '#5D4037' // Default hair color
          hairEl.style.opacity = '0.3'
          hairEl.style.stroke = 'none'
        }

        svgContainer.insertBefore(hairContext, headContext.nextSibling)
      }
    },
  })
}

// Helper function to create a visual selector for any feature
function createVisualSelector(featureName, options = {}) {
  const selector = document.getElementById(`${featureName}VisualSelector`)
  const select = document.getElementById(featureName)

  if (!selector || !select) return

  // Clear any existing content
  selector.innerHTML = ''

  // Create an option for each shape
  Object.keys(SVG_ASSETS[featureName]).forEach((shapeName) => {
    const option = document.createElement('div')
    option.className = 'visual-option'
    option.dataset.value = shapeName

    // Format the option name for the tooltip
    const formattedName = shapeName.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())

    // Add the formatted name as a data attribute for tooltip
    option.dataset.optionName = formattedName

    // Create mini SVG preview
    const svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svgContainer.setAttribute('viewBox', '0 0 100 100')
    svgContainer.setAttribute('preserveAspectRatio', 'xMidYMid meet')

    // Add the SVG content
    const svgContent = SVG_ASSETS[featureName][shapeName]
    svgContainer.innerHTML = svgContent

    // Style the SVG elements with default and custom styling
    const elements = svgContainer.querySelectorAll('*')
    elements.forEach((el) => {
      // Apply custom styling from options if provided
      if (options.customStyling) {
        options.customStyling(el, svgContainer)
      }
    })

    option.appendChild(svgContainer)
    selector.appendChild(option)

    // Add click handler
    option.addEventListener('click', () => {
      // Update all visual options
      selector.querySelectorAll('.visual-option').forEach((opt) => {
        opt.classList.remove('selected')
      })
      option.classList.add('selected')

      // Update the hidden select element
      select.value = shapeName

      // Trigger change event to update preview
      const event = new Event('change')
      select.dispatchEvent(event)
    })
  })

  // Select the current value
  const currentValue = select.value
  const currentOption = selector.querySelector(`[data-value="${currentValue}"]`)
  if (currentOption) {
    currentOption.classList.add('selected')
  } else if (selector.querySelector('.visual-option')) {
    // Select first option if none selected
    selector.querySelector('.visual-option').classList.add('selected')
  }
}

// Function to update visual selectors when values change elsewhere (like from randomize)
function updateVisualSelectors() {
  // Get all visual selectors on the page
  const visualSelectors = document.querySelectorAll('[id$="VisualSelector"]')

  visualSelectors.forEach((selector) => {
    const featureName = selector.id.replace('VisualSelector', '')
    const select = document.getElementById(featureName)

    if (select) {
      // Clear all selected states
      selector.querySelectorAll('.visual-option').forEach((opt) => {
        opt.classList.remove('selected')
      })

      // Set the selected state based on the select value
      const currentValue = select.value
      const currentOption = selector.querySelector(`[data-value="${currentValue}"]`)
      if (currentOption) {
        currentOption.classList.add('selected')
      }
    }
  })
}

// Add download functionality for the overlay download button
if (overlayDownloadBtn) {
  overlayDownloadBtn.addEventListener('click', () => {
    const svgElement = largeAvatarSVG
    if (!svgElement) {
      console.error('Large SVG element not found for download.')
      return
    }

    const brawlerName = brawlerNameInput.value.trim() || 'MyBrawler'
    // Sanitize filename: replace spaces and special characters
    const fileName = brawlerName.replace(/[^a-z0-9_]+/gi, '_').replace(/^_|_$/g, '') + '.png'

    // Options for saveSvgAsPng
    const options = {
      scale: 4, // Higher resolution for the avatar download
      backgroundColor: '#2d3748', // Set background color for the PNG
      encoderOptions: 0.95, // Higher quality for avatar
    }

    saveSvgAsPng(svgElement, fileName, options)
      .then(() => {
        console.log('PNG download initiated from overlay for:', fileName)
      })
      .catch((error) => {
        console.error('Error saving SVG as PNG from overlay:', error)
        alert('Sorry, there was an error generating the PNG. Please try again or check the console.')
      })
  })
}
