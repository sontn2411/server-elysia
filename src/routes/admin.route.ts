import { Elysia, t } from 'elysia'
import { html } from '@elysiajs/html'
import { jwt } from '@elysiajs/jwt'
import { UserService } from '../services/user.service'

const userService = new UserService()

const getTemplate = async (name: string) => {
  return await Bun.file(`./src/views/admin/${name}.html`).text()
}

export const adminRoute = new Elysia()
  .use(html())
  .use(
    jwt({
      name: 'adminJwt',
      secret: process.env.JWT_ACCESS_SECRET || 'access-secret',
      exp: '1d',
    }),
  )
  .get('/login', async ({ html, query }) => {
    const errorMsg = query.error
      ? `<div class="bg-rose-950/40 border border-rose-500/50 text-rose-400 text-sm font-mono px-4 py-3 rounded-lg relative mb-6 shadow-[0_0_15px_rgba(244,63,94,0.1)] flex items-center gap-3"><svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3.L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> <span>${query.error}</span></div>`
      : ''

    let template = await getTemplate('login')
    template = template.replace('{{errorMsg}}', errorMsg)

    return html(template)
  })
  .post(
    '/login',
    async ({ body, adminJwt, cookie: { admin_token }, redirect }) => {
      try {
        const { identity, password } = body as Record<string, string>
        const user = await userService.login({ identity, password })

        const userProfile = await userService.getUserById(user.userId)
        if (!userProfile || !userProfile.isAdmin) {
          return redirect(
            '/login?error=Unauthorized:%20You%20are%20not%20an%20administrator',
          )
        }

        const token = await adminJwt.sign({ sub: user.userId })
        admin_token.set({
          value: token,
          httpOnly: true,
          path: '/',
          maxAge: 86400, // 24 hours
        })
        return redirect('/')
      } catch (e: any) {
        let msg = 'Invalid authentication'
        if (e && e.message) msg = e.message
        return redirect(`/login?error=${encodeURIComponent(msg)}`)
      }
    },
    {
      body: t.Object({
        identity: t.String(),
        password: t.String(),
      }),
    },
  )
  .get('/logout', ({ cookie: { admin_token }, redirect }) => {
    admin_token.remove()
    return redirect('/login')
  })
  .get('/', async ({ adminJwt, cookie: { admin_token }, html, redirect }) => {
    const token = admin_token.value as string
    if (!token) {
      return redirect('/login')
    }
    const payload = await adminJwt.verify(token)
    if (!payload || !payload.sub) {
      return redirect('/login')
    }

    const adminProfile = await userService.getUserById(payload.sub as string)
    if (!adminProfile || !adminProfile.isAdmin) {
      return redirect('/login')
    }

    const users = await userService.getAllUsers()

    const tableRows = users
      .map(
        (u) => `
      <tr class="group">
        <td class="px-6 py-4 whitespace-nowrap text-sm flex items-center gap-4">
          <div class="relative">
            <div class="absolute inset-0 bg-cyber-500 rounded-lg blur opacity-20 group-hover:opacity-60 transition-opacity"></div>
            <div class="h-10 w-10 relative rounded-lg bg-slate-900 border border-cyber-500/30 flex items-center justify-center text-cyber-400 font-mono font-bold text-sm uppercase shadow-[inset_0_0_10px_rgba(14,165,233,0.1)]">
              ${u.username.substring(0, 2)}
            </div>
          </div>
          <div>
            <div class="font-exo font-semibold text-slate-200 tracking-wide">${u.username}</div>
            <div class="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">ID: ${u.userId}</div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm text-slate-400 font-mono flex items-center gap-2">
            <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            ${u.email}
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono uppercase tracking-widest border ${u.status === 'ACTIVE' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-rose-950/30 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.1)]'}">
            <span class="w-1.5 h-1.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}"></span>
            ${u.status}
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          ${
            u.isAdmin
              ? '<span class="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-cyber-300 bg-cyber-900/40 px-3 py-1.5 rounded-md border border-cyber-500/40 shadow-[0_0_15px_rgba(14,165,233,0.15)]"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg> OVERSEER</span>'
              : '<span class="text-xs font-mono text-slate-500 uppercase tracking-widest px-3 py-1.5">Standard</span>'
          }
        </td>
      </tr>
    `,
      )
      .join('')

    const emptyState =
      users.length === 0
        ? '<div class="p-12 text-center border-t border-slate-800"><div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-900/50 border border-slate-700/50 mb-4"><svg class="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg></div><p class="text-slate-500 font-mono text-sm uppercase tracking-widest">No entries found in database</p></div>'
        : ''

    let template = await getTemplate('dashboard')
    template = template.replace('{{adminUsername}}', adminProfile.username)
    template = template.replace('{{totalUsers}}', users.length.toString())
    template = template.replace('{{tableRows}}', tableRows)
    template = template.replace('{{emptyState}}', emptyState)

    return html(template)
  })
