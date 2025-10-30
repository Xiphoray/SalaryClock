#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';

const root = process.cwd();
const distDir = path.join(root, 'dist');
await fs.mkdir(distDir, {recursive: true});

const CDN = {
  jquery: 'https://cdn.jsdelivr.net/npm/jquery@2.1.3/dist/jquery.min.js',
  bootstrapJS: 'https://cdn.jsdelivr.net/npm/bootstrap@3.3.2/dist/js/bootstrap.min.js',
  bootstrapCSS: 'https://cdn.jsdelivr.net/npm/bootstrap@3.3.2/dist/css/bootstrap.min.css',
};

function fetchText(url){
  return new Promise((resolve, reject)=>{
    https.get(url, res =>{
      if(res.statusCode && res.statusCode>=300 && res.statusCode<400 && res.headers.location){
        return resolve(fetchText(res.headers.location));
      }
      if(res.statusCode!==200){ reject(new Error('HTTP '+res.statusCode+' for '+url)); return; }
      let data=''; res.setEncoding('utf8');
      res.on('data', chunk=> data+=chunk);
      res.on('end', ()=> resolve(data));
    }).on('error', reject);
  });
}

const [bootstrapCSS, jqueryJS, bootstrapJS, appJS, stylesCSS] = await Promise.all([
  fetchText(CDN.bootstrapCSS),
  fetchText(CDN.jquery),
  fetchText(CDN.bootstrapJS),
  fs.readFile(path.join(root,'assets','app.js'),'utf8'),
  fs.readFile(path.join(root,'assets','styles.css'),'utf8'),
]);

