const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://cubehis.avopay.pro';
const API_URL  = 'https://cubehis.avopay.pro:5000';
const OUT_DIR  = '/www/wwwroot/HIS/screenshot_tool/shots';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const PAGES = [
  { label: '01_login',          path: '/login',                 },
  { label: '02_dashboard',      path: '/dashboard',             },
  { label: '03_appointments',   path: '/appointments',          },
  { label: '04_reception',      path: '/reception',             },
  { label: '05_patient_reg',    path: '/patients/registration', },
  { label: '06_patient_portal', path: '/patients/portal',       },
  { label: '07_opd',            path: '/opd',                   },
  { label: '08_ipd',            path: '/ipd',                   },
  { label: '09_emr',            path: '/emr',                   },
  { label: '10_nursing',        path: '/nursing',               },
  { label: '11_ot',             path: '/ot',                    },
  { label: '12_teleconsult',    path: '/teleconsult',           },
  { label: '13_pharmacy',       path: '/pharmacy',              },
  { label: '14_laboratory',     path: '/laboratory',            },
  { label: '15_radiology',      path: '/radiology',             },
  { label: '16_blood_bank',     path: '/blood-bank',            },
  { label: '17_billing',        path: '/billing',               },
  { label: '18_insurance',      path: '/insurance',             },
  { label: '19_certificates',   path: '/certificates',          },
  { label: '20_doctors',        path: '/doctors',               },
  { label: '21_departments',    path: '/departments',           },
  { label: '22_leads',          path: '/leads',                 },
  { label: '23_assigned_leads', path: '/assigned-leads',        },
  { label: '24_customers',      path: '/customers',             },
  { label: '25_loyalty',        path: '/loyalty',               },
  { label: '26_franchise',      path: '/franchise',             },
  { label: '27_hr_staff',       path: '/hr',                    },
  { label: '28_attendance',     path: '/attendance',            },
  { label: '29_leave_req',      path: '/my-leave-requests',     },
  { label: '30_inventory',      path: '/inventory',             },
  { label: '31_reports',        path: '/reports',               },
  { label: '32_tasks',          path: '/tasks',                 },
  { label: '33_tickets',        path: '/tickets',               },
  { label: '34_documents',      path: '/documents',             },
  { label: '35_users',          path: '/users/list',            },
  { label: '36_roles',          path: '/users/roles',           },
  { label: '37_hospitals',      path: '/users/hospitals',       },
  { label: '38_hierarchy',      path: '/hierarchy-assignment',  },
  { label: '39_notes',          path: '/notes',                 },
  { label: '40_followup',       path: '/follow-up',             },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function injectTokenAndNavigate(page, token, targetUrl) {
  // Go to base page first to set localStorage on correct origin
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.evaluate((tok) => {
    localStorage.setItem('access_token', tok);
    localStorage.setItem('user', JSON.stringify({
      username: 'avopay_admin',
      full_name: 'Avopay Admin',
      roles: ['admin'],
      is_active: true
    }));
  }, token);
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 25000 });
}

async function dismissPopups(page) {
  await page.evaluate(() => {
    // Press Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    // Click any visible close/dismiss buttons
    const selectors = [
      'button[aria-label="Close"]',
      'button[title="Close"]',
      '.modal button.close',
      '[data-dismiss="modal"]',
      'button:has(> svg)', // icon close buttons
    ];
    for (const sel of selectors) {
      try {
        document.querySelectorAll(sel).forEach(btn => {
          const rect = btn.getBoundingClientRect();
          if (rect.width > 0) btn.click();
        });
      } catch(_) {}
    }
  });
  await sleep(400);
}

async function main() {
  console.log('Launching Chromium...');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--ignore-certificate-errors',
      '--disable-notifications',
      '--disable-popup-blocking',
      '--disable-extensions',
    ],
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Suppress dialog popups (alert/confirm/prompt)
  page.on('dialog', async dialog => { await dialog.dismiss(); });

  // ── Get JWT token via API ──────────────────────────────────────────────
  console.log('Getting auth token...');
  let token = null;
  try {
    const resp = await page.evaluate(async (apiUrl) => {
      const r = await fetch(apiUrl + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'username=avopay_admin&password=Admin%40123',
      });
      return r.json();
    }, API_URL);
    token = resp.access_token;
    console.log('  Token obtained:', token ? '✓' : '✗');
  } catch(e) {
    console.log('  Token fetch error:', e.message);
  }

  // ── Capture login page (unauthenticated) ─────────────────────────────
  console.log('Capturing 01_login...');
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle2', timeout: 20000 });
  await sleep(2000);
  await page.screenshot({ path: path.join(OUT_DIR, '01_login.png'), fullPage: true });
  console.log('  ✓ 01_login.png');

  // ── Inject token for all other pages ─────────────────────────────────
  if (token) {
    await page.evaluate((tok) => {
      localStorage.setItem('access_token', tok);
      localStorage.setItem('user', JSON.stringify({
        username: 'avopay_admin',
        full_name: 'Avopay Admin',
        roles: ['admin'],
        is_active: true
      }));
    }, token);
  }

  // ── Capture all pages ─────────────────────────────────────────────────
  for (const pg of PAGES) {
    if (pg.label === '01_login') continue;

    console.log(`Capturing ${pg.label}...`);
    try {
      if (token) {
        // Ensure token is set before each navigation (in case of SPA re-init)
        await page.evaluate((tok) => {
          if (!localStorage.getItem('access_token')) {
            localStorage.setItem('access_token', tok);
            localStorage.setItem('user', JSON.stringify({
              username: 'avopay_admin', full_name: 'Avopay Admin',
              roles: ['admin'], is_active: true
            }));
          }
        }, token);
      }

      await page.goto(BASE_URL + pg.path, {
        waitUntil: 'networkidle2',
        timeout: 25000,
      });

      await sleep(3000);
      await dismissPopups(page);

      // If redirected to login, re-inject and retry
      if (page.url().includes('/login')) {
        console.log('  Redirected to login, re-injecting token...');
        await page.evaluate((tok) => {
          localStorage.setItem('access_token', tok);
          localStorage.setItem('user', JSON.stringify({
            username: 'avopay_admin', full_name: 'Avopay Admin',
            roles: ['admin'], is_active: true
          }));
        }, token);
        await page.goto(BASE_URL + pg.path, { waitUntil: 'networkidle2', timeout: 25000 });
        await sleep(3000);
        await dismissPopups(page);
      }

      await page.evaluate(() => window.scrollTo(0, 0));
      await sleep(300);

      await page.screenshot({
        path: path.join(OUT_DIR, `${pg.label}.png`),
        fullPage: true,
      });
      console.log(`  ✓ ${pg.label}.png`);
    } catch (err) {
      console.log(`  ✗ ${pg.label}: ${err.message}`);
      try {
        await page.screenshot({
          path: path.join(OUT_DIR, `${pg.label}.png`),
          fullPage: false,
        });
        console.log(`  ~ ${pg.label}.png (partial)`);
      } catch (_) {}
    }
  }

  await browser.close();

  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png'));
  console.log(`\nDone! ${files.length} screenshots saved to: ${OUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
