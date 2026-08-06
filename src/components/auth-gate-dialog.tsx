'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useWriteGateStore } from '@/lib/write-gate'

/**
 * 全局写博文口令弹窗。
 * 挂载在根布局，写操作未解锁时由 requireWriteApproval() 唤起。
 */
export function AuthGateDialog() {
	const { dialogOpen, dialogMessage, loading, setLoading, setAuthorized, closeDialog } = useWriteGateStore()
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [show, setShow] = useState(false)

	// 用 requestAnimationFrame 避免 SSR 水合冲突
	useEffect(() => {
		setShow(true)
	}, [])

	useEffect(() => {
		if (!dialogOpen) {
			setPassword('')
			setError('')
		}
	}, [dialogOpen])

	const submit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (!password || loading) return
		setLoading(true)
		setError('')
		try {
			const res = await fetch('/api/write-auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password }),
			})
			const data = (await res.json()) as { ok: boolean; message?: string }
			if (data.ok) {
				setAuthorized(true)
				const resolve = useWriteGateStore.getState().pendingResolve
				useWriteGateStore.setState({ dialogOpen: false, pendingResolve: null })
				if (resolve) resolve(true)
			} else {
				setError(data.message || '口令错误，请重试')
			}
		} catch {
			setError('网络错误，请稍后重试')
		} finally {
			setLoading(false)
		}
	}

	if (!show || !dialogOpen) return null

	return (
		<div
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 9999,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: 'rgba(0,0,0,0.5)',
				backdropFilter: 'blur(4px)',
			}}
		>
			<div
				style={{
					background: 'var(--color-bg)',
					border: '1px solid var(--color-border)',
					borderRadius: 16,
					padding: 32,
					width: 360,
					maxWidth: '90vw',
					boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
				}}
			>
				<h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: 'var(--color-primary)' }}>
					验证身份
				</h2>
				<p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--color-secondary)', lineHeight: 1.5 }}>
					{dialogMessage}
				</p>
				<form onSubmit={submit}>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="输入管理口令"
						autoFocus
						disabled={loading}
						style={{
							width: '100%',
							padding: '10px 14px',
							fontSize: 15,
							borderRadius: 10,
							border: '1px solid var(--color-border)',
							background: 'var(--color-card)',
							color: 'var(--color-primary)',
							outline: 'none',
							boxSizing: 'border-box',
						}}
					/>
					{error && (
						<p style={{ margin: '8px 0 0', fontSize: 13, color: '#e53e3e' }}>{error}</p>
					)}
					<div
						style={{
							display: 'flex',
							justifyContent: 'flex-end',
							gap: 10,
							marginTop: 20,
						}}
					>
						<button
							type="button"
							onClick={() => {
								const resolve = useWriteGateStore.getState().pendingResolve
								useWriteGateStore.setState({ dialogOpen: false, pendingResolve: null })
								if (resolve) resolve(false)
							}}
							disabled={loading}
							style={{
								padding: '8px 20px',
								borderRadius: 10,
								border: '1px solid var(--color-border)',
								background: 'transparent',
								color: 'var(--color-primary)',
								fontSize: 14,
								cursor: 'pointer',
							}}
						>
							取消
						</button>
						<button
							type="submit"
							disabled={loading || !password}
							style={{
								padding: '8px 20px',
								borderRadius: 10,
								border: 'none',
								background: loading ? '#aaa' : 'var(--color-primary)',
								color: '#fff',
								fontSize: 14,
								cursor: loading ? 'not-allowed' : 'pointer',
							}}
						>
							{loading ? '验证中…' : '确认'}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}