const html = `<!doctype html>
<html lang=\"zh-CN\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>SalaryClock (Standalone)</title>
    <style>${bootstrapCSS}\n${stylesCSS}</style>
  </head>
  <body>
    <div id=\"moneyclock-app\" class=\"moneyclock-app\">
      <div class=\"moneyclock-container\">
        <div class=\"moneyclock-gear\" id=\"moneyclock-btn-settings\" role=\"button\" aria-label=\"设置\" title=\"设置\">
          <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"28\" height=\"28\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M19.14,12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.37,7.37,0,0,0-1.63-.94l-.36-2.54A.5.5 0 0 0,13.9,1H10.1a.5.5,0,0,0-.5.42L9.24,3.96a7.37,7.37,0,0,0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7,7.48a.5.5 0 0 0,.12.64L4.85,9.7c-.04.31-.06.63-.06.94s.02.63.06.94L2.82,13.16a.5.5 0 0 0-.12.64l1.92,3.32a.5.5 0 0 0,.6.22l2.39-.96c.5.4,1.04.72,1.63.94l.36,2.54a.5.5 0 0 0,.5.42h3.8a.5.5 0 0 0,.5-.42l.36-2.54c.59-.22,1.13-.54,1.63-.94l2.39.96a.5.5 0 0 0,.6-.22l1.92-3.32a.5.5 0 0 0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z\"/></svg>
        </div>

        <div class=\"moneyclock-tabs\" id=\"moneyclock-tabs\" role=\"tablist\" aria-label=\"薪资视图切换\">
          <div class=\"moneyclock-tabs-inner\">
            <button type=\"button\" id=\"moneyclock-tab-today\" class=\"moneyclock-tab active\" data-kind=\"today\" role=\"tab\" aria-selected=\"true\">今日已获薪水</button>
            <button type=\"button\" id=\"moneyclock-tab-year\" class=\"moneyclock-tab\" data-kind=\"year\" role=\"tab\" aria-selected=\"false\">今年已获薪水</button>
            <button type=\"button\" id=\"moneyclock-tab-since\" class=\"moneyclock-tab\" data-kind=\"since\" role=\"tab\" aria-selected=\"false\">入职已获薪水</button>
            <div class=\"moneyclock-tab-indicator\" id=\"moneyclock-tab-indicator\" aria-hidden=\"true\"></div>
          </div>
        </div>

        <div id=\"moneyclock-wage\" class=\"moneyclock-wage\" aria-live=\"polite\" aria-label=\"今天已获得工资\"></div>

        <div class=\"moneyclock-countdown\" id=\"moneyclock-countdown\" aria-live=\"polite\">
          <div class=\"moneyclock-countdown-label\" id=\"moneyclock-countdown-label\">距离下班还剩下</div>
          <div class=\"moneyclock-countdown-time\" id=\"moneyclock-countdown-time\">00:00:00</div>
        </div>
      </div>
    </div>

    <!-- 设置 Modal -->
    <div class=\"modal fade\" id=\"moneyclock-settings-modal\" tabindex=\"-1\" aria-labelledby=\"settingsLabel\" aria-hidden=\"true\">
      <div class=\"modal-dialog\">
        <div class=\"modal-content\">
          <div class=\"modal-header\">
            <button type=\"button\" class=\"close\" data-dismiss=\"modal\" aria-label=\"关闭\"><span aria-hidden=\"true\">&times;</span></button>
            <h5 class=\"modal-title\" id=\"settingsLabel\">设置</h5>
          </div>
          <div class=\"modal-body\">
            <form id=\"settings-form\">
              <div class=\"form-group\">
                <label class=\"control-label\">月薪（元）</label>
                <input type=\"number\" step=\"0.01\" min=\"0\" class=\"form-control\" id=\"moneyclock-salaryMonthly\" />
              </div>
              <div class=\"form-group\">
                <label class=\"control-label\">每月上班天数</label>
                <input type=\"number\" step=\"0.01\" min=\"1\" class=\"form-control\" id=\"moneyclock-workDaysPerMonth\" />
              </div>
              <div class=\"form-group\">
                <label class=\"control-label\">入职日期（年月）</label>
                <input type=\"month\" class=\"form-control\" id=\"moneyclock-hireMonth\" />
              </div>
              <div class=\"row\">
                <div class=\"col-sm-6\">
                  <div class=\"form-group\">
                    <label class=\"control-label\">上班开始</label>
                    <div class=\"moneyclock-time-field\">
                      <input type=\"time\" class=\"form-control moneyclock-time-input\" id=\"moneyclock-workStart\" />
                    </div>
                  </div>
                </div>
                <div class=\"col-sm-6\">
                  <div class=\"form-group\">
                    <label class=\"control-label\">上班结束</label>
                    <div class=\"moneyclock-time-field\">
                      <input type=\"time\" class=\"form-control moneyclock-time-input\" id=\"moneyclock-workEnd\" />
                    </div>
                  </div>
                </div>
              </div>
              <div class=\"row\">
                <div class=\"col-sm-6\">
                  <div class=\"form-group\">
                    <label class=\"control-label\">午休开始</label>
                    <div class=\"moneyclock-time-field\">
                      <input type=\"time\" class=\"form-control moneyclock-time-input\" id=\"moneyclock-lunchStart\" />
                    </div>
                  </div>
                </div>
                <div class=\"col-sm-6\">
                  <div class=\"form-group\">
                    <label class=\"control-label\">午休结束</label>
                    <div class=\"moneyclock-time-field\">
                      <input type=\"time\" class=\"form-control moneyclock-time-input\" id=\"moneyclock-lunchEnd\" />
                    </div>
                  </div>
                </div>
              </div>
              <div class=\"checkbox\">
                <label>
                  <input type=\"checkbox\" id=\"moneyclock-includeLunch\" /> 上班时间包含午休
                </label>
              </div>
              <div class=\"form-group\">
                <label class=\"control-label\">刷新时间（秒）</label>
                <input type=\"number\" step=\"1\" min=\"1\" class=\"form-control\" id=\"moneyclock-refreshSec\" />
              </div>
            </form>
          </div>
          <div class=\"modal-footer\">
            <button type=\"button\" class=\"btn btn-primary\" id=\"save-settings\">确认</button>
          </div>
        </div>
      </div>
    </div>

    <script>${jqueryJS}</script>
    <script>${bootstrapJS}</script>
    <script>${appJS}</script>
  </body>
</html>`;

await fs.writeFile(path.join(distDir, 'standalone.html'), html, 'utf8');
console.log('Built dist/standalone.html');
