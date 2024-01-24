import "@logseq/libs"
import { isElement } from "./libs/utils"
// import { setup } from "logseq-l10n"
// import zhCN from "./translations/zh-CN.json"

async function main() {
  // await setup({ builtinTranslations: { "zh-CN": zhCN } })

  injectDeps()

  provideStyles()

  const appContainer = parent.document.getElementById(
    "app-container",
  ) as HTMLElement
  appContainer.addEventListener("mousedown", editBtnClickHandler)

  logseq.beforeunload(async () => {
    appContainer.removeEventListener("mousedown", editBtnClickHandler)
  })

  console.log("#math-editor loaded")
}

function provideStyles() {
  logseq.provideStyle({
    key: "kef-math-ed",
    style: `
    .latex {
      position: relative;
    }
    .latex:has(> span:only-child):hover::after {
      display: block;
      content: "\\eb04";
      font-family: tabler-icons;
      font-size: 1.1em;
      color: var(--ls-active-primary-color);
      position: absolute;
      top: 50%;
      right: 5px;
      translate: 0 -50%;
      cursor: pointer;
    }
    .latex-inline:has(> span:only-child):hover::after {
      content: "\\eb04";
      font-family: tabler-icons;
      color: var(--ls-active-primary-color);
      cursor: pointer;
      margin-left: 5px;
      vertical-align: bottom;
    }

    math-field::part(menu-toggle) {
      display: none;
    }
    .kef-me-editor-block-container {
      display: flex;
      align-items: center;
    }
    .kef-me-editor-inline-container {
      display: inline-flex;
      align-items: center;
    }
    .kef-me-editor-block {
      display: block;
      font-size: 1.2em;
      flex: 1;
      margin-right: 10px;
    }
    .kef-me-editor-block::part(content) {
      display: block;
      text-align: center;
    }
    .kef-me-editor-inline {
      margin-right: 10px;
    }
    `,
  })
}

function injectDeps() {
  const base = getBase(document.baseURI)
  const js = `${base}/mathlive.min.js`
  if (!parent.document.body.querySelector(`script[src="${js}"]`)) {
    const script = parent.document.createElement("script")
    script.src = js
    parent.document.body.append(script)
  }
}

function getBase(uri: string) {
  const index = document.baseURI.lastIndexOf("/")
  if (index > -1) {
    return uri.substring(0, index)
  }
  return uri
}

function editBtnClickHandler(e: MouseEvent) {
  if (!isElement(e.target)) return

  const target = e.target
  const rect = target.getBoundingClientRect()
  const h = rect.x + rect.width
  const v = rect.y + rect.height

  if (
    target.classList.contains("latex") &&
    e.clientX >= h - 5 - 18 &&
    e.clientX <= h &&
    e.clientY >= rect.y &&
    e.clientY <= v
  ) {
    e.preventDefault()
    e.stopPropagation()

    const katexEl = target.querySelector(".katex-display")
    if (isElement(katexEl)) {
      katexEl.style.display = "none"
    }
    const id = target.id
    const oldValue = target.querySelector("annotation")!.textContent ?? ""
    logseq.provideUI({
      key: `kef-me-${id}`,
      path: `[id="${id}"]`,
      template: `<div id="kef-me-${id}" class="kef-me-editor-block-container">
        <button class="ui__button ui__button-theme-color ui__button-depth-1 ui__button-color-cyan ui__button-size-md" data-on-click="editBlock" data-id="kef-me-${id}" data-old-value="${oldValue}">OK</button>
      </div>`,
    })
    setTimeout(() => {
      initEditor(id, oldValue, "kef-me-editor-block")
    }, 0)
  } else if (
    target.classList.contains("latex-inline") &&
    e.clientX >= h - 16 &&
    e.clientX <= h &&
    e.clientY >= rect.y &&
    e.clientY <= v
  ) {
    e.preventDefault()
    e.stopPropagation()

    const katexEl = target.querySelector(".katex")
    if (isElement(katexEl)) {
      katexEl.style.display = "none"
    }
    const id = target.id
    const oldValue = target.querySelector("annotation")!.textContent ?? ""
    logseq.provideUI({
      key: `kef-me-${id}`,
      path: `[id="${id}"]`,
      template: `<span id="kef-me-${id}" class="kef-me-editor-inline-container">
        <button class="ui__button ui__button-theme-color ui__button-depth-1 ui__button-color-cyan ui__button-size-md" data-on-click="editBlock" data-id="kef-me-${id}" data-old-value="${oldValue}">OK</button>
      </span>`,
      style: {
        display: "inline",
      },
    })
    setTimeout(() => {
      initEditor(id, oldValue, "kef-me-editor-inline")
    }, 0)
  }
}

function stopHandler(e: Event) {
  e.stopPropagation()
}

function initEditor(id: string, oldValue: string, cls: string) {
  const containerEl = parent.document.getElementById(`kef-me-${id}`)!
  containerEl.addEventListener("keydown", stopHandler)
  containerEl.addEventListener("mousedown", stopHandler)

  const mfe = new (parent as any).MathfieldElement()
  mfe.value = oldValue
  mfe.classList.add(cls)
  containerEl.prepend(mfe)
  mfe.menuItems = []
  mfe.inlineShortcuts.dx.value = "\\mathrm{d}x"
  mfe.inlineShortcuts.dy.value = "\\mathrm{d}y"
  mfe.inlineShortcuts.dt.value = "\\mathrm{d}t"
  mfe.keybindings = [
    ...mfe.keybindings,
    {
      key: "ctrl+,",
      ifMode: "math",
      command: "addColumnAfter",
    },
    {
      key: "ctrl+shift+,",
      ifMode: "math",
      command: "addColumnBefore",
    },
  ]
  mfe.focus()
}

async function updateMath(id: string, oldValue: string) {
  const containerEl = parent.document.getElementById(id)
  if (containerEl == null) return
  containerEl.removeEventListener("keydown", stopHandler)
  containerEl.removeEventListener("mousedown", stopHandler)

  const blockUUID = containerEl.closest("[blockid]")?.getAttribute("blockid")
  if (!blockUUID) return
  const block = await logseq.Editor.getBlock(blockUUID)
  if (block == null) return
  const mfe = containerEl.querySelector("math-field") as any
  if (mfe == null) return

  if (oldValue === mfe.value) {
    const katexEl = containerEl.parentElement!.previousElementSibling
    if (isElement(katexEl)) {
      katexEl.style.display = ""
    }
    containerEl.parentElement!.remove()
    return
  }

  const newContent = block.content.replace(`$${oldValue}$`, `$${mfe.value}$`)
  await logseq.Editor.updateBlock(blockUUID, newContent)
}

const model = {
  async editBlock(e: any) {
    const id = e.dataset.id
    const oldValue = e.dataset.oldValue
    await updateMath(id, oldValue)
  },
}

logseq.ready(model, main).catch(console.error)
