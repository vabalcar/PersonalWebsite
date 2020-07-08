class Loader {
    constructor() {
        this._errLog = console.log;
    }

    fetchString(url) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4) {
                    return;
                }
                if (xhr.status === 200) {
                    resolve(xhr.responseText);
                } else {
                    reject(xhr.statusText);
                }
            }
            xhr.send();
        });
    }
    
    parseJSON(url, callback) {
        this.fetchString(url).then(s => JSON.parse(s)).then(o => callback(o)).catch(this._errLog);
    }
}

class WebTree {
    constructor(webTreeBase) {
        this._lastNodeId = 0;
        
        this._root = webTreeBase;
        this._root.parent = null;
        this._completeNodes(this._root);
    }

    get root() {
        return this._root;
    }
    
    _completeNodes(webTreeRoot) {
        webTreeRoot.nodeId = this._lastNodeId;
        ++this._lastNodeId;

        webTreeRoot.path = webTreeRoot.parent ? `${webTreeRoot.parent.path}/${webTreeRoot.folder}/` : `${window.location.origin}${window.location.pathname}${webTreeRoot.folder}/`;
        
        if (!webTreeRoot.children) {
            return;
        }
        
        webTreeRoot.children.forEach(child => {
            if (!child.parent) {
                child.parent = webTreeRoot;
            }
            if (!child.children) {
                child.children = [];
            }
            this._completeNodes(child);
        });
    }

    forEach(webTreeRoot, f) {
        f(webTreeRoot);
        webTreeRoot.children.forEach(child => forEach(child, f));
    }

    forEach(f) {
        forEach(this.root, f);
    }
}

class CacheRecord {
    constructor() {
        this._listeners = new Map();
    }
    get title() {
        return this._title;
    }
    set title(value) {
        this._title = value;
    }
    get menuView() {
        return this._menuView;
    }
    set menuView(value) {
        this._menuView = value;
    }
    get contentView() {
        return this._contentView;
    }
    set contentView(value) {
        this._contentView = value;
    }
    get listeners() {
        return this._listeners;
    }
}

class WebView {
    constructor(loader) {
        this._loader = loader;

        this._cache = new Map();
        this._controller = null;
        this._nextMenuItemId = 0;
        this._menuIdPrefix = 'menu-item-';

        this._pageBody = document.getElementsByTagName('body')[0];
        
        this._pageBody.innerHTML += '<span id="title"></span>';
        this._pageBody.innerHTML += '<ul id="menu"></ul>';
        this._pageBody.innerHTML += '<div id="content"></div>';
        
        this._currentTitleView = document.getElementById('title');
        this._currentMenuView = document.getElementById('menu');
        this._currentContentView = document.getElementById('content');
    }

    get controller() {
        return this._controller;
    }

    set controller(value) {
        this._controller = value;
    }

    _createTitle(webTreeNode, cacheRecord) {
        cacheRecord.title = `<h1>${webTreeNode.title}</h1>`;
    }

    _createMenu(webTreeNode, cacheRecord) {
        const firstNewContentId = this._nextMenuItemId;
        
        cacheRecord.menuView = '';

        webTreeNode.children.forEach(item => {
            cacheRecord.menuView += `<li id="${this._menuIdPrefix}${this._nextMenuItemId}"><span> > ${item.title}</span></li>`;
            ++this._nextMenuItemId;
        });

        const lastNewContentId = this._nextMenuItemId - 1;

        if (webTreeNode.parent) {
            cacheRecord.menuView += `<li id="${this._menuIdPrefix}${this._nextMenuItemId}"><span> < Back</span></li>`;
            ++this._nextMenuItemId;
        }

        if (this._nextMenuItemId > firstNewContentId) {
            for (let id = firstNewContentId; id <= lastNewContentId; ++id) {
                const fullId = `${this._menuIdPrefix}${id}`;
                const callback = () => this.controller.moveForward(id - firstNewContentId);
                cacheRecord.listeners.set(fullId, callback);
            }

            if (webTreeNode.parent) {
                const fullId = `${this._menuIdPrefix}${lastNewContentId + 1}`;
                const callback = () => this.controller.moveBackward();
                cacheRecord.listeners.set(fullId, callback);
            }
        }
    }

    _registerListeners(cacheRecord) {
        cacheRecord.listeners.forEach((callback, id)  => {
            document.getElementById(id).addEventListener('click', callback);
        });
    }

    _getCacheRecord(webTreeNode) {
        let cacheRecord;
        if (!this._cache.has(webTreeNode.nodeId)) {
            cacheRecord = new CacheRecord();
            this._createTitle(webTreeNode, cacheRecord);
            this._createMenu(webTreeNode, cacheRecord);
        } else {
            cacheRecord = this._cache.get(webTreeNode.nodeId);
        }
        return cacheRecord;
    }

    _drawTitle(webTreeNode) {
        const cacheRecord = this._getCacheRecord(webTreeNode);
        this._currentTitleView.innerHTML = cacheRecord.title;
    }

    _drawMenu(webTreeNode) {
        const cacheRecord = this._getCacheRecord(webTreeNode);
        this._currentMenuView.innerHTML = cacheRecord.menuView;
        this._registerListeners(cacheRecord);
    }

    _doDrawContent(content) {
        this._currentContentView.innerHTML = content;
    }

    _drawContent(webTreeNode) {
        if (!webTreeNode.content) {
            this._currentContentView.innerHTML = '';
            return;
        }

        const cacheRecord = this._getCacheRecord(webTreeNode);
        if (!cacheRecord.contentView) {
            this._loader
                .fetchString(`${webTreeNode.path}${webTreeNode.content}`)
                .then(content => {
                    cacheRecord.contentView = content;
                    this._doDrawContent(content);
                });
        } else {
            this._doDrawContent(cacheRecord.contentView);
        }
    }

    visualize(webTreeNode) {
        this._drawTitle(webTreeNode);
        this._drawMenu(webTreeNode);
        this._drawContent(webTreeNode);
    }
}

class WebController {
    constructor(webTree, view) {
        this._webTree = webTree;
        this._position = this._webTree.root;

        this._view = view;
        this._view.controller = this;
        this._updateView();
    }

    _updateView() {
        this._view.visualize(this._position);
    }

    moveForward(i) {
        if (this._position.children && this._position.children.length > i) {
            this._position = this._position.children[i];
            this._updateView();
        }
    }

    moveBackward() {
        if (this._position.parent) {
            this._position = this._position.parent;
            this._updateView();
        }
    }
}