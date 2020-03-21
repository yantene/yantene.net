function clearTocCurrent() {
  for (const tocLink of Array.prototype.slice.call(document.getElementsByClassName('toc-link__current'))) {
    tocLink.classList.remove('toc-link__current')
  }
}

function updateTocCurrent(e) {
  clearTocCurrent()

  const toc = document.querySelector('.toc')

  const innerHeight = window.innerHeight
  for (const tocLink of Array.prototype.slice.call(toc.getElementsByClassName('toc-link')).reverse()) {
    const headline = document.getElementById(tocLink.getAttribute('href').slice(1))

    const headlineTop = headline.getBoundingClientRect().top
    const headlineBottom = innerHeight - headlineTop

    if (0 <= headlineBottom) {
      // 画面内または画面前方にある場合
      tocLink.classList.add('toc-link__current')

      // 画面前方にある場合
      if (0 > headlineTop) {
        // FIXME: offsetTop は未だ Working Draft
        toc.scrollTop = tocLink.offsetTop - toc.clientHeight / 2

        break
      }
    }
  }
}

for (const event of ['load', 'scroll']) {
  window.addEventListener(event, updateTocCurrent)
}
