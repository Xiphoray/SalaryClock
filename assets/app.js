(function($){
  const COOKIE_NAME = 'mc_settings';
  const COOKIE_DAYS = 365;

  const DEFAULTS = {
    salaryMonthly: 7000,
    workDaysPerMonth: 21.75,
    hireMonth: '2020-07',
    workStart: '08:00',
    workEnd: '17:30',
    lunchStart: '11:30',
    lunchEnd: '13:00',
    includeLunch: true,
    refreshSec: 1
  };

  // Storage adapter: prefer Cookie; fallback to localStorage (for file:// 等环境)
  const Storage = (()=>{
    let cookieTested = false;
    let cookieUsable = false;
    function canUseCookie(){
      if(cookieTested) return cookieUsable;
      cookieTested = true;
      try{
        const k = '__mc_test__';
        document.cookie = `${k}=1; max-age=5; path=/`;
        const ok = /(?:^|; )__mc_test__=1(?:;|$)/.test(document.cookie);
        // cleanup
        document.cookie = `${k}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        cookieUsable = !!ok;
      }catch{ cookieUsable = false; }
      return cookieUsable;
    }
    return {
      get(){
        // try cookie
        if(canUseCookie()){
          const raw = readCookie(COOKIE_NAME);
          if(raw!=null) return decodeURIComponent(raw);
        }
        // fallback localStorage
        try{ return window.localStorage.getItem(COOKIE_NAME); }catch{ return null; }
      },
      set(str){
        let wrote = false;
        if(canUseCookie()){
          try{
            writeCookie(COOKIE_NAME, encodeURIComponent(str), COOKIE_DAYS);
            const back = readCookie(COOKIE_NAME);
            wrote = (back!=null);
          }catch{ wrote = false; }
        }
        if(!wrote){
          try{ window.localStorage.setItem(COOKIE_NAME, str); wrote = true; }catch{ /* ignore */ }
        }
        return wrote;
      }
    };
  })();

  let settings = null; // loaded later in init
  let ticker = null;
  let lastDisplay = null; // string with fixed 2 decimals
  let modal = null;

$(init);

const SEL = {
  wage: '#moneyclock-wage',
  btn: '#moneyclock-btn-settings',
  modal: '#moneyclock-settings-modal',
  salaryMonthly: '#moneyclock-salaryMonthly',
  workDaysPerMonth: '#moneyclock-workDaysPerMonth',
  hireMonth: '#moneyclock-hireMonth',
  workStart: '#moneyclock-workStart',
  workEnd: '#moneyclock-workEnd',
  lunchStart: '#moneyclock-lunchStart',
  lunchEnd: '#moneyclock-lunchEnd',
  includeLunch: '#moneyclock-includeLunch',
  refreshSec: '#moneyclock-refreshSec',
  tabsWrap: '#moneyclock-tabs',
  tabToday: '#moneyclock-tab-today',
  tabYear: '#moneyclock-tab-year',
  tabSince: '#moneyclock-tab-since',
  tabIndicator: '#moneyclock-tab-indicator',
  cdWrap: '#moneyclock-countdown',
  cdLabel: '#moneyclock-countdown-label',
  cdTime: '#moneyclock-countdown-time',
};

let currentMode = 'today'; // 'today' | 'year' | 'since'

function init(){
    buildDisplay('0.00');
    // Init modal & UI (Bootstrap 3)
    modal = $(SEL.modal);
    bindUI();

    // Load settings flow
    const loaded = loadSettings();
    if(!loaded){
      // first open: write defaults to storage and show settings
      settings = {...DEFAULTS};
      saveSettings(settings);
      fillForm();
      startTicker();
      modal.modal('show');
    }else{
      settings = loaded;
      fillForm();
      startTicker();
    }
  }

  function bindUI(){
    $(SEL.btn).on('click', ()=>{
      fillForm();
      modal.modal('show');
    });

    // Tabs
    $(SEL.tabToday+','+SEL.tabYear+','+SEL.tabSince).on('click', function(){
      const kind = $(this).data('kind');
      selectMode(kind);
      renderOnce();
    });

    // Disallow manual typing in time inputs, allow picker interactions
    $(document).on('keydown', '.moneyclock-time-input', function(e){
      // Allow Tab and navigation keys
      if($.inArray(e.which, [9,37,38,39,40]) !== -1) return;
      e.preventDefault();
    });
    $(document).on('paste drop', '.moneyclock-time-input', function(e){ e.preventDefault(); });

    // Immediate validation on time change
    $(SEL.workStart+','+SEL.workEnd+','+SEL.lunchStart+','+SEL.lunchEnd).on('change', function(){
      validateTimes(true);
    });

    // Save settings
    $('#save-settings').on('click', ()=>{
      const s = readForm();
      if(!s) return;
      settings = s;
      saveSettings(settings);
      startTicker();
      modal.modal('hide');
    });
  }

  function buildDisplay(text){
    const $wrap = $(SEL.wage);

    $wrap.empty();
    $wrap.append($('<div class="moneyclock-currency">¥</div>'));
    const [intPart, fracPart] = text.split('.');
    const digits = (intPart).split('');
    digits.forEach((d)=> $wrap.append(makeDigit(parseInt(d,10)||0)));
    $wrap.append($('<div class="moneyclock-decimal">.</div>'));
    const fds = (fracPart||'00').padEnd(2,'0').slice(0,2).split('');
    fds.forEach((d)=> $wrap.append(makeDigit(parseInt(d,10)||0)));
    lastDisplay = formatFixed(text);
    fitWage();
  }

  const REPEAT_CYCLES = 7; // more headroom to avoid visible backward normalization
  const CYCLE_SIZE = 10;
  const MIDDLE_BASE = Math.floor(REPEAT_CYCLES/2)*CYCLE_SIZE; // center block base index

  function makeDigit(initial){
    const $d = $('<div class="moneyclock-digit" role="img" aria-label="digit"></div>');
    const $wheel = $('<div class="moneyclock-wheel"></div>');
    for(let r=0;r<REPEAT_CYCLES;r++){
      for(let i=0;i<10;i++) $wheel.append($('<span></span>').text(i));
    }
    $d.append($wheel);
    setWheel($wheel, initial);
    return $d;
  }

  function setWheel($wheel, n){
    // Snap to the middle block at the required digit to avoid visible backward jumps
    const h = getDigitHeight();
    const idx = (n%10 + 10)%10; // 0..9
    const abs = MIDDLE_BASE + idx;
    $wheel.css('transition','none');
    $wheel.css('transform', `translateY(${-abs*h}px)`);
    // next frame re-enable transition for future animations
    requestAnimationFrame(()=>{
      $wheel.css('transition','transform var(--wheel-speed) ease-in-out');
    });
    $wheel.data('pos', abs);
  }

  function rollWheel($wheel, from, to){
    // Forward-only animation; choose start/normalize positions to avoid any backward visual
    if(!$wheel || !$wheel.length) return; // safety guard
    const h = getDigitHeight();
    const cur = (from%10+10)%10;
    const nxt = (to%10+10)%10;
    const steps = (nxt >= cur) ? (nxt - cur) : (10 - cur + nxt);

    const maxIndex = REPEAT_CYCLES*CYCLE_SIZE - 1;

    // Choose a normalization position (congruent to nxt) that is >= target
    let norm = MIDDLE_BASE + nxt;
    while(norm < 0) norm += CYCLE_SIZE;
    while(norm > maxIndex) norm -= CYCLE_SIZE;

    // Derive start so that start + steps = norm (no backward jump on normalize)
    let start = norm - steps;
    while(start < 0) { start += CYCLE_SIZE; norm += CYCLE_SIZE; }
    while(norm > maxIndex){ norm -= CYCLE_SIZE; start -= CYCLE_SIZE; }

    const target = start + steps;

    $wheel.off('transitionend');
    // Pre-snap to start without transition
    $wheel.css('transition','none');
    $wheel.css('transform', `translateY(${-start*h}px)`);
    $wheel.data('pos', start);
    // Force reflow so the next change animates
    if($wheel[0]) void $wheel[0].offsetHeight;

    // Animate to target
    $wheel.css('transition','transform var(--wheel-speed) ease-in-out');
    $wheel.css('transform', `translateY(${-target*h}px)`);

    // Normalize to norm (which is >= target) without visible backward move
    $wheel.one('transitionend', ()=>{
      $wheel.css('transition','none');
      $wheel.css('transform', `translateY(${-norm*h}px)`);
      requestAnimationFrame(()=>{
        $wheel.css('transition','transform var(--wheel-speed) ease-in-out');
      });
      $wheel.data('pos', norm);
    });
  }

  function updateDisplay(nextStr){
    nextStr = formatFixed(nextStr);
    if(lastDisplay === null){
      buildDisplay(nextStr);
      return;
    }
    if(nextStr.length !== lastDisplay.length){
      buildDisplay(nextStr);
      return;
    }
    const $wrap = $(SEL.wage);
    const children = $wrap.children().toArray();
    // children: [¥, d0, d1, ..., decimal, f0, f1]
    const prev = lastDisplay;
    const curr = nextStr;

    let acted = false;
    for(let i=curr.length-1;i>=0;i--){
      const c = curr[i];
      const p = prev[i];
      if(c === '.' || p === '.') continue;
      const childIndex = mapIndexToChild(i, curr.length);
      if(childIndex < 0 || childIndex >= children.length){
        buildDisplay(curr);
        lastDisplay = curr;
        return;
      }
      const $digit = $(children[childIndex]);
      const $wheel = $digit.find('.moneyclock-wheel');
      const from = parseInt(p,10);
      const to = parseInt(c,10);

      if(!$wheel.length){
        buildDisplay(curr);
        lastDisplay = curr;
        return;
      }

      if(p === c){
        // normalize unchanged digits to stable middle position (no animation)
        setWheel($wheel, to);
        continue;
      }

      // Always animate forward for any changed digit
      rollWheel($wheel, from, to);
      acted = true;
    }
    if(prev !== curr && !acted){
      // Fallback to rebuild to reflect the change in case animations were skipped
      buildDisplay(curr);
    }
    lastDisplay = curr;
    fitWage();
  }

  function isSuffixRollover(prev, curr, i){
    // Check if all lower-significance digits rolled from 9..9 to 0..0 (ignore decimal point)
    let prevDigits = '', currDigits = '';
    for(let k=i+1;k<prev.length;k++){
      if(prev[k]!=='.') prevDigits += prev[k];
    }
    for(let k=i+1;k<curr.length;k++){
      if(curr[k]!=='.') currDigits += curr[k];
    }
    if(prevDigits.length===0 || prevDigits.length!==currDigits.length) return false;
    return (/^9+$/.test(prevDigits) && /^0+$/.test(currDigits));
  }

  function mapIndexToChild(i, len){
    // Map index in string (including '.') to child index in #wage
    // string like "1234.56" => children [¥, d0,d1,d2,d3,.,f0,f1]
    // i=0 -> d0 => child 1
    const s = lastDisplay || '0.00';
    const decIdx = s.indexOf('.');
    let digitsBefore = 0;
    for(let k=0;k<i;k++){ if(s[k] !== '.') digitsBefore++; }
    let child = 1 + digitsBefore; // +1 for the currency symbol at [0]
    if(decIdx !== -1 && i > decIdx) child += 1; // account for the decimal separator element
    return child;
  }

  function getDigitHeight(){
    const $tmp = $('<div class="moneyclock-digit"><div class="moneyclock-wheel"><span>0</span></div></div>').appendTo('body');
    const h = Math.round($tmp.outerHeight()); // use digit container height to avoid font/line-height drift
    $tmp.remove();
    return h || 88;
  }

  function fitWage(){
    const $wrap = $(SEL.wage);
    if(!$wrap.length) return;
    // Reset transform to measure natural width
    $wrap.css('transform','none');
    const $container = $wrap.closest('.moneyclock-container');
    const containerW = ($container.length ? $container.innerWidth() : ($wrap.parent().innerWidth() || $(window).width()));
    const contentW = $wrap[0] ? $wrap[0].scrollWidth : containerW;
    if(!containerW || !contentW) return;
    var gap = 12; // ensure left/right breathing room on mobile
    const scale = Math.min(1, (containerW - gap*2) / contentW);
    $wrap.css('transform', 'scale(' + scale + ')');
  }

  function startTicker(){
    if(ticker) clearInterval(ticker);
    if(!settings){ return; }
    selectMode(currentMode); // ensure indicator position
    renderOnce();
    const interval = Math.max(1, parseInt(settings.refreshSec,10)||1) * 1000;
    ticker = setInterval(renderOnce, interval);
    // Responsive scaling on resize/orientation changes
    let t;
    $(window).off('.mcfit').on('resize.mcfit orientationchange.mcfit', function(){
      clearTimeout(t); t = setTimeout(function(){ fitWage(); positionIndicator(); }, 100);
    });
    fitWage();
    positionIndicator();
  }

  function renderOnce(){
    let earned = 0;
    if(currentMode === 'today') earned = computeEarnedToday();
    else if(currentMode === 'year') earned = computeEarnedYear();
    else earned = computeEarnedSinceHire();
    updateDisplay(earned.toFixed(2));
    updateCountdown();
  }

  function computeEarnedToday(){
    const daySalary = Number(settings.salaryMonthly)/Number(settings.workDaysPerMonth);
    if(!isFinite(daySalary) || daySalary<=0) return 0;

    const now = new Date();
    const nowSec = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds() + now.getMilliseconds()/1000;
    const ws = toSec(settings.workStart);
    const we = toSec(settings.workEnd);
    if(!(we>ws)) return 0; // invalid range

    let worked = clamp(nowSec, ws, we) - ws; // seconds worked within window
    let total = Math.max(0, we-ws);

    const ls = toSec(settings.lunchStart);
    const le = toSec(settings.lunchEnd);

    if(!settings.includeLunch){
      const lunchOverlapTotal = overlap([ws,we],[ls,le]);
      total -= Math.max(0, lunchOverlapTotal);
      const until = clamp(nowSec, ws, we);
      const lunchOverlapSoFar = overlap([ws, until],[ls,le]);
      worked -= Math.max(0, lunchOverlapSoFar);
    }

    worked = Math.min(Math.max(worked,0), Math.max(total,1));
    const ratio = total>0 ? (worked/total) : 0;
    const earned = daySalary * ratio;
    // clamp to [0, daySalary]
    return Math.min(daySalary, Math.max(0, earned));
  }

  function computeEarnedYear(){
    const today = computeEarnedToday();
    const m = new Date();
    const monthIndex = m.getMonth(); // 0..11
    const monthsBefore = monthIndex; // months completed this year
    const fullMonths = monthsBefore * Number(settings.salaryMonthly);
    const dim = daysInMonth(m.getFullYear(), monthIndex);
    const partRatio = Math.max(0, (m.getDate()-1) / dim);
    const daySalary = Number(settings.salaryMonthly)/Number(settings.workDaysPerMonth);
    const partialMonth = partRatio * Number(settings.workDaysPerMonth) * daySalary;
    const total = Math.max(0, fullMonths + partialMonth + today);
    return total;
  }

  function computeEarnedSinceHire(){
    const today = computeEarnedToday();
    const now = new Date();
    const hire = parseHireMonth(settings.hireMonth);
    if(!hire) return today; // fallback
    let months = monthsBetweenFloor(hire, now);
    months = Math.max(0, months);
    const full = months * Number(settings.salaryMonthly);
    const dim = daysInMonth(now.getFullYear(), now.getMonth());
    const partRatio = Math.max(0, (now.getDate()-1)/dim);
    const daySalary = Number(settings.salaryMonthly)/Number(settings.workDaysPerMonth);
    const partialMonth = partRatio * Number(settings.workDaysPerMonth) * daySalary;
    return Math.max(0, full + partialMonth + today);
  }

  function toSec(t){
    if(!t || !/^\d{2}:\d{2}$/.test(t)) return 0;
    const [h,m] = t.split(':').map(Number); return h*3600+m*60;
  }

  function overlap([a1,a2],[b1,b2]){
    const s = Math.max(a1,b1), e = Math.min(a2,b2); return Math.max(0,e-s);
  }

  function clamp(x, a, b){ return Math.min(Math.max(x, Math.min(a,b)), Math.max(a,b)); }

  function daysInMonth(y, m /* 0..11 */){ return new Date(y, m+1, 0).getDate(); }
  function parseHireMonth(str){
    if(!str || !/^\d{4}-\d{2}$/.test(String(str))) return null;
    const [Y,M] = String(str).split('-').map(Number);
    if(!Y || !M) return null;
    return new Date(Y, M-1, 1);
  }
  function monthsBetweenFloor(a /* Date */, b /* Date */){
    const years = b.getFullYear() - a.getFullYear();
    const months = b.getMonth() - a.getMonth();
    let total = years*12 + months;
    // If b is earlier in month than a's day (we only store year-month, use floor months fully passed)
    if(total < 0) return total; // future hire
    return Math.floor(total);
  }

  function loadSettings(){
    const raw = Storage.get();
    if(!raw) return null;
    try{ const obj = JSON.parse(raw); return {...DEFAULTS, ...obj}; }
    catch{ return null; }
  }
  function saveSettings(s){ Storage.set(JSON.stringify(s)); }

  function readCookie(name){
    const m = document.cookie.match(new RegExp('(?:^|; )'+name.replace(/([.$?*|{}()\[\]\\\/\+^])/g,'\\$1')+'=([^;]*)'));
    return m? m[1] : null;
  }
  function writeCookie(name, value, days){
    const d = new Date(); d.setTime(d.getTime()+days*24*60*60*1000);
    document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/`;
  }

  function fillForm(){
    $(SEL.salaryMonthly).val(settings.salaryMonthly);
    $(SEL.workDaysPerMonth).val(settings.workDaysPerMonth);
    $(SEL.hireMonth).val(settings.hireMonth);
    $(SEL.workStart).val(settings.workStart);
    $(SEL.workEnd).val(settings.workEnd);
    $(SEL.lunchStart).val(settings.lunchStart);
    $(SEL.lunchEnd).val(settings.lunchEnd);
    $(SEL.includeLunch).prop('checked', !!settings.includeLunch);
    $(SEL.refreshSec).val(settings.refreshSec);
  }
  function readForm(){
    const hire = String($(SEL.hireMonth).val()||'2020-07');
    const s = {
      salaryMonthly: parseFloat($(SEL.salaryMonthly).val()),
      workDaysPerMonth: parseFloat($(SEL.workDaysPerMonth).val()),
      hireMonth: (/^\d{4}-\d{2}$/.test(hire) ? hire : '2020-07'),
      workStart: String($(SEL.workStart).val()||'08:00'),
      workEnd: String($(SEL.workEnd).val()||'17:30'),
      lunchStart: String($(SEL.lunchStart).val()||'11:30'),
      lunchEnd: String($(SEL.lunchEnd).val()||'12:00'),
      includeLunch: !!$(SEL.includeLunch).is(':checked'),
      refreshSec: parseInt($(SEL.refreshSec).val(),10)||1,
    };
    if(!(s.salaryMonthly>0) || !(s.workDaysPerMonth>0)){
      alert('请填写有效的月薪与上班天数');
      return null;
    }
    if(!validateTimes(true)) return null;
    return s;
  }

  function setGroupError($input, isError){
    var $grp = $input.closest('.form-group');
    $grp.toggleClass('has-error', !!isError);
    if(isError){ $input.attr('aria-invalid','true'); } else { $input.removeAttr('aria-invalid'); }
  }

  function validateTimes(showAlert){
    var $ws = $(SEL.workStart), $we = $(SEL.workEnd), $ls = $(SEL.lunchStart), $le = $(SEL.lunchEnd);
    var s = {
      workStart: String($ws.val()||'08:00'),
      workEnd: String($we.val()||'17:30'),
      lunchStart: String($ls.val()||'11:30'),
      lunchEnd: String($le.val()||'12:00'),
    };
    var ws = toSec(s.workStart), we = toSec(s.workEnd);
    var ls = toSec(s.lunchStart), le = toSec(s.lunchEnd);

    // reset
    setGroupError($ws, false); setGroupError($we, false);
    setGroupError($ls, false); setGroupError($le, false);

    if(!(we>ws)){
      setGroupError($ws, true); setGroupError($we, true);
      if(showAlert) alert('上班时间无效：结束时间必须晚于开始时间');
      return false;
    }
    if(!(le>ls)){
      setGroupError($ls, true); setGroupError($le, true);
      if(showAlert) alert('午休时间无效：结束时间必须晚于开始时间');
      return false;
    }
    if(ls < ws || le > we){
      setGroupError($ls, true); setGroupError($le, true);
      if(showAlert) alert('午休时间超出上班时间范围，请调整');
      return false;
    }
    return true;
  }

  function formatFixed(v){
    const n = (typeof v==='number')? v : parseFloat(v);
    if(!isFinite(n)) return '0.00';
    const s = n.toFixed(2);
    // Ensure at least one integer digit
    return s.replace(/^\./,'0.');
  }

  function selectMode(kind){
    const k = (kind==='year'||kind==='since')? kind : 'today';
    currentMode = k;
    // update aria-selected and classes
    $(SEL.tabToday).toggleClass('active', k==='today').attr('aria-selected', k==='today');
    $(SEL.tabYear).toggleClass('active', k==='year').attr('aria-selected', k==='year');
    $(SEL.tabSince).toggleClass('active', k==='since').attr('aria-selected', k==='since');
    // update wage aria-label
    const label = k==='today'? '今天已获得工资' : (k==='year'? '今年已获得工资' : '入职以来已获得工资');
    $(SEL.wage).attr('aria-label', label);
    positionIndicator();
  }

  function positionIndicator(){
    const $act = $('.moneyclock-tab.active').first();
    const $wrap = $(SEL.tabsWrap).find('.moneyclock-tabs-inner');
    const $ind = $(SEL.tabIndicator);
    if(!$act.length || !$wrap.length || !$ind.length) return;
    const offA = $act.position();
    const w = $act.outerWidth();
    const pad = 2; // match CSS top/height inset
    $ind.css('width', w + 'px');
    $ind.css('transform', 'translateX(' + (offA.left) + 'px)');
  }

  function updateCountdown(){
    if(!settings) return;
    const now = new Date();
    const ws = toSec(settings.workStart);
    const we = toSec(settings.workEnd);
    const secNow = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
    if(secNow >= ws && secNow < we){
      $(SEL.cdLabel).text('距离下班还剩下');
      const left = Math.max(0, we - secNow);
      $(SEL.cdTime).text(secToHMS(left));
    }else{
      $(SEL.cdLabel).text('以下班');
      $(SEL.cdTime).text('00:00:00');
    }
  }

  function secToHMS(s){
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
    return [h,m,ss].map(n=> String(n).padStart(2,'0')).join(':');
  }

})(jQuery);
