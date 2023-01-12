import { openLink, hotKeys, imageParser, toolbar, autoSymbal, onToolbarClick, createContextMenu, scrollEditor } from "./util.js";

handler.on("open", (md) => {
  const { config, language } = md;
  if (config.autoTheme) {
    addAutoTheme(md.rootPath)
  }
  window.mdContent = md.content
  window.editor = new Vditor('vditor', {
    value: md.content,
    cdn: "",
    height: document.documentElement.clientHeight,
    outline: {
      enable: config.openOutline,
      position: 'left',
    },
    mode: 'ir',
    lang: language == 'zh-cn' ? 'zh_CN' : config.editorLanguage,
    icon: "material",
    tab: '\t',
    preview: {
      theme: {
        path: `${md.rootPath}/css/content-theme`
      },
      extPath: md.rootPath,
    },
    toolbar,
    extPath: md.rootPath,
    input(content) {
      handler.emit("save", content)
    },
    upload: {
      url: '/image',
      accept: 'image/*',
      handler(files) {
        let reader = new FileReader();
        reader.readAsBinaryString(files[0]);
        reader.onloadend = () => {
          handler.emit("img", reader.result)
        };
      }
    },
    hint: {
      emoji: {},
      extend: hotKeys
    }, 
    after() {
      window.editor.setValue(md.content,true)
      handler.on("update", content => {
        window.editor.setValue(content);
      })
      openLink()
      onToolbarClick(window.editor)
    }
  })
  autoSymbal(window.editor);
  createContextMenu(window.editor)
  imageParser(config.viewAbsoluteLocal)
  scrollEditor(md.scrollTop)
}).emit("init")

function addAutoTheme(rootPath) {
  const style = document.createElement('link');
  style.rel = "stylesheet";
  style.type = "text/css";
  style.href = `${rootPath}/css/theme.css`;
  document.documentElement.appendChild(style)
}

