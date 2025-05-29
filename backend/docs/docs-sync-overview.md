# 📚 Quick Documentation Reference

## ⚡ Essential Commands

```bash
# 🔄 Sync docs once (after making changes)
npm run docs:sync

# 👀 Watch docs for changes (automatic sync)
npm run docs:watch

# ✅ Check if docs are in sync
npm run docs:check

# 🚀 Full development with backend + frontend
npm run dev
```

## 📝 Workflow

### Making Documentation Changes

1. **Edit files in `!docs/` directory only**
   ```bash
   # ✅ Correct
   vim !docs/API/new-endpoint.md
   
   # ❌ Don't edit here
   vim backend/docs/API/new-endpoint.md
   ```

2. **Sync changes for localhost testing**
   ```bash
   npm run docs:sync
   ```

3. **Test changes**
   - Visit: `http://localhost:5173/help`
   - Or API directly: `http://localhost:3001/api/docs/content?path=your-doc`

4. **Deploy**
   ```bash
   npm run build  # Automatically syncs docs
   ```

### Development Setup (Recommended)

**Terminal 1:** Main development
```bash
npm run dev
```

**Terminal 2:** Docs auto-sync
```bash
npm run docs:watch
```

## 🚨 Troubleshooting

| Problem | Solution |
|---------|----------|
| Changes not showing on localhost | `npm run docs:sync` |
| "Documentation out of sync" | `npm run docs:sync` |
| Changes not showing in production | Redeploy with `npm run build` |
| Files missing after deployment | Check build logs, ensure `!docs/` exists |

## 📁 File Structure

```
!docs/                          # ← Edit here
├── API/
├── Config/
├── Data/
└── your-new-docs.md

backend/docs/                   # ← Auto-generated (don't edit)
├── API/
├── Config/
├── Data/
└── your-new-docs.md
```

## 🎯 Quick Actions

- **Add new doc:** Create in `!docs/`, run `npm run docs:sync`
- **Update existing:** Edit in `!docs/`, run `npm run docs:sync`
- **Auto-sync during development:** Run `npm run docs:watch`
- **Check sync status:** Run `npm run docs:check`
- **Deploy with docs:** Run `npm run build`

---

💡 **Remember:** Always edit in `!docs/`, never in `backend/docs/` 