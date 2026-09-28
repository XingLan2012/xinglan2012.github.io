/* 诗云 · 更新预告横幅 — announce-202607.js
 *
 * 纯 ES5、单个 IIFE、全身 try/catch:这段脚本会被运维上传到 prod dist 根目录,并在
 * 【旧版】index.html 的 </body> 前手动注入 <script src="/announce-202607.js" defer></script>。
 * 它跑在没有本站任何 CSS/JS 依赖的环境里,唯一职责是弹一条一次性横幅——所以它出任何岔子都
 * 必须静默、绝不能影响主站(星图不能因为一条横幅黑屏)。写法刻意对齐 index.html 里 capability
 * gate 那段:ES5 是因为要在比主 bundle 更宽的浏览器面上活着;注释只写代码本身看不出来的约束。
 *
 * 下架方式见 docs/devlog/DEPLOY-ANNOUNCE-2026-07.md:7/23 部署新 dist 时,新 index.html 天然
 * 没有那行注入,横幅随之消失;下面的过期时间戳只是「忘了下架」时的自杀兜底。
 */
(function () {
  try {
    // 幂等守卫:注入行若被跑了两次(sed 重复注入),第二次执行时横幅已在 DOM 里 → 直接返回,
    // 永不叠出第二条横幅 / 第二个 keydown 监听 / 第二次占位。配合 runbook 的注入前 grep 双保险。
    var BAR_ID = "shiyun-announce-202607";
    if (document.getElementById(BAR_ID)) return;
    var STYLE_ID = "shiyun-announce-202607-style";
    var HUD_VAR = "--shiyun-ann-h"; // 横幅实测高度,喂给下面注入的样式把主站顶部导航整体下推
    var PRE_KEY = "shiyun_announce_202607_pre"; // localStorage 记「已知道了」;隐私模式读写都会抛,故全包 try/catch
    // 过期自杀保险丝:晚于该 UTC 时刻一律不渲染。7/23 更新正常部署后注入行会随 index.html 消失,
    // 这个时间戳只在「新 dist 部署了但忘了此脚本还挂着」的情况下兜底,让它自己闭嘴。
    var EXPIRE_MS = Date.UTC(2026, 6, 31, 16, 0, 0); // 2026-07-31T16:00:00Z(月份 0 基,6=七月)

    // ── 出场守卫:任一命中即彻底不渲染 ──────────────────────────────────────────
    // 1) capability gate 已判定此浏览器跑不动主站 → 别在报错页上再叠横幅
    if (window.__SHIYUN_UNSUPPORTED__) return;
    // 2) 用户已点过「知道了」→ 不再打扰(读 localStorage 单独 try:隐私模式 getItem 会抛)
    try {
      if (window.localStorage && localStorage.getItem(PRE_KEY) === "1") return;
    } catch (e) {}
    // 3) 已过期 → 自杀
    if (Date.now() > EXPIRE_MS) return;

    // 视觉重点配色(仅内联使用,不碰主站变量):GOLD=提亮强调金,WARM=行动项暖色,DIM=次级信息偏暗。
    var GOLD = "#ffdf9e";
    var WARM = "#ffb37a";
    var DIM = "#b3a988";
    // 富文本装配助手:全部 createElement / textNode,绝不用 innerHTML(静态内容也不塞)。
    function tx(node, s) { node.appendChild(document.createTextNode(s)); }
    function em(node, s, color) {
      var e = document.createElement("strong");
      e.textContent = s;
      e.style.cssText = "font-weight:700" + (color ? ";color:" + color : "");
      node.appendChild(e);
      return e;
    }
    // hl = 仅提亮不加粗(owner 指定「流星/划过/没入银河」轻微提亮、不带营销感,故与 em 分开)。
    function hl(node, s, color) {
      var e = document.createElement("span");
      e.textContent = s;
      e.style.cssText = "color:" + color;
      node.appendChild(e);
      return e;
    }

    // ── 构建 DOM(样式全内联,不碰主站任何 class/CSS 变量)──────────────────────
    var bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "诗云更新预告");
    // z-index 9998 刻意低于主站 charsetWarn 告警的 9999——真出字库告警时不该被横幅盖住。
    // padding-top 叠 env(safe-area-inset-top):站点 viewport-fit=cover,刘海屏别把文字顶进挖孔。
    // pointer-events:none —— 关键:横幅在 z-index 9998,盖在主站 .hud-top(z-index 20)上方,若默认
    // pointer-events:auto,横幅空白区会吞掉本该落到顶栏(五绝/七绝/常用字/更多…/隐藏界面/诗云 logo)的点击。
    // 这里让 bar 整体点击穿透,只在真正的交互子元素(row / detail)上重新打开 auto。
    // 另外 mount 时会 reserveSpace() 把 .hud-top 与 .search 整体下推 bar 高度,让顶栏不被视觉遮挡。
    bar.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:9998",
      "box-sizing:border-box",
      "pointer-events:none",
      "padding:calc(9px + env(safe-area-inset-top)) 14px 9px",
      "background:rgba(7,8,15,0.94)",
      "border-bottom:1px solid rgba(216,200,154,0.28)",
      "color:#d8c89a",
      "font:13px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
      "-webkit-backdrop-filter:blur(6px)",
      "backdrop-filter:blur(6px)"
    ].join(";");

    // 第一行:文案 + 两个按钮(flex,窄屏可换行)。pointer-events:auto 重新打开交互(见 bar 上的说明)。
    var row = document.createElement("div");
    row.style.cssText =
      "pointer-events:auto;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;max-width:960px;margin:0 auto";

    // 一句话行(owner 07-18 二次修订):核心是「几号更新」这件事本身——更新时间句立重点(强调加粗),
    // 后接及时保存虚空诗的提示;认领/中奖钩子只放详情,不进折叠行。收尾 🙏 表诚恳。
    var line = document.createElement("span");
    line.style.cssText = "flex:1 1 220px;min-width:0";
    em(line, "诗云将于 7 月 23 日(周四)晚更新", GOLD);
    tx(line, ";想留的虚空诗,请及时用「留影」存图 🙏");

    // 按钮工厂:内边距足够大保证移动端可点(≥ 30px 高的点击区)
    function mkBtn(label) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = [
        "flex:0 0 auto",
        "cursor:pointer",
        "padding:6px 12px",
        "font:13px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
        "color:#d8c89a",
        "background:transparent",
        "border:1px solid rgba(216,200,154,0.45)",
        "border-radius:6px",
        "white-space:nowrap"
      ].join(";");
      return b;
    }

    var detailBtn = mkBtn("查看详情");
    var okBtn = mkBtn("知道了");

    row.appendChild(line);
    row.appendChild(detailBtn);
    row.appendChild(okBtn);

    // 展开区:默认隐藏,放正文;max-height 60vh 可滚动(正文长过一屏时不吃掉整个视口)
    var detail = document.createElement("div");
    detail.style.cssText = [
      "display:none",
      "pointer-events:auto", // 展开正文可滚动 / 可选中(bar 整体 pointer-events:none,此处重新打开)
      "max-width:960px",
      "margin:10px auto 2px",
      "max-height:60vh",
      "overflow-y:auto",
      "line-height:1.7",
      "color:#c8bd9c",
      "border-top:1px solid rgba(216,200,154,0.18)",
      "padding-top:10px"
    ].join(";");
    // 正文分段落层次装配:全 createElement,不用 innerHTML。字号 12~13.5px 分级,配色见 GOLD/WARM/DIM。
    // 逐字对应 ANNOUNCE-2026-07.md「展开详情」(owner 2026-07-18 定稿)。段序与层次均 owner 指定:
    // ①时间常规 ②⚠️ 行动项整段暖色、语气诚恳(加粗仅三个关键词)③认领=主体,引子加粗、
    // 「流星/划过/没入银河」仅提亮不加粗、存储句保持平实 ④中奖 callout(重点)⑤其他更新次级 ⑥账号名加粗。
    function mkP(color, size) {
      var p = document.createElement("p");
      p.style.cssText =
        "margin:0 0 10px" +
        (size ? ";font-size:" + size : "") +
        (color ? ";color:" + color : "");
      detail.appendChild(p);
      return p;
    }

    // ① 更新时间句 — 常规
    tx(mkP(), "诗云将于 2026 年 7 月 23 日(周四)晚更新,期间站点可能短暂无法访问。");

    // ② ⚠️ 行动项 — 整段暖色,加粗「一次性重置」「7 月 23 日前」「留影」,其余平实(owner:语气诚恳)
    var warnP = mkP(WARM);
    tx(warnP, "⚠️ 更新后,虚空诗链接(#p=)会");
    em(warnP, "一次性重置", WARM);
    tx(warnP, "。如果你有想留住的虚空诗,请务必在 ");
    em(warnP, "7 月 23 日前", WARM);
    tx(warnP, ",用「");
    em(warnP, "留影", WARM);
    tx(warnP, "」把它存成图片保存好。这次给你添的麻烦,还请见谅,也拜托尽快。诗人链接(#a=)不受影响。");

    // ③ 认领段 — 主体:引子加粗;「流星/划过/没入银河」仅轻微提亮(hl,不加粗);存储句平实不修饰
    var claimP = mkP();
    em(claimP, "新增「认领」:");
    tx(claimP, " 从虚空里捞到的诗,可以认领。你会拿到一枚从 #1 起算、全站唯一的认领编号;就在这一刻,这首诗会化作一颗");
    hl(claimP, "流星", GOLD);
    tx(claimP, ",在星空里");
    hl(claimP, "划过", GOLD);
    tx(claimP, ",");
    hl(claimP, "没入银河", GOLD);
    tx(claimP, ",服务器会记下你的认领编号和认领时间。");

    // ④ 中奖段落 — 重点 callout:浅金边框 + 微底色;引子/里程碑数字/密钥/「《诗云》实体书」提亮加粗。
    var callout = document.createElement("div");
    callout.style.cssText = [
      "margin:0 0 12px",
      "padding:10px 12px",
      "border:1px solid rgba(255,217,138,0.5)",
      "background:rgba(255,217,138,0.07)",
      "border-radius:8px"
    ].join(";");
    var cp = document.createElement("p");
    cp.style.cssText = "margin:0;font-size:13.5px;line-height:1.7";
    tx(cp, "🎉 ");
    em(cp, "认领彩蛋:", GOLD);
    tx(cp, " 第 ");
    em(cp, "1 / 100 / 500 / 1000 / 5000 / 10000", GOLD);
    tx(cp, " 位认领者,当场会拿到一枚 ");
    em(cp, "SY 开头的中奖密钥", GOLD);
    tx(cp, "(服务器即时生成,自动存入本机「我的认领」)。凭这枚密钥,在抖音 / 小红书 / B站 任一平台私信作者,即可领取刘慈欣原著");
    em(cp, "《诗云》实体书", GOLD);
    tx(cp, "一本。");
    callout.appendChild(cp);
    detail.appendChild(callout);

    // ⑤ 其他更新 — 次级(偏小偏暗)
    tx(
      mkP(DIM, "12px"),
      "其他还有若干更新:5,895 首含古籍缺字的诗按原貌回归(缺字以 □ 标注)、手机端操控重做(拖动 / 缩放 / 点选更跟手)、字库扩至 22,219 字、乾隆等帝王可按年号搜索,等等。"
    );

    // (隐私段已按 owner 07-18 指示整段删除——「太冷漠」;存储事实由认领段一句平实带过,勿加回。)

    // ⑥ 账号引导 — 账号名加粗(逐字引用,勿改;括号平台列表为 owner 定稿全角括号)
    var acctP = mkP();
    tx(acctP, "更多细节和完整说明,欢迎关注作者视频账号「");
    em(acctP, "世界第一裹凉皮");
    tx(acctP, "」。（抖音/小红书/B站/微博/视频号）");

    bar.appendChild(row);
    bar.appendChild(detail);

    // ── 占位:把主站固定顶栏整体下推,别让不透明横幅遮住导航 ─────────────────────────
    // 横幅是 position:fixed 覆盖层、不占布局流;主站 .hud-top(顶部整条导航)也是 fixed;top:0,于是二者
    // 重叠。这里注入一段样式,把 .hud-top 与 .search 一起下推 --shiyun-ann-h(= 横幅实测高度),使顶栏永不
    // 被盖住;横幅换行 / 展开详情 / 刘海屏高度变化时用 ResizeObserver 实时更新。样式选择器若在某个旧构建里
    // 对不上(no-op),最坏只是退回「横幅覆盖」的老行为——绝不会把主站搞坏。.search 移动端 top 依赖 --hud-h,
    // 桌面 top:64px,分别加上同一个 --shiyun-ann-h 即可与下推后的 .hud-top 继续对齐(600px 断点与主站一致)。
    var ro = null;
    function syncHeight() {
      try {
        document.documentElement.style.setProperty(HUD_VAR, (bar.offsetHeight || 0) + "px");
      } catch (e) {}
    }
    function reserveSpace() {
      try {
        if (!document.getElementById(STYLE_ID)) {
          var st = document.createElement("style");
          st.id = STYLE_ID;
          st.textContent =
            ".hud-top{top:var(" + HUD_VAR + ",0px)!important}" +
            ".search{top:calc(64px + var(" + HUD_VAR + ",0px))!important}" +
            "@media (max-width:600px){.search{top:calc(var(--hud-h,104px) + 8px + var(" +
            HUD_VAR + ",0px))!important}}";
          (document.head || document.documentElement).appendChild(st);
        }
        syncHeight();
        if (typeof ResizeObserver !== "undefined" && !ro) {
          ro = new ResizeObserver(syncHeight);
          ro.observe(bar);
        }
      } catch (e) {}
    }
    function releaseSpace() {
      try {
        if (ro) { ro.disconnect(); ro = null; }
      } catch (e) {}
      try {
        document.documentElement.style.setProperty(HUD_VAR, "0px");
      } catch (e) {}
      try {
        var st = document.getElementById(STYLE_ID);
        if (st && st.parentNode) st.parentNode.removeChild(st);
      } catch (e) {}
    }

    // ── 交互 ──────────────────────────────────────────────────────────────────
    var expanded = false;
    detailBtn.onclick = function () {
      expanded = !expanded;
      detail.style.display = expanded ? "block" : "none";
      detailBtn.textContent = expanded ? "收起" : "查看详情";
      syncHeight(); // 展开/收起改变横幅高度 → 立刻重推顶栏(ResizeObserver 缺席时的兜底)
    };

    // 「知道了」:移除整条横幅并记住,不再出现(写 localStorage 单独 try:隐私模式会抛)
    okBtn.onclick = function () {
      releaseSpace(); // 先归还占位:恢复 .hud-top / .search 原位并撤下注入样式
      try {
        if (bar.parentNode) bar.parentNode.removeChild(bar);
      } catch (e) {}
      try {
        if (window.localStorage) localStorage.setItem(PRE_KEY, "1");
      } catch (e) {}
      removeHotkey();
      try {
        window.removeEventListener("resize", syncHeight);
        window.removeEventListener("load", syncHeight);
      } catch (e) {}
    };

    // 键盘 H:主站 H 是「隐藏 UI 截图」快捷键,横幅跟随之一起显隐;焦点在输入框/可编辑区时忽略。
    function onKey(ev) {
      try {
        if (!ev || (ev.key !== "h" && ev.key !== "H")) return;
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        var t = ev.target;
        if (t) {
          var tag = (t.tagName || "").toLowerCase();
          if (tag === "input" || tag === "textarea" || t.isContentEditable) return;
        }
        bar.style.visibility =
          bar.style.visibility === "hidden" ? "visible" : "hidden";
      } catch (e) {}
    }
    function removeHotkey() {
      try {
        window.removeEventListener("keydown", onKey);
      } catch (e) {}
    }
    window.addEventListener("keydown", onKey);

    // ResizeObserver 观察的是 content-box,且并非所有视口变化都可靠触发;旋转/视口缩放的权威信号
    // 是 window resize,字体晚到导致的换行变化则在 load 后补测一次。RO 留作冗余。
    window.addEventListener("resize", syncHeight);
    if (document.readyState !== "complete") {
      window.addEventListener("load", syncHeight);
    }

    // 挂载:body 未就绪(defer 一般已就绪,但保险)则等 DOMContentLoaded
    function mount() {
      try {
        if (document.body) {
          document.body.appendChild(bar);
          reserveSpace(); // 挂载后测高并下推顶栏(必须在 append 之后,offsetHeight 才有效)
        }
      } catch (e) {}
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mount);
    } else {
      mount();
    }
  } catch (e) {
    // 任何异常一律吞掉:横幅可以不出现,主站不能因它受影响。
  }
})();
