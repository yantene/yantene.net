function clearTocCurrent() {
    for (const tocLink of Array.prototype.slice.call(document.getElementsByClassName('toc-link__current'))) {
        tocLink.classList.remove('toc-link__current');
    }
}
function updateTocCurrent(e) {
    clearTocCurrent();
    const toc = document.querySelector('.toc');
    const innerHeight = window.innerHeight;
    for (const tocLink of Array.prototype.slice.call(toc.getElementsByClassName('toc-link')).reverse()) {
        const headline = document.getElementById(tocLink.getAttribute('href').slice(1));
        const headlineTop = headline.getBoundingClientRect().top;
        const headlineBottom = innerHeight - headlineTop;
        if (0 <= headlineBottom) {
            tocLink.classList.add('toc-link__current');
            if (0 > headlineTop) {
                toc.scrollTop = tocLink.offsetTop - toc.clientHeight / 2;
                break;
            }
        }
    }
}
for (const event of ['load', 'scroll']) {
    window.addEventListener(event, updateTocCurrent);
}
