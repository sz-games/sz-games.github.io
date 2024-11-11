function openInUnblocked(url)
{var myWindow=window.open("","_blank");myWindow.document.write("<title>Google</title><link rel=\"icon\" type=\"image/x-icon\" href=\"https://www.google.com/favicon.ico\">")
myWindow.document.write("<iframe onload=\"\" id='iframe' width=\"100%\" height=\"100%\" style=\"border:none;\"></iframe>");myWindow.document.write("<script>setTimeout(function() {document.getElementById('iframe').src = \""+url+"\"}, 500);</script>")
myWindow.document.write("<style>body { margin:0;}</style>")
myWindow.document.write("<script>function home(){document.getElementById('iframe').src = \""+url+"\"}</script>")
myWindow.document.close();myWindow.stop();window.location.replace('https://google.com');}
function check(elem) {
    var platformdiv =  document.getElementById('emulatorQuestion') 
    var select =  document.getElementById('select') 
    var link =  document.getElementById('link') 
    if (elem.value == 'emulator') {
        platformdiv.style.display = "block";
        select.setAttribute('required', '');
        link.style.display = "none";
    console.log('emulator') 
    } else {
        platformdiv.style.display = "none";
        select.removeAttribute('required', '');
        link.style.display = "block";
    }
}
const info = []
const container = document.querySelector('.results');


const buttons = container.getElementsByTagName('button');
for (let i = 0; i < buttons.length; i++) {
    // Get the current button element
    const button = buttons[i];
    const img = button.getElementsByTagName('img');
  data = {}

  data["onclick"] = button.getAttribute("onclick")
  data["title"] = button.innerText
  data["category"] = button.className.split(' ')
  data["imgsrc"] = img.getAttribute('data-src')

  info.push(data)
}
console.log(info)
