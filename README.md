# Prode Mundial 2026 🏆

## Cómo deployar en Vercel

### 1. Subir el código a GitHub
1. Creá una cuenta en github.com (si no tenés)
2. Creá un repositorio nuevo llamado `prode-mundial-2026`
3. Subí estos archivos ahí (podés arrastrarlos desde tu compu)

### 2. Conectar con Vercel
1. Entrá a vercel.com → "Sign up" con GitHub
2. Click en "Add New Project"
3. Importá el repo `prode-mundial-2026`
4. En "Environment Variables" agregá:
   - `VITE_SUPABASE_URL` = `https://egtvnxoheujqcmzjfwys.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (tu anon key)
5. Click "Deploy" — en 2 minutos tenés tu URL

### 3. Compartir
La URL va a ser algo como `prode-mundial-2026.vercel.app`
Mandásela a tus amigos y ya pueden anotarse.

## Panel admin
- Entrá a la app → abajo dice "Panel admin"
- Contraseña: `mundial2026`
- Desde ahí cargás los resultados de cada partido

## Actualizar la app
Si querés cambiar algo, editá los archivos y volvé a subir a GitHub.
Vercel re-deployea automáticamente cada vez que actualizás el repo.
