document.onscroll = e => {
    document.querySelectorAll('.toc-link__current').forEach(tocLink => {
        tocLink.classList.remove('toc-link__current');
    });
    const toc = document.querySelector('.toc');
    const innerHeight = window.innerHeight;
    for (const tocLink of Array.from(toc.querySelectorAll('.toc-link')).reverse()) {
        const headline = document.querySelector(tocLink.getAttribute('href'));
        const headlineTop = headline.getBoundingClientRect().top;
        const headlineBottom = innerHeight - headlineTop;
        if (0 > headlineBottom) {
        }
        else {
            tocLink.classList.add('toc-link__current');
            if (0 > headlineTop) {
                toc.scrollTop = tocLink.offsetTop - toc.clientHeight / 2;
                break;
            }
        }
    }
};
