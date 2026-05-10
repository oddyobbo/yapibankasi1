# Archilink — Git push ve dış yapay zeka işbirliği rehberi

Bu klasör, masaüstündeki **katalog-projesi** (Archilink / yapı bankası web) ile senkron tutulan bir **yedek ve çalışma kopyasıdır**. Canlı kaynak genelde `katalog-projesi` + GitHub’daki repodur.

---

## 1. Git push için adımlar

### Ön koşullar

- Bilgisayarda [Git](https://git-scm.com/) kurulu.
- GitHub hesabı; repoya **push yetkisi** (kendi reporsan tam yetki).
- İlk kez kullanıyorsan kimlik:

```bash
git config --global user.name "Adın Soyadın"
git config --global user.email "github@email-adresin.com"
```

### Repoyu buradan veya katalog-projesi’nden bağlamak

**A)** Zaten `katalog-projesi` içinde `.git` varsa push’u **oradan** yap (önerilen):

```bash
cd ~/Desktop/katalog-projesi
git status
git add -A
git commit -m "Kısa, açıklayıcı commit mesajı"
git push origin main
```

Dal adı `main` değilse (`master` vb.):

```bash
git branch
git push origin <dal-adı>
```

**B)** Sadece `Archilink` klasöründen çalışacaksan, bu klasörde henüz git yoksa:

```bash
cd ~/Desktop/antigravity/Archilink
git init
git remote add origin https://github.com/KULLANICI/REPO_ADI.git
git add -A
git commit -m "İlk commit"
git branch -M main
git push -u origin main
```

> Not: Şu anki yedeklemede `.git` kopyalanmadığı için `Archilink` içinde doğrudan `git push` yoktur. **Tek gerçek repo** genelde `katalog-projesi` olmalı; yedekten push yapmak istiyorsan yukarıdaki `git init` akışını bir kez kur ve `katalog-projesi` ile aynı remote’u kullan; ya da her seferinde `katalog-projesi`’nde commit/push yapıp `rsync` ile Archilink’i güncelle.

### Kimlik doğrulama (GitHub)

- **HTTPS:** `git push` sırasında kullanıcı adı + **Personal Access Token** (şifre yerine). Token: GitHub → Settings → Developer settings → Personal access tokens.
- **SSH:** `ssh-keygen` ile anahtar, public key’i GitHub → SSH keys’e ekle; remote: `git@github.com:KULLANICI/REPO.git`

### Yaygın hatalar

| Durum | Ne yap |
|--------|--------|
| `rejected (non-fast-forward)` | Önce `git pull origin main --rebase` sonra tekrar `git push` |
| `Permission denied` | Remote URL ve token/SSH doğru mu kontrol et |
| `nothing to commit` | Değişiklik yok veya `git add` atlanmış |

---

## 2. Başka bir yapay zekaya verilecek kısa proje özeti (kopyala-yapıştır)

Aşağıdaki metni olduğu gibi başka bir asistana yapıştırabilirsin; tüm bağlamı taşımak zorunda kalmazsın.

---

**Proje özeti (Archilink / katalog-projesi)**

- **Ne:** Statik HTML + Tailwind CDN (`cdn.tailwindcss.com`) ile mimari malzeme platformu (Archilink markası). Netlify’da deploy; `netlify.toml` var.
- **Ortak kod:** `core.js` — Supabase (`AG.*` wrapper): oturum, ürün CRUD, marka/mimar oturumları, depolama. Ham `supabase-js` kullanma; hata yönetimi `AG` ile.
- **Layout:** `layout.js` — `#site-header`, `#site-footer` enjekte eder; sayfa `body data-page="..."` ile aktif nav.
- **Marka paneli:** Birden fazla sayfa — `marka-paneli.html` (özet), `marka-paneli-urunler.html`, `marka-paneli-analiz.html`, `marka-paneli-proje.html`, `marka-paneli-projeler.html`. Ortak script: `marka-panel.js`; sayfa modu: `window.__MARKA_PANEL_PAGE__` (`overview` \| `products` \| `analytics` \| `project-new` \| `projects`). Stil: `marka-panel-chrome.css`. Nav: `body data-brand-nav="..."` + linklerde `data-brand-nav-link`.
- **Ürün toplu giriş:** CSV şablonu (`marka-panel.js` içinde `importCsv`); tek tek URL’den çekme (CORS proxy’ler); API sekmesi şimdilik placeholder.
- **Şema:** `schema.sql` (Supabase).
- **Ertelenen fikirler:** `NOTLAR.md` (ör. PDF katalogdan AI ile ürün çıkarma).

**Senin görevin için:** Sadece ilgili HTML/JS/CSS dosyalarını değiştir; `core.js`’teki public `AG` API’sini bozma. Türkçe UI metinleri profesyonel ve doğal olsun. Gereksiz geniş refactor yapma.

---

## 3. Bu dosyanın yeri

Dosya yolu: `Desktop/antigravity/Archilink/GIT-VE-DIS-AI-REHBERI.md`

`katalog-projesi` ana repoya commit edilecekse bu dosyayı oraya da kopyala veya aynı içeriği `katalog-projesi` köküne ekle ki tek kaynakta kalsın.
