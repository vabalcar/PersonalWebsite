var controller;

window.addEventListener('load', () => {
    let loader = new Loader();
    loader.parseJSON('webmaps/webMap.json', webTreeBase => {
        controller = new WebController(new WebTree(webTreeBase), new WebView(loader));
    });
});

//document.getElementsByTagName('html')[0].style.setProperty('--fg-color', 'pink');