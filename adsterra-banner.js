;(function () {
  var box = document.getElementById('adsterra-banner-728x90')
  if (!box) return
  var key = '5ee99841a6801f0f3742958ab80c87bb'
  var width = 728
  var height = 90

  function inject() {
    if (window.innerWidth < width) return
    box.style.display = 'block'
    var iframe = document.createElement('iframe')
    iframe.width = width
    iframe.height = height
    iframe.setAttribute('frameborder', '0')
    iframe.setAttribute('scrolling', 'no')
    iframe.style.cssText = 'border:none;display:block;margin:0 auto;padding:0'
    iframe.srcdoc =
      '<style>body{margin:0;padding:0;overflow:hidden}</style>' +
      "<script>atOptions={key:'" + key + "',format:'iframe',height:" + height + ',width:' + width + ',params:{}};<\/script>' +
      "<script src='https://cutleryneighbouringpurpose.com/" + key + "/invoke.js'><\/script>"
    box.appendChild(iframe)
  }

  window.addEventListener('load', function () {
    setTimeout(inject, 3000)
  })
})()
