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
      ? `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">${query.error}</div>`
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
      <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
        <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500 flex items-center gap-3">
          <div class="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
            ${u.username.substring(0, 2)}
          </div>
          <div>
            <div class="font-medium text-slate-900">${u.username}</div>
            <div class="text-xs text-slate-500">${u.id}</div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm text-slate-600">${u.email}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}">
            ${u.status}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          ${
            u.isAdmin
              ? '<span class="inline-flex items-center gap-1 text-sm font-medium text-purple-700 bg-purple-100 px-2 py-1 rounded-md border border-purple-200"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg> Admin</span>'
              : '<span class="text-sm text-slate-500">User</span>'
          }
        </td>
      </tr>
    `,
      )
      .join('')

    const emptyState =
      users.length === 0
        ? '<div class="p-8 text-center text-slate-500">No users found.</div>'
        : ''

    let template = await getTemplate('dashboard')
    template = template.replace('{{adminUsername}}', adminProfile.username)
    template = template.replace('{{totalUsers}}', users.length.toString())
    template = template.replace('{{tableRows}}', tableRows)
    template = template.replace('{{emptyState}}', emptyState)

    return html(template)
  })
