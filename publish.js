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

function getBannerInfo(fm) {
  const text = fm.textContent || "";
  const match = text.match(/banner:\s*(.+)/);
  if (!match) return null;

  const path = match[1].trim().replace(/^["']|["']$/g, "").replace(/^\[\[|\]\]$/g, "");
  const heightMatch = text.match(/banner-height:\s*(\d+)/);
  const yMatch = text.match(/banner_y:\s*([\d.]+)/);

  return {
    path,
    height: heightMatch ? heightMatch[1] : "200",
    ypos: yMatch ? yMatch[1] : "50",
  };
}

function insertBanner() {
  var fm = document.querySelector(".frontmatter");
  document.querySelectorAll(".publish-banner").forEach((banner) => {
    if (!fm || banner.dataset.page !== window.location.pathname) banner.remove();
  });
  if (!fm) return;

  var info = getBannerInfo(fm);
  if (!info) return;

  var current = document.querySelector(".publish-banner");
  if (current && current.dataset.src === info.path) return;
  if (current) current.remove();

  var img = document.createElement("img");
  img.className = "publish-banner";
  img.dataset.page = window.location.pathname;
  img.dataset.src = info.path;
  img.src = "https://publish-01.obsidian.md/access/cc4279b5ea98c87259c868da91291e6f/" + encodeURI(info.path);
  img.style.cssText = "height:" + info.height + "px;object-fit:cover;object-position:center " + info.ypos + "%;border-radius:8px;margin-bottom:16px";

  fm.insertAdjacentElement("afterend", img);
}

function init() {
  insertSwitcher();
  hideLanguageFolders();
  insertBanner();

  const observer = new MutationObserver(() => {
    if (!document.querySelector(".lang-switcher")) {
      insertSwitcher();
    }
    hideLanguageFolders();
    insertBanner();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
