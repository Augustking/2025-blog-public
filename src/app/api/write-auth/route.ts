import crypto from 'crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * 写博文权限门禁（方案1：密码门禁）
 *
 * - POST /api/write-auth  用 BLOG_SLUG_KEY 口令换取 12h 有效期的 HttpOnly 签名 cookie
 * - GET  /api/write-auth  校验 cookie，返回 { ok, expiresAt }
 * - DELETE /api/write-auth  登出，清除 cookie
 */

const COOKIE_NAME = 'write_session'
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000 // 12 小时

function getSecret(): string {
	return process.env.BLOG_SLUG_KEY || 'MyPassword123'
}

function sign(payload: string): string {
	const secret = getSecret()
	const hmac = crypto.createHmac('sha256', secret)
	hmac.update(payload)
	return hmac.digest('hex')
}

function createSessionCookie(): string {
	const expiresAt = Date.now() + SESSION_DURATION_MS
	const payload = JSON.stringify({ expiresAt })
	const sig = sign(payload)
	const value = Buffer.from(JSON.stringify({ payload, sig })).toString('base64url')
	return value
}

function verifySessionCookie(value: string): { ok: boolean; expiresAt: number } {
	try {
		const decoded = JSON.parse(Buffer.from(value, 'base64url').toString())
		const { payload, sig } = decoded as { payload: string; sig: string }
		const expectedSig = sign(payload)
		if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
			return { ok: false, expiresAt: 0 }
		}
		const data = JSON.parse(payload) as { expiresAt: number }
		if (Date.now() > data.expiresAt) {
			return { ok: false, expiresAt: 0 }
		}
		return { ok: true, expiresAt: data.expiresAt }
	} catch {
		return { ok: false, expiresAt: 0 }
	}
}

export async function POST(request: NextRequest) {
	try {
		const { password } = (await request.json()) as { password?: string }
		const secret = getSecret()

		if (!password || password !== secret) {
			return NextResponse.json({ ok: false, message: '口令错误' }, { status: 401 })
		}

		const sessionValue = createSessionCookie()
		const response = NextResponse.json({ ok: true, expiresAt: Date.now() + SESSION_DURATION_MS })
		response.cookies.set(COOKIE_NAME, sessionValue, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			path: '/',
			maxAge: SESSION_DURATION_MS / 1000,
		})
		return response
	} catch (error) {
		console.error('Write auth error:', error)
		return NextResponse.json({ ok: false, message: '服务器内部错误' }, { status: 500 })
	}
}

export async function GET(request: NextRequest) {
	const cookie = request.cookies.get(COOKIE_NAME)?.value
	if (!cookie) {
		return NextResponse.json({ ok: false, expiresAt: 0 })
	}
	const result = verifySessionCookie(cookie)
	return NextResponse.json(result)
}

export async function DELETE() {
	const response = NextResponse.json({ ok: true })
	response.cookies.set(COOKIE_NAME, '', {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		path: '/',
		maxAge: 0,
	})
	return response
}