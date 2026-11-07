# HEY... MR — புதிய API + Website Project

இந்த package தற்போதைய HEY MR project-ஐ அடிப்படையாகக் கொண்டு தயாரிக்கப்பட்டது.
`public/index.html` என்பது upload செய்த homepage-ஐ அடிப்படையாகக் கொண்டது. அதன் design மற்றும் public browsing layout பாதுகாக்கப்பட்டுள்ளன; public Chat buttons மற்றும் hidden Post form-இல் இருந்த image-file control நீக்கப்பட்டுள்ளன.

## கோப்புகள்
- `workers/index.js` — Cloudflare API Worker
- `migrations/0001_initial.sql` — அடிப்படை D1 tables
- `migrations/0002_client_chat.sql` — பழைய migration; அதன் tables-ஐ தற்போதைய API பயன்படுத்தாது
- `migrations/0003_remove_ad_approval.sql` — pending ads-ஐ approved ஆக்கும் migration
- `public/index.html` — பாதுகாக்கப்பட்ட homepage (தேவையான UI நீக்கங்கள் மட்டும்)
- `public/admin.html` — Admin panel
- `wrangler.toml` — DB / R2 / Assets bindings

## Admin-only Ad Posting
- Client Chat, Client account/registration, OTP Verification, Client dashboard மற்றும் Client ad posting வசதிகள் செயல்பாட்டிலிருந்து நீக்கப்பட்டுள்ளன.
- Image Upload API இல்லை. ஏற்கனவே உள்ள விளம்பரப் படங்களைக் காட்டும் public image-read route மட்டும் பாதுகாக்கப்பட்டுள்ளது. Admin panel-ல் Image URL கொடுக்கலாம்.
- Ad உருவாக்கும் ஒரே API: `POST /api/admin/ads` — Admin Bearer Token கட்டாயம்.
- ஒவ்வொரு புதிய Admin Ad-க்கும் தானாக 7 நாள் VIP promotion சேர்க்கப்படும்.
- Admin Panel-ல் அனைத்து 38 Tamil Nadu District-களும் dropdown-ல் கிடைக்கும்; District Management பகுதியில் Admin மட்டும் district add/edit/delete செய்யலாம்.
- Homepage-ன் design மற்றும் public browsing layout பாதுகாக்கப்பட்டுள்ளன. Client/Chat/OTP/Post modal-கள் public-க்கு கிடைக்காதபடி hidden நிலையில் உள்ளன; public Chat buttons மற்றும் image-file control நீக்கப்பட்டுள்ளன.

## முக்கிய பாதுகாப்பு
- `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` போன்ற secret values-ஐ GitHub-ல் எழுத வேண்டாம். Client OTP / Client Session secrets இனி தேவையில்லை.
- Cloudflare Worker > Settings > Variables and Secrets பகுதியில் தேவையான secrets அமைக்கவும்.
- பழைய D1 `clients`, `chat_messages`, `otp_audit`, `ad_owners` tables-ஐ data loss தவிர்க்க அழிக்கவில்லை; அவற்றை பயன்படுத்தும் active API இல்லை.
- இந்த ZIP-ல் எந்த secret value-மும் சேர்க்கப்படவில்லை.

## GitHub / Cloudflare
1. ZIP extract செய்து உள்ளே இருக்கும் `hey-mr` project files-ஐ repository root-ல் upload செய்யவும்.
2. Cloudflare Worker project root-ல் `wrangler.toml` இருக்க வேண்டும்.
3. D1 database மற்றும் R2 bucket names/IDs உங்கள் தற்போதைய configuration-க்கு பொருந்துகிறதா சரிபார்க்கவும்.
4. ஏற்கனவே production-ல் migrations apply செய்திருந்தால் மீண்டும் தேவையின்றி apply செய்ய வேண்டாம்.
5. முதலில் `npm install`, பின்னர் `npm run check`.
6. பின்னர் `npx wrangler deploy`.

## API Health Test
Deploy ஆன பிறகு:
`/api/health`

வெற்றிகரமான பதில்:
`{"success":true,"database":"connected","app":"HEY MR"}`

## Migration கவனம்
Production D1-ல் எந்த migration pending என்று முதலில் சரிபார்க்கவும். ஏற்கனவே apply செய்த migration-ஐ மீண்டும் manually SQL editor-ல் இயக்க வேண்டாம்.


## Screenshot requirements update (2026-11-07)
- Admin மட்டுமே Ads Post / manage செய்ய முடியும்.
- Clients Ads பார்க்கவும் Search செய்யவும் முடியும்.
- Contact options: Call + WhatsApp மட்டும்.
- Chat Messenger UI மற்றும் Worker API endpoints நீக்கப்பட்டன.
- விவரங்களுக்கு `SCREENSHOT-REQUIREMENTS.txt` பார்க்கவும்; reference screenshot `SCREENSHOT-REFERENCE.jpg`.
