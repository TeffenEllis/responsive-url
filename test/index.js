function makeResponsiveURLs (node) {
  var url = node.getAttribute('data-url')
  var newURL = url
  var maxLength = url.length
  var width = node.clientWidth
  var rightPadding = parseInt(window.getComputedStyle(node).paddingRight, 10)

  node.textContent = url
  while (node.scrollWidth - rightPadding > width) {
    maxLength -= 1
    newURL = window.ResponsiveURL.truncateURL(url, maxLength)
    node.textContent = newURL
  }
}

function throttle (fn, timeout) {
  return function throttledFn () {
    if (!throttledFn.timer) {
      var args = arguments
      var that = this

      throttledFn.timer = setTimeout(function () {
        fn.apply(that, args)

        throttledFn.timer = undefined
      }, timeout)
    }
  }
}

function init () {
  document.querySelectorAll('div[data-url]').forEach(function (div) {
    makeResponsiveURLs(div)
  })
}

init()
window.addEventListener('resize', throttle(init, 100))
