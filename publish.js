// Language switcher for Obsidian Publish

const LANGUAGES = [
  { code: "zh", label: "中文", folder: "zh" },
  { code: "en", label: "English", folder: "en" },
];

const FILE_MAP = {
  zh: {
    "教程/Ball的仿真，验证，评估": "tutorial/ball-sim-verify-eval",
    "教程/什么是Ball & 如何写一个Ball": "tutorial/what-is-ball-and-how-to-write-one",
    "教程/仓库概览与环境搭建": "tutorial/repo-overview-and-setup",
    "教程/端到端实现 LeNet 加速 (上)": "tutorial/e2e-lenet-accel-part1",
    "教程/端到端实现 LeNet 加速 (中)": "tutorial/e2e-lenet-accel-part2",
    "教程/端到端实现 LeNet 加速 (下)": "tutorial/e2e-lenet-accel-part3",
    "设计文档/Overview": "design/overview",
    "设计文档/主线架构/0.0.1/boot流程/Overview": "design/main-arch/0.0.1/boot-flow/overview",
    "设计文档/主线架构/0.0.1/frontend/前端域架构": "design/main-arch/0.0.1/frontend/frontend",
    "设计文档/主线架构/0.0.1/Overview/images/riscv-isa": "design/main-arch/0.0.1/overview/images/riscv-isa",
    "设计文档/主线架构/0.0.1/Overview/ISA": "design/main-arch/0.0.1/overview/ISA",
    "设计文档/主线架构/0.0.1/Overview/Overview": "design/main-arch/0.0.1/overview/overview",
    "设计文档/主线架构/0.0.1/工具链/Overview": "design/main-arch/0.0.1/toolchain/overview",
    "设计文档/主线架构/0.0.1/工具链/bebop-bemu": "design/main-arch/0.0.1/toolchain/bebop-bemu",
    "设计文档/主线架构/0.0.1/工具链/bebop-verilator": "design/main-arch/0.0.1/toolchain/bebop-verilator",
    "设计文档/主线架构/0.0.1/工具链/compiler": "design/main-arch/0.0.1/toolchain/compiler",
    "设计文档/主线架构/0.0.1/工具链/images/kernel": "design/main-arch/0.0.1/toolchain/images/kernel",
    "设计文档/主线架构/0.0.1/工具链/kernel": "design/main-arch/0.0.1/toolchain/kernel",
    "设计文档/主线架构/0.0.1/工具链/workload": "design/main-arch/0.0.1/toolchain/workload",
    "设计文档/主线架构/0.0.1/编译器/Dialect": "design/main-arch/0.0.1/compiler/Dialect",
    "设计文档/主线架构/0.0.1/编译器/Overview": "design/main-arch/0.0.1/compiler/overview",
    "设计文档/主线架构/0.0.1/编译器/Pass/assign-physical-banks": "design/main-arch/0.0.1/compiler/Pass/assign-physical-banks",
    "设计文档/主线架构/0.0.1/编译器/Pass/convert-linalg-to-tile": "design/main-arch/0.0.1/compiler/Pass/convert-linalg-to-tile",
    "设计文档/主线架构/0.0.1/编译器/Pass/convert-tile-to-buckyball": "design/main-arch/0.0.1/compiler/Pass/convert-tile-to-buckyball",
    "设计文档/主线架构/0.0.1/编译器/Pass/lower-bank-ssa-to-intrinsics": "design/main-arch/0.0.1/compiler/Pass/lower-bank-ssa-to-intrinsics",
    "设计文档/主线架构/0.0.1/编译器/Pass/lower-buckyball": "design/main-arch/0.0.1/compiler/Pass/lower-buckyball",
    "设计文档/主线架构/0.0.1/编译器/Pass/lower-buckyball-to-bank-ssa": "design/main-arch/0.0.1/compiler/Pass/lower-buckyball-to-bank-ssa",
    "设计文档/主线架构/0.0.1/编译器/Pass/report-bank-usage": "design/main-arch/0.0.1/compiler/Pass/report-bank-usage",
    "设计文档/具体芯片/pebble/ISA": "design/chips/pebble/ISA",
    "设计文档/具体芯片/pebble/Overview": "design/chips/pebble/overview",
    "设计文档/具体芯片/pebble/Transpose Ball/Spec": "design/chips/pebble/transpose-ball/spec",
    "设计文档/具体芯片/pebble/Quant Ball/Spec": "design/chips/pebble/quant-ball/spec",
    "设计文档/具体芯片/pebble/SystolicArray Ball/Spec": "design/chips/pebble/systolic-array-ball/spec",
    "设计文档/具体芯片/pebble/流片/images/进度": "design/chips/pebble/tapeout/images/progress",
    "设计文档/具体芯片/pebble/流片/流片进度": "design/chips/pebble/tapeout/progress",
  },
  en: {
    "tutorial/ball-sim-verify-eval": "教程/Ball的仿真，验证，评估",
    "tutorial/what-is-ball-and-how-to-write-one": "教程/什么是Ball & 如何写一个Ball",
    "tutorial/repo-overview-and-setup": "教程/仓库概览与环境搭建",
    "tutorial/e2e-lenet-accel-part1": "教程/端到端实现 LeNet 加速 (上)",
    "tutorial/e2e-lenet-accel-part2": "教程/端到端实现 LeNet 加速 (中)",
    "tutorial/e2e-lenet-accel-part3": "教程/端到端实现 LeNet 加速 (下)",
    "design/overview": "设计文档/Overview",
    "design/main-arch/0.0.1/boot-flow/overview": "设计文档/主线架构/0.0.1/boot流程/Overview",
    "design/main-arch/0.0.1/frontend/frontend": "设计文档/主线架构/0.0.1/frontend/前端域架构",
    "design/main-arch/0.0.1/overview/images/riscv-isa": "设计文档/主线架构/0.0.1/Overview/images/riscv-isa",
    "design/main-arch/0.0.1/overview/ISA": "设计文档/主线架构/0.0.1/Overview/ISA",
    "design/main-arch/0.0.1/overview/overview": "设计文档/主线架构/0.0.1/Overview/Overview",
    "design/main-arch/0.0.1/toolchain/overview": "设计文档/主线架构/0.0.1/工具链/Overview",
    "design/main-arch/0.0.1/toolchain/bebop-bemu": "设计文档/主线架构/0.0.1/工具链/bebop-bemu",
    "design/main-arch/0.0.1/toolchain/bebop-verilator": "设计文档/主线架构/0.0.1/工具链/bebop-verilator",
    "design/main-arch/0.0.1/toolchain/compiler": "设计文档/主线架构/0.0.1/工具链/compiler",
    "design/main-arch/0.0.1/toolchain/images/kernel": "设计文档/主线架构/0.0.1/工具链/images/kernel",
    "design/main-arch/0.0.1/toolchain/kernel": "设计文档/主线架构/0.0.1/工具链/kernel",
    "design/main-arch/0.0.1/toolchain/workload": "设计文档/主线架构/0.0.1/工具链/workload",
    "design/main-arch/0.0.1/compiler/Dialect": "设计文档/主线架构/0.0.1/编译器/Dialect",
    "design/main-arch/0.0.1/compiler/overview": "设计文档/主线架构/0.0.1/编译器/Overview",
    "design/main-arch/0.0.1/compiler/Pass/assign-physical-banks": "设计文档/主线架构/0.0.1/编译器/Pass/assign-physical-banks",
    "design/main-arch/0.0.1/compiler/Pass/convert-linalg-to-tile": "设计文档/主线架构/0.0.1/编译器/Pass/convert-linalg-to-tile",
    "design/main-arch/0.0.1/compiler/Pass/convert-tile-to-buckyball": "设计文档/主线架构/0.0.1/编译器/Pass/convert-tile-to-buckyball",
    "design/main-arch/0.0.1/compiler/Pass/lower-bank-ssa-to-intrinsics": "设计文档/主线架构/0.0.1/编译器/Pass/lower-bank-ssa-to-intrinsics",
    "design/main-arch/0.0.1/compiler/Pass/lower-buckyball": "设计文档/主线架构/0.0.1/编译器/Pass/lower-buckyball",
    "design/main-arch/0.0.1/compiler/Pass/lower-buckyball-to-bank-ssa": "设计文档/主线架构/0.0.1/编译器/Pass/lower-buckyball-to-bank-ssa",
    "design/main-arch/0.0.1/compiler/Pass/report-bank-usage": "设计文档/主线架构/0.0.1/编译器/Pass/report-bank-usage",
    "design/chips/pebble/ISA": "设计文档/具体芯片/pebble/ISA",
    "design/chips/pebble/overview": "设计文档/具体芯片/pebble/Overview",
    "design/chips/pebble/transpose-ball/spec": "设计文档/具体芯片/pebble/Transpose Ball/Spec",
    "design/chips/pebble/quant-ball/spec": "设计文档/具体芯片/pebble/Quant Ball/Spec",
    "design/chips/pebble/systolic-array-ball/spec": "设计文档/具体芯片/pebble/SystolicArray Ball/Spec",
    "design/chips/pebble/tapeout/images/progress": "设计文档/具体芯片/pebble/流片/images/进度",
    "design/chips/pebble/tapeout/progress": "设计文档/具体芯片/pebble/流片/流片进度",
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
