// Language switcher for Obsidian Publish

const LANGUAGES = [
  { code: "zh", label: "中文", folder: "zh" },
  { code: "en", label: "English", folder: "en" },
];

const FILE_MAP = {
  zh: {
    "教程/仓库概览与环境搭建": "tutorial/repo-overview-and-setup",
    "设计文档/主线架构/0.0.1/0_Overview/0_Overview": "design/main-arch/0.0.1/overview/overview",
    "设计文档/主线架构/0.0.1/0_Overview/1_ISA": "design/main-arch/0.0.1/overview/ISA",
    "设计文档/主线架构/0.0.1/1_boot流程/Overview": "design/main-arch/0.0.1/boot-flow/overview",
    "设计文档/主线架构/0.0.1/2_frontend/frontend": "design/main-arch/0.0.1/frontend/frontend",
    "设计文档/主线架构/0.0.1/编译器/编译器": "design/main-arch/0.0.1/compiler/compiler",
    "设计文档/具体芯片/pebble/0_Overview": "design/chips/pebble/overview",
    "设计文档/具体芯片/pebble/1_ISA": "design/chips/pebble/ISA",
  },
  en: {
    "tutorial/repo-overview-and-setup": "教程/仓库概览与环境搭建",
    "design/main-arch/0.0.1/overview/overview": "设计文档/主线架构/0.0.1/0_Overview/0_Overview",
    "design/main-arch/0.0.1/overview/ISA": "设计文档/主线架构/0.0.1/0_Overview/1_ISA",
    "design/main-arch/0.0.1/boot-flow/overview": "设计文档/主线架构/0.0.1/1_boot流程/Overview",
    "design/main-arch/0.0.1/frontend/frontend": "设计文档/主线架构/0.0.1/2_frontend/frontend",
    "design/main-arch/0.0.1/compiler/compiler": "设计文档/主线架构/0.0.1/编译器/编译器",
    "design/chips/pebble/overview": "设计文档/具体芯片/pebble/0_Overview",
    "design/chips/pebble/ISA": "设计文档/具体芯片/pebble/1_ISA",
  },
};

function detectCurrentLang() {
  const path = decodeURIComponent(window.location.pathname.replace(/^\//, ""));
  for (const lang of LANGUAGES) {
    if (path.startsWith(lang.folder + "/")) return lang.code;
  }
  return "zh";
}

function getCounterpartPath(fromLang) {
  const path = decodeURIComponent(window.location.pathname.replace(/^\//, ""));
  const prefix = fromLang + "/";
  if (!path.startsWith(prefix)) return null;

  const subPath = path.slice(prefix.length);
  const toLang = fromLang === "zh" ? "en" : "zh";
  const map = FILE_MAP[fromLang];

  if (map && map[subPath]) {
    return toLang + "/" + map[subPath];
  }
  return toLang + "/" + subPath;
}

function insertSwitcher() {
  if (document.querySelector(".lang-switcher")) return;

  const container = document.createElement("div");
  container.className = "lang-switcher";

  const globe = document.createElement("span");
  globe.className = "lang-switcher-icon";
  globe.textContent = "\u{1F310}";
  container.appendChild(globe);

  const select = document.createElement("select");
  select.className = "lang-switcher-select";

  const currentLang = detectCurrentLang();

  for (const lang of LANGUAGES) {
    const option = document.createElement("option");
    option.value = lang.code;
    option.textContent = lang.label;
    if (lang.code === currentLang) option.selected = true;
    select.appendChild(option);
  }

  select.addEventListener("change", (e) => {
    const targetLang = e.target.value;
    if (targetLang === currentLang) return;

    const counterpart = getCounterpartPath(currentLang);
    if (counterpart) {
      window.location.pathname = "/" + encodeURI(counterpart);
    } else {
      window.location.pathname = "/" + targetLang + "/";
    }
  });

  container.appendChild(select);

  const target = document.querySelector(".site-body-left-column-site-name");
  if (target) {
    target.insertAdjacentElement("afterend", container);
    return;
  }

  document.body.prepend(container);
}

function hideLanguageFolders() {
  const currentLang = detectCurrentLang();
  const otherLang = currentLang === "zh" ? "en" : "zh";

  document.querySelectorAll(".nav-folder-title, .tree-item-inner").forEach((el) => {
    const text = el.textContent.trim();
    if (text === otherLang) {
      const folder = el.closest(".nav-folder") || el.closest(".tree-item");
      if (folder) folder.style.display = "none";
    }
    if (text === currentLang) {
      const folder = el.closest(".nav-folder") || el.closest(".tree-item");
      if (folder) {
        const title = folder.querySelector(":scope > .nav-folder-title, :scope > .tree-item-self");
        if (title) title.style.display = "none";
      }
    }
  });
}

function init() {
  insertSwitcher();
  hideLanguageFolders();

  const observer = new MutationObserver(() => {
    if (!document.querySelector(".lang-switcher")) {
      insertSwitcher();
    }
    hideLanguageFolders();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
